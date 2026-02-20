/**
 * Liquipedia CoD Enrichment Service
 *
 * Enriches PandaScore CoD match data with map names, game modes, and
 * per-map scores from Liquipedia's CoD wiki.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * DATA FLOW:
 *   1. PandaScore provides: teams, series score, game count, schedule
 *   2. This service adds: map name, game mode (HP/S&D/CTL), per-map scores
 *
 * HOW IT WORKS:
 *   - Fetches KOI's CoD team page → finds the "Match History" section
 *   - Each match result row typically has a link to the match detail page
 *   - Match detail pages contain a bracket popup with per-map data:
 *       Mode | Map | Score
 *       HP   | Karachi | 250-200
 *       S&D  | Terminal | 6-4
 *       CTL  | Skidrow  | 3-2
 *
 *   Alternative: CDL tournament pages have bracket + group match data
 *   with the same popup structure.
 *
 * LIQUIPEDIA HTML PATTERNS (bracket popup):
 *   <div class="brkts-popup-body-game">
 *     <!-- map/mode in bracketed text, center div, or link text -->
 *     <!-- scores in dedicated score divs -->
 *   </div>
 *
 * CACHING:
 *   - Team page match list: 4 hours
 *   - Individual match details: 24 hours (finished matches don't change)
 *   - Tournament page data: 6 hours
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { MatchGame, MatchMap } from '../types';
import {
  CDL_SEASON_PAGE,
  KOI_COD_TEAM_NAME,
  COD_GAME_MODES,
} from '../config/liquipedia';

// ─── Constants ──────────────────────────────────────────────────────

const COD_API_URL = 'https://liquipedia.net/callofduty/api.php';
const COD_BASE_URL = 'https://liquipedia.net/callofduty';
const USER_AGENT = 'MovistarKOI-App/1.0 (esports fan app; contact@movistar-koi-app.dev)';
const FETCH_TIMEOUT = 15_000;

// Cache TTLs
const TEAM_PAGE_CACHE_TTL = 4 * 60 * 60 * 1000;    // 4 hours
const MATCH_DETAIL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const TOURNAMENT_CACHE_TTL = 6 * 60 * 60 * 1000;    // 6 hours

// ─── Types ──────────────────────────────────────────────────────────

/** Parsed map data from a single game within a series */
export interface CodMapData {
  gameNumber: number;
  mapName: string;
  gameMode: string;           // Full name: "Hardpoint", "Search & Destroy", "Control"
  gameModeShort: string;      // Short: "HP", "S&D", "CTL"
  homeScore?: number;
  awayScore?: number;
  winnerId?: 'home' | 'away';
}

/** Parsed match data from Liquipedia */
export interface CodMatchDetail {
  team1: string;
  team2: string;
  team1Score?: number;
  team2Score?: number;
  date?: string;
  maps: CodMapData[];
  matchPageUrl?: string;
}

// ─── Cache ──────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const codCache: Record<string, CacheEntry<any>> = {};

function getCached<T>(key: string, ttl: number): T | null {
  const entry = codCache[key];
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  codCache[key] = { data, timestamp: Date.now() };
}

// ─── Rate Limit ─────────────────────────────────────────────────────

let lastCodRequestTime = 0;
const MIN_COD_REQUEST_INTERVAL = 2500; // 2.5s between requests (conservative)

async function rateLimitDelay(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCodRequestTime;
  if (elapsed < MIN_COD_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_COD_REQUEST_INTERVAL - elapsed),
    );
  }
  lastCodRequestTime = Date.now();
}

// ─── HTML Helpers ───────────────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#160;/g, ' ')
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, '')).trim();
}

// ─── API Fetch ──────────────────────────────────────────────────────

async function fetchPageHtml(page: string): Promise<string | null> {
  const url = `${COD_API_URL}?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json`;

  await rateLimitDelay();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });

    if (response.status === 429) {
      console.warn('[Liquipedia CoD] Rate limited (429), retrying in 10s...');
      await new Promise((resolve) => setTimeout(resolve, 10_000));

      // One retry
      const retryResponse = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });

      if (!retryResponse.ok) {
        console.warn(`[Liquipedia CoD] Retry failed: ${retryResponse.status}`);
        return null;
      }
      const retryData = await retryResponse.json();
      return retryData?.parse?.text?.['*'] || null;
    }

    if (!response.ok) {
      console.warn(`[Liquipedia CoD] API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data?.parse?.text?.['*'] || null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Liquipedia CoD] Request timed out');
    } else {
      console.warn('[Liquipedia CoD] Fetch error:', error.message);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PARSING: Match Detail Pages
// ═══════════════════════════════════════════════════════════════════

/**
 * Normalize a game mode string to its canonical and short forms.
 */
function normalizeGameMode(raw: string): { full: string; short: string } {
  const cleaned = raw.trim();

  // Direct match
  if (COD_GAME_MODES[cleaned]) {
    return { full: cleaned, short: COD_GAME_MODES[cleaned] };
  }

  // Case-insensitive search
  const lower = cleaned.toLowerCase();
  if (lower.includes('hardpoint') || lower === 'hp') {
    return { full: 'Hardpoint', short: 'HP' };
  }
  if (lower.includes('search') || lower.includes('s&d') || lower === 'snd') {
    return { full: 'Search & Destroy', short: 'S&D' };
  }
  if (lower.includes('control') || lower === 'ctl') {
    return { full: 'Control', short: 'CTL' };
  }

  return { full: cleaned, short: cleaned.substring(0, 3).toUpperCase() };
}

/**
 * Parse match detail from a Liquipedia match page HTML.
 *
 * Liquipedia match pages use the "bracket popup" template system.
 * The key structures we look for:
 *
 * Pattern 1 (modern bracket popup):
 *   <div class="brkts-popup-body-game">
 *     <div>...mode...</div>
 *     <div>...map link or text...</div>
 *     <div>...scores...</div>
 *   </div>
 *
 * Pattern 2 (match page with infobox):
 *   A table or div structure with rows for each map showing:
 *   Map | Mode | Score1 | Score2
 *
 * Pattern 3 (match summary table):
 *   <table class="wikitable">
 *     <tr><th>Map</th><th>Mode</th><th>Team1</th><th>Team2</th></tr>
 *     <tr><td>Karachi</td><td>Hardpoint</td><td>250</td><td>200</td></tr>
 *   </table>
 */
function parseMatchPageForMaps(html: string): CodMapData[] {
  const maps: CodMapData[] = [];

  // ── Strategy 1: Parse bracket popup game divs ──
  const gameBlocks = extractBracketPopupGames(html);
  if (gameBlocks.length > 0) {
    for (let i = 0; i < gameBlocks.length; i++) {
      const parsed = parseBracketGameBlock(gameBlocks[i], i + 1);
      if (parsed) maps.push(parsed);
    }
    if (maps.length > 0) return maps;
  }

  // ── Strategy 2: Parse wikitable match summary ──
  const tableMaps = parseMatchSummaryTable(html);
  if (tableMaps.length > 0) return tableMaps;

  // ── Strategy 3: Parse infobox-style match data ──
  const infoboxMaps = parseInlineMatchData(html);
  if (infoboxMaps.length > 0) return infoboxMaps;

  return maps;
}

/**
 * Extract individual game blocks from bracket popup HTML.
 * Each game in the series is inside a `brkts-popup-body-game` div.
 */
function extractBracketPopupGames(html: string): string[] {
  const blocks: string[] = [];

  // Find all game divs (they can be nested, so we handle manually)
  const marker = 'brkts-popup-body-game';
  let searchStart = 0;

  while (true) {
    const idx = html.indexOf(marker, searchStart);
    if (idx === -1) break;

    // Find the opening <div that contains this class
    let divStart = html.lastIndexOf('<div', idx);
    if (divStart === -1) {
      searchStart = idx + marker.length;
      continue;
    }

    // Find matching closing </div> (tracking nesting)
    let depth = 0;
    let pos = divStart;
    let blockEnd = -1;

    while (pos < html.length) {
      const openDiv = html.indexOf('<div', pos);
      const closeDiv = html.indexOf('</div>', pos);

      if (closeDiv === -1) break;

      if (openDiv !== -1 && openDiv < closeDiv) {
        depth++;
        pos = openDiv + 4;
      } else {
        depth--;
        if (depth <= 0) {
          blockEnd = closeDiv + 6;
          break;
        }
        pos = closeDiv + 6;
      }
    }

    if (blockEnd > divStart) {
      blocks.push(html.substring(divStart, blockEnd));
    }

    searchStart = blockEnd > 0 ? blockEnd : idx + marker.length;
  }

  return blocks;
}

/**
 * Parse a single bracket game block for map, mode, and scores.
 */
function parseBracketGameBlock(blockHtml: string, gameNumber: number): CodMapData | null {
  let mapName = '';
  let gameMode = '';
  let homeScore: number | undefined;
  let awayScore: number | undefined;
  let winnerId: 'home' | 'away' | undefined;

  // ── Extract map name ──
  // Look for links to map pages (e.g. <a href="/callofduty/Karachi" title="Karachi">Karachi</a>)
  const mapLinkMatch = blockHtml.match(
    /<a\s+[^>]*href="\/callofduty\/([^"]*)"[^>]*title="([^"]*)"[^>]*>([^<]+)<\/a>/i,
  );
  if (mapLinkMatch) {
    mapName = decodeHtmlEntities(mapLinkMatch[3]).trim();
    // Exclude team name links, mode links, etc.
    if (mapName.toLowerCase() === 'koi' || mapName.length < 3) {
      mapName = '';
    }
  }

  // Fallback: look for known map names in text
  if (!mapName) {
    const knownMaps = [
      'Karachi', 'Terminal', 'Skidrow', 'Invasion', 'Highrise', 'Sub Base',
      'Hacienda', 'Rewind', 'Vault', 'Protocol', 'Red Card',
      'Babylon', 'Payback', 'Nuketown', 'Skyline', 'Striker',
      'Athens', 'Hideout', 'Warhead', 'Departures', 'Compound',
    ];
    const blockText = stripHtml(blockHtml).toLowerCase();
    for (const map of knownMaps) {
      if (blockText.includes(map.toLowerCase())) {
        mapName = map;
        break;
      }
    }
  }

  // ── Extract game mode ──
  // Look for mode keywords in text
  const blockText = stripHtml(blockHtml);
  const modePatterns = [
    /\b(Hardpoint|HP)\b/i,
    /\b(Search\s*(?:&|and)\s*Destroy|S&D|SnD|SND)\b/i,
    /\b(Control|CTL)\b/i,
  ];

  for (const pattern of modePatterns) {
    const modeMatch = blockText.match(pattern);
    if (modeMatch) {
      const normalized = normalizeGameMode(modeMatch[1]);
      gameMode = normalized.full;
      break;
    }
  }

  // Also check for mode in HTML class names or data attributes
  if (!gameMode) {
    const modeClassMatch = blockHtml.match(/data-mode="([^"]+)"/i);
    if (modeClassMatch) {
      const normalized = normalizeGameMode(modeClassMatch[1]);
      gameMode = normalized.full;
    }
  }

  // ── Extract scores ──
  // Scores are typically in elements with score-related classes
  const scorePattern =
    /class="[^"]*(?:brkts-popup-body-game-team|score)[^"]*"[^>]*>\s*(\d+)\s*</gi;
  const scores: number[] = [];
  let scoreMatch: RegExpExecArray | null;
  while ((scoreMatch = scorePattern.exec(blockHtml)) !== null) {
    scores.push(parseInt(scoreMatch[1], 10));
  }

  // Fallback: look for score divs or spans with just numbers
  if (scores.length < 2) {
    const simpleScorePattern =
      /<(?:div|span|td)[^>]*>\s*(\d{1,3})\s*<\/(?:div|span|td)>/gi;
    const candidates: number[] = [];
    let simpleMatch: RegExpExecArray | null;
    while ((simpleMatch = simpleScorePattern.exec(blockHtml)) !== null) {
      const value = parseInt(simpleMatch[1], 10);
      // Filter reasonable CoD scores
      if (isReasonableCodScore(value, gameMode)) {
        candidates.push(value);
      }
    }
    // Take first two reasonable scores
    if (candidates.length >= 2 && scores.length === 0) {
      scores.push(candidates[0], candidates[1]);
    }
  }

  if (scores.length >= 2) {
    homeScore = scores[0];
    awayScore = scores[1];
    if (homeScore > awayScore) winnerId = 'home';
    else if (awayScore > homeScore) winnerId = 'away';
  }

  // Need at least a map or mode to be useful
  if (!mapName && !gameMode) return null;

  const modeInfo = gameMode
    ? normalizeGameMode(gameMode)
    : { full: 'Unknown', short: '?' };

  return {
    gameNumber,
    mapName: mapName || 'Unknown Map',
    gameMode: modeInfo.full,
    gameModeShort: modeInfo.short,
    homeScore,
    awayScore,
    winnerId,
  };
}

/**
 * Check if a numeric value is a reasonable score for a given CoD game mode.
 */
function isReasonableCodScore(value: number, mode: string): boolean {
  if (value === 0) return true; // 0 is always reasonable

  switch (mode.toLowerCase()) {
    case 'hardpoint':
    case 'hp':
      return value >= 1 && value <= 250;
    case 'search & destroy':
    case 'search and destroy':
    case 's&d':
    case 'snd':
      return value >= 0 && value <= 6;
    case 'control':
    case 'ctl':
      return value >= 0 && value <= 3;
    default:
      return value >= 0 && value <= 250;
  }
}

/**
 * Strategy 2: Parse a wikitable-style match summary.
 *
 * Some match pages put map/mode data in a standard HTML table:
 *   | # | Mode | Map | Score1 | Score2 | Winner |
 */
function parseMatchSummaryTable(html: string): CodMapData[] {
  const maps: CodMapData[] = [];

  // Find tables that look like match summaries
  const tableRegex =
    /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];

    // Check if this table has map/mode headers
    const headerText = stripHtml(tableHtml.substring(0, 500)).toLowerCase();
    if (!headerText.includes('map') && !headerText.includes('mode')) continue;

    // Parse rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    let gameNum = 1;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      if (rowHtml.includes('<th')) continue; // Skip header rows

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(stripHtml(cellMatch[1]));
      }

      if (cells.length < 3) continue;

      // Try to identify map, mode, and scores from cells
      let mapName = '';
      let mode = '';
      const scores: number[] = [];

      for (const cell of cells) {
        if (!mapName && cell.length > 3 && !cell.match(/^\d+$/)) {
          // Check if it's a mode
          const modeCheck = normalizeGameMode(cell);
          if (
            modeCheck.full !== cell ||
            ['Hardpoint', 'Search & Destroy', 'Control'].includes(modeCheck.full)
          ) {
            if (!mode) mode = modeCheck.full;
            else if (!mapName) mapName = cell;
          } else {
            mapName = cell;
          }
        } else if (cell.match(/^\d+$/)) {
          scores.push(parseInt(cell, 10));
        }
      }

      if (mapName || mode) {
        const modeInfo = mode
          ? normalizeGameMode(mode)
          : { full: 'Unknown', short: '?' };

        maps.push({
          gameNumber: gameNum++,
          mapName: mapName || 'Unknown Map',
          gameMode: modeInfo.full,
          gameModeShort: modeInfo.short,
          homeScore: scores[0],
          awayScore: scores[1],
          winnerId:
            scores.length >= 2
              ? scores[0] > scores[1]
                ? 'home'
                : scores[1] > scores[0]
                  ? 'away'
                  : undefined
              : undefined,
        });
      }
    }

    if (maps.length > 0) break; // Use first matching table
  }

  return maps;
}

/**
 * Strategy 3: Parse inline match data from text patterns.
 *
 * Some pages format map data inline like:
 *   "Map 1: Hardpoint on Karachi (250-200)"
 */
function parseInlineMatchData(html: string): CodMapData[] {
  const maps: CodMapData[] = [];
  const text = stripHtml(html);

  // Pattern: "Map N: Mode on MapName (Score1-Score2)"
  const inlinePattern =
    /(?:Map|Game|Mapa)\s*(\d)?\s*:?\s*(Hardpoint|HP|Search\s*(?:&|and)\s*Destroy|S&D|SnD|Control|CTL)\s+(?:on\s+)?([A-Za-z\s]+?)\s*\(?(\d+)\s*[-–]\s*(\d+)\)?/gi;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text)) !== null) {
    const gameNum = match[1] ? parseInt(match[1], 10) : maps.length + 1;
    const modeInfo = normalizeGameMode(match[2]);
    const homeScore = parseInt(match[4], 10);
    const awayScore = parseInt(match[5], 10);

    maps.push({
      gameNumber: gameNum,
      mapName: match[3].trim(),
      gameMode: modeInfo.full,
      gameModeShort: modeInfo.short,
      homeScore,
      awayScore,
      winnerId:
        homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : undefined,
    });
  }

  return maps;
}

// ═══════════════════════════════════════════════════════════════════
// PARSING: KOI Team Page Match History
// ═══════════════════════════════════════════════════════════════════

interface MatchHistoryEntry {
  date: string;
  opponent: string;
  score: string;          // e.g., "3-1"
  matchPageSlug: string;  // e.g., "KOI_vs_FaZe/CDL/2026/Major_1"
  tournament: string;
}

/**
 * Parse KOI's match history from the team page.
 * The team page typically has a "Results" section with recent matches.
 */
function parseMatchHistoryFromTeamPage(html: string): MatchHistoryEntry[] {
  const entries: MatchHistoryEntry[] = [];

  // Look for match result links
  // KOI team pages have links to match pages in results tables
  const matchLinkRegex =
    /<a\s+[^>]*href="(\/callofduty\/[^"]*(?:vs|_v_)[^"]*KOI[^"]*|\/callofduty\/[^"]*KOI[^"]*(?:vs|_v_)[^"]*)"[^>]*>([^<]*)<\/a>/gi;

  let linkMatch: RegExpExecArray | null;
  const seenSlugs = new Set<string>();

  while ((linkMatch = matchLinkRegex.exec(html)) !== null) {
    const href = decodeHtmlEntities(linkMatch[1]);
    const slug = href.replace('/callofduty/', '');

    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    entries.push({
      date: '',
      opponent: '',
      score: '',
      matchPageSlug: slug,
      tournament: '',
    });
  }

  // Also try to find match data in results tables
  const tableRegex =
    /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const headerText = stripHtml(tableHtml.substring(0, 300)).toLowerCase();

    // Look for results/match history tables
    if (
      !headerText.includes('date') &&
      !headerText.includes('opponent') &&
      !headerText.includes('result')
    )
      continue;

    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      if (rowHtml.includes('<th')) continue;

      // Extract match page link from row
      const rowLinkMatch = rowHtml.match(
        /href="(\/callofduty\/[^"]*(?:vs|_v_)[^"]*)"[^>]*>/i,
      );

      if (rowLinkMatch) {
        const slug = decodeHtmlEntities(rowLinkMatch[1]).replace(
          '/callofduty/',
          '',
        );
        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug);

          // Try to extract date and opponent from cells
          const cells: string[] = [];
          const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
          let cellMatch: RegExpExecArray | null;
          while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
            cells.push(stripHtml(cellMatch[1]));
          }

          entries.push({
            date: cells[0] || '',
            opponent: '',
            score: '',
            matchPageSlug: slug,
            tournament: '',
          });
        }
      }
    }
  }

  return entries;
}

// ═══════════════════════════════════════════════════════════════════
// PARSING: CDL Tournament Page (bulk match data from brackets)
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse all KOI matches from a CDL tournament page.
 *
 * Tournament pages have bracket/group stages. Each match is in a
 * bracket popup with team names, series score, and per-map details.
 *
 * This is the most efficient way to get data — one page contains
 * many matches, unlike fetching each match page individually.
 */
function parseKoiMatchesFromTournamentPage(html: string): CodMatchDetail[] {
  const matches: CodMatchDetail[] = [];

  // Find all bracket popup containers
  const popupRegex =
    /<div[^>]*class="[^"]*brkts-popup[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*brkts-popup|$)/gi;

  // Alternative: split by popup markers
  const popupMarkers = html.split(/(?=<div[^>]*class="[^"]*brkts-popup(?!-))/i);

  for (const popupSection of popupMarkers) {
    if (!popupSection.includes('brkts-popup')) continue;

    // Check if KOI is in this match
    const sectionText = stripHtml(popupSection);
    if (!sectionText.includes(KOI_COD_TEAM_NAME)) continue;

    // Extract team names from header
    const headerMatch = popupSection.match(
      /class="[^"]*brkts-popup-header[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    );

    let team1 = '';
    let team2 = '';

    if (headerMatch) {
      // Teams are typically in separate spans or divs within the header
      const teamLinks = headerMatch[1].match(
        /<a[^>]*>([^<]+)<\/a>/gi,
      );
      if (teamLinks && teamLinks.length >= 2) {
        team1 = stripHtml(teamLinks[0]);
        team2 = stripHtml(teamLinks[teamLinks.length - 1]);
      }
    }

    // Fallback: Extract team names from opponent spans
    if (!team1 || !team2) {
      const opponentSpans = popupSection.match(
        /class="[^"]*(?:brkts-popup-header-opponent|team-template-text)[^"]*"[^>]*>[^<]*<a[^>]*>([^<]+)<\/a>/gi,
      );
      if (opponentSpans && opponentSpans.length >= 2) {
        team1 = stripHtml(opponentSpans[0]);
        team2 = stripHtml(opponentSpans[1]);
      }
    }

    // Parse per-map data
    const maps = parseMatchPageForMaps(popupSection);

    // Extract series score
    const scoreMatch = popupSection.match(
      /class="[^"]*brkts-popup-header-score[^"]*"[^>]*>\s*(\d+)\s*:\s*(\d+)/i,
    );

    if (team1 && team2) {
      matches.push({
        team1,
        team2,
        team1Score: scoreMatch ? parseInt(scoreMatch[1], 10) : undefined,
        team2Score: scoreMatch ? parseInt(scoreMatch[2], 10) : undefined,
        maps,
      });
    }
  }

  return matches;
}

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch map/mode enrichment data for a specific CoD match.
 *
 * Tries these sources in order:
 * 1. Cached match detail (if previously fetched)
 * 2. CDL tournament page (bulk — fetches one page with many matches)
 * 3. Individual match page (if we find a direct link)
 *
 * @param homeTeamName - Home team name (KOI or opponent)
 * @param awayTeamName - Away team name
 * @param matchDate - ISO date string (for matching)
 * @returns Array of CodMapData for each game in the series, or empty array
 */
export async function fetchCodMatchMaps(
  homeTeamName: string,
  awayTeamName: string,
  matchDate: string,
): Promise<CodMapData[]> {
  // Build a cache key from the teams + date
  const cacheKey = `cod-maps-${homeTeamName}-${awayTeamName}-${matchDate}`
    .toLowerCase()
    .replace(/\s+/g, '-');

  const cached = getCached<CodMapData[]>(cacheKey, MATCH_DETAIL_CACHE_TTL);
  if (cached) return cached;

  try {
    // Strategy 1: Try CDL tournament page (most efficient — one page, many matches)
    const tournamentMatches = await fetchKoiMatchesFromCurrentSeason();
    if (tournamentMatches.length > 0) {
      const matched = findMatchingMatch(
        tournamentMatches,
        homeTeamName,
        awayTeamName,
        matchDate,
      );

      if (matched && matched.maps.length > 0) {
        // Determine home/away orientation
        const koiIsTeam1 = isKoiTeamName(matched.team1);
        const koiIsHome =
          homeTeamName.toLowerCase().includes('koi') || isKoiTeamName(homeTeamName);
        const needsFlip = koiIsTeam1 !== koiIsHome;

        const oriented = needsFlip ? flipMapOrientation(matched.maps) : matched.maps;
        setCache(cacheKey, oriented);
        return oriented;
      }
    }

    // Strategy 2: Try fetching KOI team page for match links
    const matchHistory = await fetchKoiMatchHistory();
    for (const entry of matchHistory) {
      // Try to match by opponent name
      const slug = entry.matchPageSlug.toLowerCase();
      const opponentName = homeTeamName.toLowerCase().includes('koi')
        ? awayTeamName
        : homeTeamName;

      if (slug.includes(opponentName.toLowerCase().replace(/\s+/g, '_'))) {
        const matchHtml = await fetchPageHtml(entry.matchPageSlug);
        if (matchHtml) {
          const maps = parseMatchPageForMaps(matchHtml);
          if (maps.length > 0) {
            setCache(cacheKey, maps);
            return maps;
          }
        }
      }
    }

    console.log(`[Liquipedia CoD] No map data found for ${homeTeamName} vs ${awayTeamName}`);
    return [];
  } catch (error) {
    console.warn('[Liquipedia CoD] Error fetching match maps:', error);
    return [];
  }
}

/**
 * Enrich a PandaScore MatchGame array with Liquipedia map/mode data.
 *
 * This is the main entry point called from dataService.ts.
 * It takes the basic game array from PandaScore and adds
 * map names, game modes, and per-map scores.
 */
export async function enrichCodMatchGames(
  games: MatchGame[],
  homeTeamName: string,
  awayTeamName: string,
  matchDate: string,
): Promise<MatchGame[]> {
  if (!games || games.length === 0) return games;

  const mapData = await fetchCodMatchMaps(homeTeamName, awayTeamName, matchDate);
  if (mapData.length === 0) return games;

  return games.map((game) => {
    // Match by game number
    const lpMap = mapData.find((m) => m.gameNumber === game.number);
    if (!lpMap) return game;

    const enriched: MatchGame = { ...game };

    // Add map info
    if (lpMap.mapName && lpMap.mapName !== 'Unknown Map') {
      enriched.map = {
        id: `cod-map-${lpMap.mapName.toLowerCase().replace(/\s+/g, '-')}`,
        name: lpMap.mapName,
        imageUrl: getCodMapImageUrl(lpMap.mapName),
      };
    }

    // Add game mode
    if (lpMap.gameMode && lpMap.gameMode !== 'Unknown') {
      enriched.gameMode = lpMap.gameMode;
    }

    // Add per-map scores (if PandaScore doesn't have them)
    if (enriched.homeTeamScore === undefined && lpMap.homeScore !== undefined) {
      enriched.homeTeamScore = lpMap.homeScore;
    }
    if (enriched.awayTeamScore === undefined && lpMap.awayScore !== undefined) {
      enriched.awayTeamScore = lpMap.awayScore;
    }

    return enriched;
  });
}

// ─── Internal Helpers ───────────────────────────────────────────────

/** Fetch KOI matches from the current CDL tournament page (cached). */
async function fetchKoiMatchesFromCurrentSeason(): Promise<CodMatchDetail[]> {
  const cacheKey = 'cod-season-matches';
  const cached = getCached<CodMatchDetail[]>(cacheKey, TOURNAMENT_CACHE_TTL);
  if (cached) return cached;

  // Try current season page and its sub-pages (stages)
  const pages = [
    CDL_SEASON_PAGE,
    `${CDL_SEASON_PAGE}/Major_1`,
    `${CDL_SEASON_PAGE}/Major_2`,
    `${CDL_SEASON_PAGE}/Major_3`,
    `${CDL_SEASON_PAGE}/Stage_1`,
    `${CDL_SEASON_PAGE}/Stage_2`,
    `${CDL_SEASON_PAGE}/Stage_3`,
  ];

  const allMatches: CodMatchDetail[] = [];

  for (const page of pages) {
    const html = await fetchPageHtml(page);
    if (!html) continue;

    const matches = parseKoiMatchesFromTournamentPage(html);
    allMatches.push(...matches);

    // If we found matches on the main page, we might not need sub-pages
    if (allMatches.length > 3) break;
  }

  if (allMatches.length > 0) {
    setCache(cacheKey, allMatches);
  }

  return allMatches;
}

/** Fetch KOI's match history links from the team page (cached). */
async function fetchKoiMatchHistory(): Promise<MatchHistoryEntry[]> {
  const cacheKey = 'cod-match-history';
  const cached = getCached<MatchHistoryEntry[]>(cacheKey, TEAM_PAGE_CACHE_TTL);
  if (cached) return cached;

  const html = await fetchPageHtml('KOI');
  if (!html) return [];

  const entries = parseMatchHistoryFromTeamPage(html);
  if (entries.length > 0) {
    setCache(cacheKey, entries);
  }

  return entries;
}

/** Check if a team name refers to KOI */
function isKoiTeamName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return lower === 'koi' || lower.includes('movistar koi') || lower.includes('toronto koi');
}

/** Find the best matching match from tournament data */
function findMatchingMatch(
  matches: CodMatchDetail[],
  homeTeamName: string,
  awayTeamName: string,
  _matchDate: string,
): CodMatchDetail | null {
  const homeLower = homeTeamName.toLowerCase();
  const awayLower = awayTeamName.toLowerCase();

  // Try exact team name match
  for (const match of matches) {
    const t1Lower = match.team1.toLowerCase();
    const t2Lower = match.team2.toLowerCase();

    const homeMatches = t1Lower.includes(homeLower) || homeLower.includes(t1Lower);
    const awayMatches = t2Lower.includes(awayLower) || awayLower.includes(t2Lower);

    if (homeMatches && awayMatches) return match;

    // Try swapped
    const homeSwap = t1Lower.includes(awayLower) || awayLower.includes(t1Lower);
    const awaySwap = t2Lower.includes(homeLower) || homeLower.includes(t2Lower);

    if (homeSwap && awaySwap) return match;
  }

  // Fuzzy match: check if both team names appear anywhere
  for (const match of matches) {
    const combined = `${match.team1} ${match.team2}`.toLowerCase();
    if (combined.includes(homeLower) && combined.includes(awayLower)) return match;
  }

  return null;
}

/** Flip home/away orientation of map data */
function flipMapOrientation(maps: CodMapData[]): CodMapData[] {
  return maps.map((m) => ({
    ...m,
    homeScore: m.awayScore,
    awayScore: m.homeScore,
    winnerId:
      m.winnerId === 'home' ? 'away' : m.winnerId === 'away' ? 'home' : undefined,
  }));
}

/**
 * Get a map image URL for a CoD map.
 * Uses Liquipedia map images when available.
 */
function getCodMapImageUrl(mapName: string): string | undefined {
  // Liquipedia stores map images at predictable URLs
  const slug = mapName.replace(/\s+/g, '_');
  return `${COD_BASE_URL}/Special:FilePath/${slug}_Map_Icon.png`;
}

/** Clear all CoD enrichment caches */
export function clearCodCache(): void {
  for (const key of Object.keys(codCache)) {
    delete codCache[key];
  }
}
