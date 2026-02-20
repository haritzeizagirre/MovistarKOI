/**
 * Liquipedia Service — Fully Automated KOI Tournament Data
 *
 * Fetches and parses KOI tournament data from Liquipedia's MediaWiki API.
 *
 * Two data sources on Liquipedia:
 *
 * 1. **KOI Team Pages** (past results / achievements)
 *    - /tft/KOI   → individual achievements table with player results
 *    - /pokemon/KOI → individual achievements table with player results
 *    - Gives: date, placement, tournament name, player, prize
 *
 * 2. **Season/Circuit Pages** (upcoming events schedule)
 *    - /tft/{current_season}  → lists ALL events by region including future ones
 *    - /pokemon/Pokemon_Championships/{year} → lists all VGC events
 *    - We filter for EMEA/World (TFT) or all VGC events
 *    - Future events have "TBD" as winner → we mark them as upcoming
 *
 * Configuration:
 *    - src/config/liquipedia.ts — only needs updating ~2x per year
 *      (once when a new TFT set launches, once when Pokemon new season starts)
 *
 * Caching: 6 hours for results, 2 hours for upcoming
 * Rate limit: Liquipedia asks for ≤1 req/s with a proper User-Agent
 */

import {
  Tournament,
  TournamentFormat,
  TournamentPhase,
  TournamentParticipant,
  MatchStatus,
  Game,
} from '../types';
import {
  TFT_SEASON_PAGE,
  POKEMON_CHAMPIONSHIP_YEAR,
  KOI_TFT_REGIONS,
  KOI_TFT_PLAYERS,
  KOI_VGC_PLAYERS,
} from '../config/liquipedia';

// ─── Configuration ──────────────────────────────────────────────────

const LIQUIPEDIA_ENDPOINTS: Record<string, { apiUrl: string; baseUrl: string; game: Game }> = {
  tft: {
    apiUrl: 'https://liquipedia.net/tft/api.php',
    baseUrl: 'https://liquipedia.net/tft',
    game: 'tft',
  },
  pokemon: {
    apiUrl: 'https://liquipedia.net/pokemon/api.php',
    baseUrl: 'https://liquipedia.net/pokemon',
    game: 'pokemon_vgc',
  },
};

const USER_AGENT = 'MovistarKOI-App/1.0 (esports fan app; contact@movistar-koi-app.dev)';
const RESULTS_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const UPCOMING_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
const FETCH_TIMEOUT = 15_000;

// ─── Cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  data: Tournament[];
  timestamp: number;
}

const liquipediaCache: Record<string, CacheEntry> = {};

function getCached(key: string, ttl: number): Tournament[] | null {
  const entry = liquipediaCache[key];
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }
  return null;
}

function setCache(key: string, data: Tournament[]): void {
  liquipediaCache[key] = { data, timestamp: Date.now() };
}

// ─── Rate Limit Queue ───────────────────────────────────────────────

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

async function rateLimitDelay(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
}

// ─── HTML Parsing Helpers ───────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#160;/g, ' ')
    .replace(/&#58;/g, ':')
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).trim();
}

function extractHref(html: string): string | null {
  const match = html.match(/href="([^"]+)"/);
  return match ? decodeHtmlEntities(match[1]) : null;
}

function parsePlacement(text: string): number | undefined {
  const cleaned = text.replace(/&#160;/g, ' ').replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

function parsePrize(text: string): number {
  const cleaned = text.replace(/[$€,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ─── API Fetch ──────────────────────────────────────────────────────

class RateLimitError extends Error {
  constructor() {
    super('Liquipedia rate limited (429)');
    this.name = 'RateLimitError';
  }
}

/**
 * Fetch a parsed page from a Liquipedia wiki.
 * Retries once on rate limit (429) after a delay.
 */
async function fetchPageHtml(apiUrl: string, page: string): Promise<string> {
  const url = `${apiUrl}?action=parse&page=${page}&prop=text&format=json`;

  const doFetch = async (): Promise<string> => {
    await rateLimitDelay();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw new RateLimitError();
      }

      if (!response.ok) {
        throw new Error(`Liquipedia API returned ${response.status}`);
      }

      const data = await response.json();
      return data?.parse?.text?.['*'] || '';
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await doFetch();
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.log('[Liquipedia] Rate limited, retrying in 10s...');
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      return doFetch();
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PART 1: PAST RESULTS — parsing KOI team page achievements table
// ═══════════════════════════════════════════════════════════════════

interface ParsedAchievementRow {
  date: string;
  placement: number | undefined;
  placementText: string;
  tier: string;
  tournamentName: string;
  tournamentHref: string;
  playerName: string;
  prize: number;
}

function findAchievementsTable(html: string): string | null {
  const tableRegex = /<table\s+class="wikitable\s+wikitable-striped\s+sortable"[^>]*>[\s\S]*?<\/table>/g;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(html)) !== null) {
    const tableHtml = match[0];
    if (tableHtml.includes('>Player<') || tableHtml.includes('>Player</')) {
      return tableHtml;
    }
  }
  return null;
}

function parseAchievementsRows(tableHtml: string): ParsedAchievementRow[] {
  const rows: ParsedAchievementRow[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const rowHtml = trMatch[1];
    if (rowHtml.includes('<th') || trMatch[0].includes('display:none')) continue;

    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const cells: string[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1]);
    }

    if (cells.length < 6) continue;

    const date = stripHtml(cells[0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const tournamentName = stripHtml(cells[4]);
    const playerName = stripHtml(cells[5]);
    if (!tournamentName || !playerName) continue;

    rows.push({
      date,
      placement: parsePlacement(stripHtml(cells[1])),
      placementText: stripHtml(cells[1]),
      tier: stripHtml(cells[2]),
      tournamentName,
      tournamentHref: extractHref(cells[4]) || extractHref(cells[3]) || '',
      playerName,
      prize: parsePrize(stripHtml(cells[cells.length - 1])),
    });
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════════
// PART 2: UPCOMING EVENTS — parsing season/circuit schedule pages
// ═══════════════════════════════════════════════════════════════════

interface ParsedUpcomingEvent {
  name: string;
  href: string;
  startDate: string;
  endDate?: string;
  prizePool?: number;
  participants?: number;
  region: string;
  isUpcoming: boolean;
}

function parseMonth(abbr: string): number {
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  return months[abbr.toLowerCase().substring(0, 3)] ?? -1;
}

/**
 * Parse a Liquipedia date range string like "Mar 06–15, 2026" or "Jan 30 – Feb 01, 2026"
 * into { startDate, endDate } ISO strings.
 */
function parseDateRange(dateStr: string): { startDate: string; endDate?: string } | null {
  const clean = dateStr.replace(/\u2013|\u2014/g, '-').replace(/–/g, '-').trim();

  // Pattern: "Mon DD - DD, YYYY" (same month)
  let match = clean.match(/([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s*(\d{4})/);
  if (match) {
    const month = parseMonth(match[1]);
    if (month < 0) return null;
    const y = parseInt(match[4], 10);
    const d1 = parseInt(match[2], 10);
    const d2 = parseInt(match[3], 10);
    return {
      startDate: `${y}-${String(month + 1).padStart(2, '0')}-${String(d1).padStart(2, '0')}`,
      endDate: `${y}-${String(month + 1).padStart(2, '0')}-${String(d2).padStart(2, '0')}`,
    };
  }

  // Pattern: "Mon DD - Mon DD, YYYY" (cross-month)
  match = clean.match(/([A-Za-z]+)\s+(\d{1,2})\s*-\s*([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (match) {
    const m1 = parseMonth(match[1]);
    const m2 = parseMonth(match[3]);
    if (m1 < 0 || m2 < 0) return null;
    const y = parseInt(match[5], 10);
    return {
      startDate: `${y}-${String(m1 + 1).padStart(2, '0')}-${String(parseInt(match[2], 10)).padStart(2, '0')}`,
      endDate: `${y}-${String(m2 + 1).padStart(2, '0')}-${String(parseInt(match[4], 10)).padStart(2, '0')}`,
    };
  }

  // Pattern: "Mon DD, YYYY" (single day)
  match = clean.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (match) {
    const month = parseMonth(match[1]);
    if (month < 0) return null;
    const y = parseInt(match[3], 10);
    const d = parseInt(match[2], 10);
    return {
      startDate: `${y}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    };
  }

  return null;
}

/**
 * Parse upcoming tournament entries from a Liquipedia season/circuit page.
 *
 * Strategy: Find all tournament links on the page, extract nearby context
 * (dates, regions), and identify which are upcoming (future date or TBD winner).
 * Filter for relevant regions (EMEA + World for TFT).
 */
function parseUpcomingEventsFromSeasonPage(
  html: string,
  game: Game,
  relevantRegions: string[],
): ParsedUpcomingEvent[] {
  const events: ParsedUpcomingEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Identify regional sections using heading IDs.
  const sectionPatterns = [
    { pattern: /id="Championship"/gi, region: 'World' },
    { pattern: /id="EMEA_Tournaments"/gi, region: 'EMEA' },
    { pattern: /id="AMER_Tournaments"/gi, region: 'AMER' },
    { pattern: /id="APAC_Tournaments"/gi, region: 'APAC' },
    { pattern: /id="CN_Tournaments"/gi, region: 'CN' },
  ];

  const allBoundaries: { region: string; start: number }[] = [];
  for (const { pattern, region } of sectionPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(html)) !== null) {
      allBoundaries.push({ region, start: m.index });
    }
  }
  allBoundaries.sort((a, b) => a.start - b.start);

  const sectionBoundaries = allBoundaries.map((b, i) => ({
    ...b,
    end: i + 1 < allBoundaries.length ? allBoundaries[i + 1].start : html.length,
  }));

  function getRegionForPosition(pos: number): string {
    for (const section of sectionBoundaries) {
      if (pos >= section.start && pos < section.end) {
        return section.region;
      }
    }
    return 'Unknown';
  }

  // Find all tournament page links.
  const basePath = game === 'tft' ? '\\/tft\\/' : '\\/pokemon\\/';
  const linkRegex = new RegExp(
    `<a\\s+[^>]*href="(${basePath}[^"]+)"[^>]*title="([^"]*)"[^>]*>([^<]+)<\\/a>`,
    'gi',
  );

  const seenNames = new Set<string>();
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1];
    const title = decodeHtmlEntities(linkMatch[2]);
    const text = decodeHtmlEntities(linkMatch[3]).trim();

    // Skip non-tournament links
    if (href.includes('action=edit') || href.includes('Category:') ||
        href.includes('Special:') || href.includes('#')) continue;
    if (text.length < 10) continue;

    // Must look like a tournament name
    const tournamentKeywords = ['Cup', 'Championship', 'Finals', 'Regional', 'Qualifier',
      'Crown', 'Open', 'Tournament', 'Trials', 'Series', 'VGC', 'Invitational', 'Circuit'];
    const lowerText = text.toLowerCase();
    if (!tournamentKeywords.some((kw) => lowerText.includes(kw.toLowerCase()))) continue;

    const tournamentName = title || text;
    const normalizedName = tournamentName.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenNames.has(normalizedName)) continue;
    seenNames.add(normalizedName);

    // Check region
    const region = getRegionForPosition(linkMatch.index);
    const isRelevantRegion = relevantRegions.some(
      (r) => region.toLowerCase().includes(r.toLowerCase()),
    );
    if (!isRelevantRegion) continue;

    // Extract date from nearby context
    const contextAfter = html.substring(linkMatch.index, linkMatch.index + 800);
    const dateMatch = contextAfter.match(
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:\s*[\u2013\-–]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+)?\d{1,2})?,?\s*\d{4}/i,
    );

    if (!dateMatch) continue;
    const parsed = parseDateRange(dateMatch[0]);
    if (!parsed) continue;

    const eventDate = new Date(parsed.startDate + 'T00:00:00');
    const endDate = parsed.endDate ? new Date(parsed.endDate + 'T23:59:59') : eventDate;
    const isUpcoming = endDate >= today && contextAfter.includes('TBD');
    if (!isUpcoming) continue;

    const prizeMatch = contextAfter.match(/\$[\d,]+/);
    const participantMatch = contextAfter.match(/(\d+)\s*participants/i);

    events.push({
      name: tournamentName,
      href,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      prizePool: prizeMatch ? parsePrize(prizeMatch[0]) : undefined,
      participants: participantMatch ? parseInt(participantMatch[1], 10) : undefined,
      region,
      isUpcoming: true,
    });
  }

  return events;
}

/**
 * Parse upcoming VGC events from the Pokemon Championships page.
 * Filters for VGC-specific tournament links with future dates.
 */
function parseUpcomingVGCEvents(html: string): ParsedUpcomingEvent[] {
  const events: ParsedUpcomingEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seenNames = new Set<string>();

  const linkRegex = /<a\s+[^>]*href="(\/pokemon\/[^"]+)"[^>]*title="([^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1];
    const title = decodeHtmlEntities(linkMatch[2]);
    const text = decodeHtmlEntities(linkMatch[3]).trim();

    // Only VGC tournament pages
    if (!text.includes('VGC') && !href.includes('VGC') && !title.includes('VGC')) continue;
    if (href.includes('action=edit') || href.includes('Category:')) continue;
    if (text.length < 10) continue;

    const tournamentName = title || text;
    const normalizedName = tournamentName.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenNames.has(normalizedName)) continue;
    seenNames.add(normalizedName);

    // Extract date from nearby context
    const contextAfter = html.substring(linkMatch.index, linkMatch.index + 800);
    const dateMatch = contextAfter.match(
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:\s*[\u2013\-–]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+)?\d{1,2})?,?\s*\d{4}/i,
    );

    if (!dateMatch) continue;
    const parsed = parseDateRange(dateMatch[0]);
    if (!parsed) continue;

    const eventDate = new Date(parsed.startDate + 'T00:00:00');
    const endDate = parsed.endDate ? new Date(parsed.endDate + 'T23:59:59') : eventDate;

    // Only take events whose end date hasn't passed
    if (endDate < today) continue;

    const prizeMatch = contextAfter.match(/\$[\d,]+/);
    const participantMatch = contextAfter.match(/(\d+)\s*participants/i);

    events.push({
      name: tournamentName,
      href,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      prizePool: prizeMatch ? parsePrize(prizeMatch[0]) : undefined,
      participants: participantMatch ? parseInt(participantMatch[1], 10) : undefined,
      region: 'International',
      isUpcoming: true,
    });
  }

  return events;
}

// ─── Tournament Building ────────────────────────────────────────────

function generateTournamentId(game: Game, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `lp-${game === 'tft' ? 'tft' : 'vgc'}-${slug}`;
}

function getTeamId(game: Game): string {
  return game === 'tft' ? 'static-tft' : 'static-pokemon';
}

function getFormat(game: Game): TournamentFormat {
  return game === 'tft' ? 'points_elimination' : 'swiss_to_bracket';
}

function buildPhases(game: Game, status: MatchStatus): TournamentPhase[] {
  if (game === 'tft') {
    return [{
      name: 'Tournament',
      day: 1,
      status,
      description: '8-player lobbies, points per placement.',
    }];
  }
  return [
    {
      name: 'Day 1 — Swiss Rounds',
      day: 1,
      status,
      description: 'Players matched by W/L record. Top players qualify to Day 2.',
    },
    {
      name: 'Day 2 — Top Cut',
      day: 2,
      status,
      description: 'Single elimination bracket until a champion is crowned.',
    },
  ];
}

function buildParticipant(name: string, game: Game, placement?: number): TournamentParticipant {
  const prefix = game === 'tft' ? 'static-tft' : 'static-pokemon';
  return {
    playerId: `${prefix}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    playerName: name,
    placement,
  };
}

function inferStatus(dateStr: string, endDateStr?: string): MatchStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(dateStr + 'T00:00:00');
  const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : startDate;

  if (startDate > today) return 'upcoming';
  if (endDate >= today && startDate <= today) return 'live';
  return 'finished';
}

function inferLocation(name: string, game: Game): string | undefined {
  const locationPatterns: Record<string, string> = {
    'EMEA': 'Online', 'AMER': 'Online', 'Online': 'Online',
    'Paris': 'Paris, France', 'London': 'London, UK',
    'Stuttgart': 'Stuttgart, Germany', 'Birmingham': 'Birmingham, UK',
    'Stockholm': 'Stockholm, Sweden', 'New Orleans': 'New Orleans, US',
    'São Paulo': 'São Paulo, Brazil', 'Anaheim': 'Anaheim, US',
    'San Diego': 'San Diego, US', 'Yokohama': 'Yokohama, Japan',
    'Sydney': 'Sydney, Australia', 'Vancouver': 'Vancouver, Canada',
  };
  for (const [pattern, loc] of Object.entries(locationPatterns)) {
    if (name.includes(pattern)) return loc;
  }
  return game === 'tft' ? 'Online' : undefined;
}

/** Build Tournament objects from parsed achievement rows (PAST results). */
function buildTournamentsFromResults(
  rows: ParsedAchievementRow[],
  game: Game,
  baseUrl: string,
): Tournament[] {
  const grouped = new Map<string, ParsedAchievementRow[]>();
  for (const row of rows) {
    if (!grouped.has(row.tournamentName)) grouped.set(row.tournamentName, []);
    grouped.get(row.tournamentName)!.push(row);
  }

  const tournaments: Tournament[] = [];

  for (const [name, entries] of grouped) {
    const first = entries[0];
    const status = inferStatus(first.date);

    let externalUrl: string | undefined;
    if (first.tournamentHref) {
      externalUrl = first.tournamentHref.startsWith('/')
        ? `https://liquipedia.net${first.tournamentHref}`
        : `${baseUrl}/${first.tournamentHref}`;
    }

    const participants = entries.map((row) =>
      buildParticipant(row.playerName, game, row.placement),
    );

    tournaments.push({
      id: generateTournamentId(game, name),
      teamId: getTeamId(game),
      game,
      name,
      location: inferLocation(name, game),
      startDate: first.date,
      time: game === 'tft' ? '18:00' : '09:00',
      status,
      format: getFormat(game),
      phases: buildPhases(game, status),
      koiParticipants: participants,
      externalUrl,
    });
  }

  return tournaments;
}

/** Build Tournament objects from parsed upcoming events with KOI roster. */
function buildTournamentsFromUpcomingEvents(
  events: ParsedUpcomingEvent[],
  game: Game,
): Tournament[] {
  const playerNames = game === 'tft' ? KOI_TFT_PLAYERS : KOI_VGC_PLAYERS;

  return events.map((event) => {
    const status = inferStatus(event.startDate, event.endDate);

    return {
      id: generateTournamentId(game, event.name),
      teamId: getTeamId(game),
      game,
      name: event.name,
      location: inferLocation(event.name, game),
      startDate: event.startDate,
      endDate: event.endDate,
      time: game === 'tft' ? '18:00' : '09:00',
      status,
      format: getFormat(game),
      totalParticipants: event.participants,
      phases: buildPhases(game, status),
      koiParticipants: playerNames.map((name) => buildParticipant(name, game)),
      externalUrl: `https://liquipedia.net${event.href}`,
    };
  });
}

// ─── Fetch & Parse Pipelines ────────────────────────────────────────

/** Fetch past KOI tournament results from team page. */
async function fetchResultsFromTeamPage(wikiKey: string): Promise<Tournament[]> {
  const config = LIQUIPEDIA_ENDPOINTS[wikiKey];
  if (!config) return [];

  const cacheKey = `lp-results-${wikiKey}`;
  const cached = getCached(cacheKey, RESULTS_CACHE_TTL);
  if (cached) return cached;

  try {
    const html = await fetchPageHtml(config.apiUrl, 'KOI');
    if (!html) return [];

    const tableHtml = findAchievementsTable(html);
    if (!tableHtml) {
      console.warn(`[Liquipedia] No achievements table found for ${wikiKey}`);
      return [];
    }

    const rows = parseAchievementsRows(tableHtml);
    if (rows.length === 0) return [];

    const tournaments = buildTournamentsFromResults(rows, config.game, config.baseUrl);
    console.log(`[Liquipedia] Parsed ${tournaments.length} ${wikiKey} results (${rows.length} player entries)`);

    if (tournaments.length > 0) setCache(cacheKey, tournaments);
    return tournaments;
  } catch (error) {
    console.warn(`[Liquipedia] Error fetching ${wikiKey} results:`, error);
    return [];
  }
}

/** Fetch upcoming TFT tournaments from the current season page. */
async function fetchUpcomingTFTFromSeasonPage(): Promise<Tournament[]> {
  const cacheKey = 'lp-upcoming-tft';
  const cached = getCached(cacheKey, UPCOMING_CACHE_TTL);
  if (cached) return cached;

  try {
    const config = LIQUIPEDIA_ENDPOINTS.tft;
    const html = await fetchPageHtml(config.apiUrl, TFT_SEASON_PAGE);
    if (!html) return [];

    const events = parseUpcomingEventsFromSeasonPage(html, 'tft', KOI_TFT_REGIONS);
    if (events.length === 0) {
      console.warn('[Liquipedia] No upcoming TFT events found on season page');
      return [];
    }

    const tournaments = buildTournamentsFromUpcomingEvents(events, 'tft');
    console.log(`[Liquipedia] Found ${tournaments.length} upcoming TFT events`);

    if (tournaments.length > 0) setCache(cacheKey, tournaments);
    return tournaments;
  } catch (error) {
    console.warn('[Liquipedia] Error fetching upcoming TFT events:', error);
    return [];
  }
}

/** Fetch upcoming Pokémon VGC tournaments from the championship page. */
async function fetchUpcomingPokemonFromChampionshipPage(): Promise<Tournament[]> {
  const cacheKey = 'lp-upcoming-pokemon';
  const cached = getCached(cacheKey, UPCOMING_CACHE_TTL);
  if (cached) return cached;

  try {
    const config = LIQUIPEDIA_ENDPOINTS.pokemon;
    const page = `Pokemon_Championships/${POKEMON_CHAMPIONSHIP_YEAR}`;
    const html = await fetchPageHtml(config.apiUrl, page);
    if (!html) return [];

    const events = parseUpcomingVGCEvents(html);
    if (events.length === 0) {
      console.warn('[Liquipedia] No upcoming VGC events found');
      return [];
    }

    const tournaments = buildTournamentsFromUpcomingEvents(events, 'pokemon_vgc');
    console.log(`[Liquipedia] Found ${tournaments.length} upcoming VGC events`);

    if (tournaments.length > 0) setCache(cacheKey, tournaments);
    return tournaments;
  } catch (error) {
    console.warn('[Liquipedia] Error fetching upcoming VGC events:', error);
    return [];
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/** Deduplicate tournaments by normalized name, keeping first occurrence */
function deduplicateTournaments(tournaments: Tournament[]): Tournament[] {
  const seen = new Set<string>();
  return tournaments.filter((t) => {
    const key = t.name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fetch all KOI TFT tournaments (past results + upcoming events).
 */
export async function fetchTFTTournaments(): Promise<Tournament[]> {
  const [results, upcoming] = await Promise.all([
    fetchResultsFromTeamPage('tft'),
    fetchUpcomingTFTFromSeasonPage(),
  ]);
  return deduplicateTournaments([...results, ...upcoming]);
}

/**
 * Fetch all KOI Pokemon VGC tournaments (past results + upcoming events).
 */
export async function fetchPokemonTournaments(): Promise<Tournament[]> {
  const [results, upcoming] = await Promise.all([
    fetchResultsFromTeamPage('pokemon'),
    fetchUpcomingPokemonFromChampionshipPage(),
  ]);
  return deduplicateTournaments([...results, ...upcoming]);
}

/**
 * Fetch all KOI tournaments from Liquipedia (TFT + Pokemon VGC).
 * Returns sorted newest first.
 */
export async function fetchAllLiquipediaTournaments(): Promise<Tournament[]> {
  const tft = await fetchTFTTournaments();
  const pokemon = await fetchPokemonTournaments();

  return [...tft, ...pokemon].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
}

/**
 * Fetch tournaments filtered by status.
 */
export async function fetchLiquipediaTournamentsByStatus(
  status: MatchStatus,
): Promise<Tournament[]> {
  const all = await fetchAllLiquipediaTournaments();
  return all.filter((t) => t.status === status);
}

/**
 * Fetch tournaments for a specific game.
 */
export async function fetchLiquipediaTournamentsByGame(
  game: Game,
): Promise<Tournament[]> {
  if (game === 'tft') return fetchTFTTournaments();
  if (game === 'pokemon_vgc') return fetchPokemonTournaments();
  return [];
}

/** Clear the Liquipedia cache (useful for pull-to-refresh) */
export function clearLiquipediaCache(): void {
  for (const key of Object.keys(liquipediaCache)) {
    delete liquipediaCache[key];
  }
}
