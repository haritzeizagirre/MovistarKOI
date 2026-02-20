/**
 * start.gg Data Service
 *
 * Maps start.gg tournament data into the app's Tournament type.
 * Covers TFT and Pokémon VGC only (PandaScore handles LoL, Valorant, CoD).
 *
 * Strategy (in priority order):
 * 1. Query tournaments by KOI player user IDs (if configured in startgg config)
 * 2. Fetch specific tracked tournament slugs (if configured)
 * 3. Fall back to curated/mock tournament data (always available)
 *
 * This ensures only tournaments where KOI players participate are shown,
 * not every random community event for the videogame.
 */

import startGGClient, { StartGGTournament } from './startggApi';
import { Tournament, TournamentFormat, TournamentPhase, TournamentParticipant, Game } from '../types';
import {
  STARTGG_VIDEOGAME_IDS,
  STARTGG_PLAYER_USER_IDS,
  STARTGG_TRACKED_TOURNAMENT_SLUGS,
} from '../config/startgg';
import { staticTeams } from '../data/staticTeams';

// ─── Cache ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const sggCache: Record<string, CacheEntry<any>> = {};
const SGG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string, ttl = SGG_CACHE_TTL): T | null {
  const entry = sggCache[key];
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  sggCache[key] = { data, timestamp: Date.now() };
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Map start.gg videogame ID to our Game type */
function videogameIdToGame(vgId: number): Game | null {
  for (const [game, id] of Object.entries(STARTGG_VIDEOGAME_IDS)) {
    if (id === vgId) return game as Game;
  }
  return null;
}

/** Guess the game from a tournament's events */
function inferGameFromTournament(tournament: StartGGTournament): Game | null {
  if (tournament.events) {
    for (const event of tournament.events) {
      if (event.videogame?.id) {
        const game = videogameIdToGame(event.videogame.id);
        if (game) return game;
      }
      // Fallback: check event/videogame name
      const vgName = (event.videogame?.name || event.name || '').toLowerCase();
      if (vgName.includes('tft') || vgName.includes('teamfight')) return 'tft';
      if (vgName.includes('pokémon') || vgName.includes('pokemon') || vgName.includes('vgc')) return 'pokemon_vgc';
    }
  }
  // Fallback: check tournament name
  const tName = tournament.name.toLowerCase();
  if (tName.includes('tft') || tName.includes('teamfight')) return 'tft';
  if (tName.includes('pokémon') || tName.includes('pokemon') || tName.includes('vgc')) return 'pokemon_vgc';
  return null;
}

/**
 * Check if a tournament has at least one event for a game we care about.
 */
function hasRelevantEvent(tournament: StartGGTournament): boolean {
  return inferGameFromTournament(tournament) !== null;
}

/** Map a tournament's state to our MatchStatus */
function tournamentStateToStatus(state: number | null): 'upcoming' | 'live' | 'finished' {
  switch (state) {
    case 2: return 'live';    // Active
    case 3: return 'finished'; // Completed
    case 1: // Created
    default: return 'upcoming';
  }
}

/** Get the right static team ID for a game */
function getStaticTeamId(game: Game): string {
  switch (game) {
    case 'tft': return 'static-tft';
    case 'pokemon_vgc': return 'static-pokemon';
    default: return `static-${game}`;
  }
}

/** Get the KOI logo URL */
const KOI_LOGO = 'https://liquipedia.net/commons/images/thumb/5/54/KOI_2024_blue_allmode.png/600px-KOI_2024_blue_allmode.png';

/** Get tournament image URL from images array */
function getTournamentImage(tournament: StartGGTournament): string {
  if (tournament.images && tournament.images.length > 0) {
    const profile = tournament.images.find((img) => img.type === 'profile');
    return (profile || tournament.images[0]).url;
  }
  return '';
}

/** Get tournament URL on start.gg */
function getTournamentUrl(tournament: StartGGTournament): string {
  return `https://start.gg/${tournament.slug}`;
}

/** Determine tournament format based on the game */
function inferTournamentFormat(game: Game): TournamentFormat {
  switch (game) {
    case 'tft': return 'points_elimination';
    case 'pokemon_vgc': return 'swiss_to_bracket';
    default: return 'other';
  }
}

/** Build tournament phases from the event data and dates */
function buildPhases(tournament: StartGGTournament, game: Game): TournamentPhase[] {
  const phases: TournamentPhase[] = [];
  const status = tournamentStateToStatus(tournament.state);

  if (game === 'tft') {
    // TFT tournaments typically have elimination rounds over 2-3 days
    const startDate = tournament.startAt ? new Date(tournament.startAt * 1000) : null;
    const endDate = tournament.endAt ? new Date(tournament.endAt * 1000) : null;

    if (startDate && endDate) {
      const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      for (let d = 1; d <= Math.min(days, 3); d++) {
        let phaseName: string;
        let phaseDesc: string;
        if (d === 1) {
          phaseName = `Day ${d} — Open Lobbies`;
          phaseDesc = '8-player lobbies, points per placement. Bottom players eliminated.';
        } else if (d < days) {
          phaseName = `Day ${d} — Elimination`;
          phaseDesc = 'Remaining players compete. More eliminations.';
        } else {
          phaseName = `Day ${d} — Grand Finals`;
          phaseDesc = 'Final 8 players. First to checkmate (18-20 pts + Top 1).';
        }
        phases.push({
          name: phaseName,
          day: d,
          status: status === 'finished' ? 'finished' : status === 'live' ? (d === 1 ? 'live' : 'upcoming') : 'upcoming',
          description: phaseDesc,
        });
      }
    } else {
      phases.push({ name: 'Tournament', day: 1, status, description: 'Points-based elimination format.' });
    }
  } else if (game === 'pokemon_vgc') {
    // Pokémon VGC: Day 1 Swiss, Day 2 Top Cut
    phases.push({
      name: 'Day 1 — Swiss Rounds',
      day: 1,
      status: status === 'finished' ? 'finished' : status,
      description: 'Players matched by W/L record. Top players qualify to Day 2.',
    });
    phases.push({
      name: 'Day 2 — Top Cut',
      day: 2,
      status: status === 'finished' ? 'finished' : 'upcoming',
      description: 'Single elimination bracket until a champion is crowned.',
    });
  }

  return phases;
}

/** Get KOI participants from the static team data */
function getKoiParticipants(game: Game): TournamentParticipant[] {
  const team = staticTeams.find((t) => t.game === game);
  if (!team) return [];

  return team.members.map((player) => ({
    playerId: player.id,
    playerName: player.nickname,
    photoUrl: player.photoUrl,
  }));
}

/**
 * Map a start.gg tournament to our Tournament type.
 * For individual games (TFT, Pokemon VGC), we model the tournament
 * properly with phases, participants, and format info.
 */
function mapTournamentToTournament(sggTournament: StartGGTournament): Tournament | null {
  const game = inferGameFromTournament(sggTournament);
  if (!game) return null;

  const status = tournamentStateToStatus(sggTournament.state);
  const startAt = sggTournament.startAt
    ? new Date(sggTournament.startAt * 1000)
    : new Date();
  const endAt = sggTournament.endAt
    ? new Date(sggTournament.endAt * 1000)
    : undefined;

  // Location info
  const locationParts = [sggTournament.city, sggTournament.countryCode].filter(Boolean);
  const location = locationParts.length > 0
    ? locationParts.join(', ')
    : (sggTournament.isOnline ? 'Online' : undefined);

  // Get total participants from events
  const totalParticipants = sggTournament.numAttendees
    ?? sggTournament.events?.reduce((sum, e) => sum + (e.numEntrants || 0), 0)
    ?? undefined;

  return {
    id: `sgg-${sggTournament.id}`,
    teamId: getStaticTeamId(game),
    game,
    name: sggTournament.name,
    location,
    startDate: startAt.toISOString().split('T')[0],
    endDate: endAt ? endAt.toISOString().split('T')[0] : undefined,
    time: startAt.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    status,
    format: inferTournamentFormat(game),
    totalParticipants,
    phases: buildPhases(sggTournament, game),
    koiParticipants: getKoiParticipants(game),
    streamUrl: status === 'live' ? getTournamentUrl(sggTournament) : undefined,
    imageUrl: getTournamentImage(sggTournament),
    externalUrl: getTournamentUrl(sggTournament),
  };
}

// ─── Core fetch: by player IDs, then by slug, else empty ──────────

/**
 * Check if we have any player-based or slug-based config for start.gg.
 * If not, the caller should fall back to curated data.
 */
export function hasStartGGSources(): boolean {
  const hasPlayers = Object.values(STARTGG_PLAYER_USER_IDS).some((ids) => ids.length > 0);
  const hasSlugs = Object.values(STARTGG_TRACKED_TOURNAMENT_SLUGS).some((slugs) => slugs.length > 0);
  return startGGClient.isConfigured() && (hasPlayers || hasSlugs);
}

/**
 * Fetch all KOI-related tournaments from start.gg.
 * Queries by player user ID (if available) and by tracked slugs.
 * Deduplicates and returns unified list.
 */
async function fetchKoiTournaments(): Promise<StartGGTournament[]> {
  if (!startGGClient.isConfigured()) return [];

  const seenIds = new Set<number>();
  const allTournaments: StartGGTournament[] = [];

  // 1. Query by player user IDs
  const playerIds = Object.values(STARTGG_PLAYER_USER_IDS).flat();
  if (playerIds.length > 0) {
    console.log('[startggDataService] querying tournaments for', playerIds.length, 'player(s)');
    const playerPromises = playerIds.map((uid) =>
      startGGClient.getUserTournaments(uid, 1, 15).catch((e) => {
        console.warn(`[startggDataService] failed for user ${uid}:`, e);
        return [] as StartGGTournament[];
      })
    );
    const results = await Promise.all(playerPromises);
    for (const tournaments of results) {
      for (const t of tournaments) {
        if (!seenIds.has(t.id) && hasRelevantEvent(t)) {
          seenIds.add(t.id);
          allTournaments.push(t);
        }
      }
    }
  }

  // 2. Fetch specific tracked tournament slugs
  const slugs = Object.values(STARTGG_TRACKED_TOURNAMENT_SLUGS).flat();
  if (slugs.length > 0) {
    console.log('[startggDataService] fetching', slugs.length, 'tracked slug(s)');
    const slugPromises = slugs.map((slug) =>
      startGGClient.getTournamentBySlug(slug).catch((e) => {
        console.warn(`[startggDataService] failed for slug ${slug}:`, e);
        return null;
      })
    );
    const results = await Promise.all(slugPromises);
    for (const t of results) {
      if (t && !seenIds.has(t.id) && hasRelevantEvent(t)) {
        seenIds.add(t.id);
        allTournaments.push(t);
      }
    }
  }

  console.log('[startggDataService] total KOI tournaments found:', allTournaments.length);
  return allTournaments;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Check if start.gg API is configured
 */
export function isStartGGConfigured(): boolean {
  return startGGClient.isConfigured();
}

/**
 * Fetch upcoming tournaments where KOI players participate.
 * Returns [] if no player IDs or slugs are configured (caller falls back to curated data).
 */
export async function sggFetchUpcomingTournaments(): Promise<Tournament[]> {
  if (!hasStartGGSources()) return [];

  const cacheKey = 'sgg-upcoming';
  const cached = getCached<Tournament[]>(cacheKey);
  if (cached) return cached;

  try {
    const all = await fetchKoiTournaments();
    const result = all
      .filter((t) => t.state === 1) // Created = upcoming
      .map(mapTournamentToTournament)
      .filter((t): t is Tournament => t !== null)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('Error fetching upcoming tournaments from start.gg:', error);
    return [];
  }
}

/**
 * Fetch past/completed tournaments where KOI players participated.
 * Returns [] if no player IDs or slugs are configured.
 */
export async function sggFetchPastTournaments(): Promise<Tournament[]> {
  if (!hasStartGGSources()) return [];

  const cacheKey = 'sgg-past';
  const cached = getCached<Tournament[]>(cacheKey);
  if (cached) return cached;

  try {
    const all = await fetchKoiTournaments();
    const result = all
      .filter((t) => t.state === 3) // Completed
      .map(mapTournamentToTournament)
      .filter((t): t is Tournament => t !== null)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('Error fetching past tournaments from start.gg:', error);
    return [];
  }
}

/**
 * Fetch live/active tournaments where KOI players are competing.
 * Returns [] if no player IDs or slugs are configured.
 */
export async function sggFetchLiveTournaments(): Promise<Tournament[]> {
  if (!hasStartGGSources()) return [];

  const cacheKey = 'sgg-live';
  const cached = getCached<Tournament[]>(cacheKey, 60 * 1000);
  if (cached) return cached;

  try {
    const all = await fetchKoiTournaments();
    const result = all
      .filter((t) => t.state === 2) // Active/live
      .map(mapTournamentToTournament)
      .filter((t): t is Tournament => t !== null);

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('Error fetching live tournaments from start.gg:', error);
    return [];
  }
}

/**
 * Fetch tournaments relevant to a specific team.
 * Returns [] if no player IDs or slugs are configured.
 */
export async function sggFetchTournamentsByTeam(teamId: string): Promise<Tournament[]> {
  if (!hasStartGGSources()) return [];

  // Determine which game this team belongs to
  let game: Game | null = null;
  if (teamId === 'static-tft') game = 'tft';
  else if (teamId === 'static-pokemon') game = 'pokemon_vgc';
  if (!game) return [];

  const cacheKey = `sgg-team-${teamId}`;
  const cached = getCached<Tournament[]>(cacheKey);
  if (cached) return cached;

  try {
    const all = await fetchKoiTournaments();
    const result = all
      .map(mapTournamentToTournament)
      .filter((t): t is Tournament => t !== null && t.game === game)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn(`Error fetching tournaments for team ${teamId}:`, error);
    return [];
  }
}

// ─── Legacy Match API wrappers (kept for backward compat) ──────────

/** @deprecated Use sggFetchUpcomingTournaments instead */
export async function sggFetchUpcomingMatches(): Promise<never[]> { return []; }
/** @deprecated Use sggFetchPastTournaments instead */
export async function sggFetchPastMatches(): Promise<never[]> { return []; }
/** @deprecated Use sggFetchLiveTournaments instead */
export async function sggFetchLiveMatches(): Promise<never[]> { return []; }
/** @deprecated Use sggFetchTournamentsByTeam instead */
export async function sggFetchMatchesByTeam(_teamId: string): Promise<never[]> { return []; }
