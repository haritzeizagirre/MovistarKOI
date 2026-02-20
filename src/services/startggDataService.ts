/**
 * Tournament Data Service
 *
 * Provides TFT and Pokemon VGC tournament data for KOI players.
 *
 * Primary source: Liquipedia API (automated)
 * - Parses KOI team pages on Liquipedia to extract tournament results
 * - Automatically picks up new results as they appear on Liquipedia
 *
 * Fallback source: Curated tournament data (src/data/curatedTournaments.ts)
 * - Used when Liquipedia is unreachable or for upcoming tournaments
 * - Upcoming events that haven't happened yet won't appear on Liquipedia,
 *   so they must still be added manually to curatedTournaments.ts
 *
 * Tertiary source (optional): start.gg API
 * - Only used when player user IDs or tournament slugs are configured
 * - Results are merged (no duplicates)
 */

import startGGClient, { StartGGTournament } from './startggApi';
import { Tournament, TournamentFormat, TournamentPhase, TournamentParticipant, Game, MatchStatus } from '../types';
import {
  STARTGG_VIDEOGAME_IDS,
  STARTGG_PLAYER_USER_IDS,
  STARTGG_TRACKED_TOURNAMENT_SLUGS,
} from '../config/startgg';
import { staticTeams } from '../data/staticTeams';
import {
  allCuratedTournaments,
  getCuratedTournamentsByStatus,
  getCuratedTournamentsByTeam,
  getCuratedTournamentById,
} from '../data/curatedTournaments';
import {
  fetchAllLiquipediaTournaments,
  fetchLiquipediaTournamentsByGame,
  clearLiquipediaCache,
} from './liquipediaService';

// --- Cache ---------------------------------------------------------------

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

// --- start.gg helpers (kept for optional supplement) ---------------------

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
      const vgName = (event.videogame?.name || event.name || '').toLowerCase();
      if (vgName.includes('tft') || vgName.includes('teamfight')) return 'tft';
      if (vgName.includes('pokemon') || vgName.includes('vgc')) return 'pokemon_vgc';
    }
  }
  const tName = tournament.name.toLowerCase();
  if (tName.includes('tft') || tName.includes('teamfight')) return 'tft';
  if (tName.includes('pokemon') || tName.includes('vgc')) return 'pokemon_vgc';
  return null;
}

function hasRelevantEvent(tournament: StartGGTournament): boolean {
  return inferGameFromTournament(tournament) !== null;
}

function tournamentStateToStatus(state: number | null): MatchStatus {
  switch (state) {
    case 2: return 'live';
    case 3: return 'finished';
    default: return 'upcoming';
  }
}

function getStaticTeamId(game: Game): string {
  switch (game) {
    case 'tft': return 'static-tft';
    case 'pokemon_vgc': return 'static-pokemon';
    default: return `static-${game}`;
  }
}

function inferTournamentFormat(game: Game): TournamentFormat {
  switch (game) {
    case 'tft': return 'points_elimination';
    case 'pokemon_vgc': return 'swiss_to_bracket';
    default: return 'other';
  }
}

function getTournamentImage(tournament: StartGGTournament): string {
  if (tournament.images && tournament.images.length > 0) {
    const profile = tournament.images.find((img) => img.type === 'profile');
    return (profile || tournament.images[0]).url;
  }
  return '';
}

function getTournamentUrl(tournament: StartGGTournament): string {
  return `https://start.gg/${tournament.slug}`;
}

function buildPhases(tournament: StartGGTournament, game: Game): TournamentPhase[] {
  const status = tournamentStateToStatus(tournament.state);
  const phases: TournamentPhase[] = [];

  if (game === 'tft') {
    const startDate = tournament.startAt ? new Date(tournament.startAt * 1000) : null;
    const endDate = tournament.endAt ? new Date(tournament.endAt * 1000) : null;
    if (startDate && endDate) {
      const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      for (let d = 1; d <= Math.min(days, 3); d++) {
        const phaseName = d === 1 ? 'Day 1 - Open Lobbies'
          : d < days ? `Day ${d} - Elimination`
          : `Day ${d} - Grand Finals`;
        phases.push({
          name: phaseName,
          day: d,
          status: status === 'finished' ? 'finished' : 'upcoming',
          description: d === 1 ? '8-player lobbies. Bottom players eliminated.'
            : d < days ? 'Remaining players compete.'
            : 'Final 8 players.',
        });
      }
    } else {
      phases.push({ name: 'Tournament', day: 1, status, description: 'Points-based elimination.' });
    }
  } else if (game === 'pokemon_vgc') {
    phases.push({
      name: 'Day 1 - Swiss Rounds', day: 1,
      status: status === 'finished' ? 'finished' : status,
      description: 'Players matched by W/L record.',
    });
    phases.push({
      name: 'Day 2 - Top Cut', day: 2,
      status: status === 'finished' ? 'finished' : 'upcoming',
      description: 'Single elimination bracket.',
    });
  }
  return phases;
}

function getKoiParticipants(game: Game): TournamentParticipant[] {
  const team = staticTeams.find((t) => t.game === game);
  if (!team) return [];
  return team.members.map((player) => ({
    playerId: player.id,
    playerName: player.nickname,
    photoUrl: player.photoUrl,
  }));
}

/** Map a start.gg tournament to our Tournament type */
function mapSGGTournament(sggTournament: StartGGTournament): Tournament | null {
  const game = inferGameFromTournament(sggTournament);
  if (!game) return null;

  const status = tournamentStateToStatus(sggTournament.state);
  const startAt = sggTournament.startAt ? new Date(sggTournament.startAt * 1000) : new Date();
  const endAt = sggTournament.endAt ? new Date(sggTournament.endAt * 1000) : undefined;

  const locationParts = [sggTournament.city, sggTournament.countryCode].filter(Boolean);
  const location = locationParts.length > 0
    ? locationParts.join(', ')
    : (sggTournament.isOnline ? 'Online' : undefined);

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
    time: startAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
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

// --- start.gg targeted fetch (only with player IDs / slugs) --------------

/** Check if we have player-based or slug-based config for start.gg */
function hasTargetedSources(): boolean {
  const hasPlayers = Object.values(STARTGG_PLAYER_USER_IDS).some((ids) => ids.length > 0);
  const hasSlugs = Object.values(STARTGG_TRACKED_TOURNAMENT_SLUGS).some((slugs) => slugs.length > 0);
  return hasPlayers || hasSlugs;
}

/**
 * Fetch KOI-specific tournaments from start.gg.
 * Only queries if player IDs or slugs are configured.
 * Does NOT fall back to broad videogame queries.
 */
async function fetchTargetedSGGTournaments(): Promise<Tournament[]> {
  if (!startGGClient.isConfigured() || !hasTargetedSources()) return [];

  const seenIds = new Set<number>();
  const results: StartGGTournament[] = [];

  // Player user IDs
  const playerIds = Object.values(STARTGG_PLAYER_USER_IDS).flat();
  if (playerIds.length > 0) {
    const promises = playerIds.map((uid) =>
      startGGClient.getUserTournaments(uid, 1, 15).catch(() => [] as StartGGTournament[])
    );
    for (const tournaments of await Promise.all(promises)) {
      for (const t of tournaments) {
        if (!seenIds.has(t.id) && hasRelevantEvent(t)) {
          seenIds.add(t.id);
          results.push(t);
        }
      }
    }
  }

  // Tracked slugs
  const slugs = Object.values(STARTGG_TRACKED_TOURNAMENT_SLUGS).flat();
  if (slugs.length > 0) {
    const promises = slugs.map((slug) =>
      startGGClient.getTournamentBySlug(slug).catch(() => null)
    );
    for (const t of await Promise.all(promises)) {
      if (t && !seenIds.has(t.id) && hasRelevantEvent(t)) {
        seenIds.add(t.id);
        results.push(t);
      }
    }
  }

  return results
    .map(mapSGGTournament)
    .filter((t): t is Tournament => t !== null);
}

// --- Merge sources (deduplicated by name) --------------------------------

/**
 * Merge multiple tournament arrays, deduplicating by normalized name.
 * Earlier sources have priority (first occurrence wins).
 */
function mergeTournaments(...sources: Tournament[][]): Tournament[] {
  const seen = new Set<string>();
  const result: Tournament[] = [];

  for (const source of sources) {
    for (const t of source) {
      const key = t.name.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(t);
      }
    }
  }

  return result;
}

/**
 * Fetch all Liquipedia tournaments with curated fallback.
 * Returns combined list: Liquipedia (auto) + curated-only upcoming entries.
 */
async function fetchLiquipediaWithFallback(): Promise<Tournament[]> {
  try {
    const lpTournaments = await fetchAllLiquipediaTournaments();

    if (lpTournaments.length > 0) {
      // Liquipedia worked — merge curated upcoming-only entries that aren't in LP
      const curatedUpcoming = getCuratedTournamentsByStatus('upcoming');
      return mergeTournaments(lpTournaments, curatedUpcoming);
    }
  } catch (error) {
    console.warn('[TournamentService] Liquipedia fetch failed, using curated fallback:', error);
  }

  // Full fallback to curated data
  return allCuratedTournaments;
}

// --- Public API ----------------------------------------------------------

/** Always returns true since we have curated data */
export function hasStartGGSources(): boolean {
  return true;
}

/** Check if start.gg API is configured */
export function isStartGGConfigured(): boolean {
  return startGGClient.isConfigured();
}

/**
 * Fetch upcoming tournaments.
 * Primary: Liquipedia + curated upcoming. Supplement: start.gg.
 */
export async function sggFetchUpcomingTournaments(): Promise<Tournament[]> {
  const cacheKey = 'tournaments-upcoming';
  const cached = getCached<Tournament[]>(cacheKey);
  if (cached) return cached;

  try {
    const allTournaments = await fetchLiquipediaWithFallback();
    const upcoming = allTournaments.filter((t) => t.status === 'upcoming');

    const sgg = await fetchTargetedSGGTournaments();
    const sggUpcoming = sgg.filter((t) => t.status === 'upcoming');

    const result = mergeTournaments(upcoming, sggUpcoming)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    if (result.length > 0) setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('Error fetching upcoming tournaments:', error);
    return getCuratedTournamentsByStatus('upcoming');
  }
}

/**
 * Fetch past/completed tournaments.
 * Primary: Liquipedia (auto-parsed). Fallback: curated data.
 */
export async function sggFetchPastTournaments(): Promise<Tournament[]> {
  const cacheKey = 'tournaments-past';
  const cached = getCached<Tournament[]>(cacheKey);
  if (cached) return cached;

  try {
    const allTournaments = await fetchLiquipediaWithFallback();
    const past = allTournaments.filter((t) => t.status === 'finished');

    const sgg = await fetchTargetedSGGTournaments();
    const sggPast = sgg.filter((t) => t.status === 'finished');

    const result = mergeTournaments(past, sggPast)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    if (result.length > 0) setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('Error fetching past tournaments:', error);
    return getCuratedTournamentsByStatus('finished');
  }
}

/**
 * Fetch live/active tournaments.
 * Primary: Liquipedia + curated. Supplement: start.gg.
 */
export async function sggFetchLiveTournaments(): Promise<Tournament[]> {
  const cacheKey = 'tournaments-live';
  const cached = getCached<Tournament[]>(cacheKey, 60 * 1000);
  if (cached) return cached;

  try {
    const allTournaments = await fetchLiquipediaWithFallback();
    const live = allTournaments.filter((t) => t.status === 'live');

    const sgg = await fetchTargetedSGGTournaments();
    const sggLive = sgg.filter((t) => t.status === 'live');

    const result = mergeTournaments(live, sggLive);
    if (result.length > 0) setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('Error fetching live tournaments:', error);
    return getCuratedTournamentsByStatus('live');
  }
}

/**
 * Fetch tournaments relevant to a specific team.
 * Primary: Liquipedia (auto). Fallback: curated data.
 */
export async function sggFetchTournamentsByTeam(teamId: string): Promise<Tournament[]> {
  if (teamId !== 'static-tft' && teamId !== 'static-pokemon') return [];

  const cacheKey = `tournaments-team-${teamId}`;
  const cached = getCached<Tournament[]>(cacheKey);
  if (cached) return cached;

  try {
    const game: Game = teamId === 'static-tft' ? 'tft' : 'pokemon_vgc';

    // Fetch from Liquipedia for this game + curated upcoming
    let gameTournaments: Tournament[];
    try {
      const lpTournaments = await fetchLiquipediaTournamentsByGame(game);
      if (lpTournaments.length > 0) {
        const curatedUpcoming = getCuratedTournamentsByTeam(teamId)
          .filter((t) => t.status === 'upcoming');
        gameTournaments = mergeTournaments(lpTournaments, curatedUpcoming);
      } else {
        gameTournaments = getCuratedTournamentsByTeam(teamId);
      }
    } catch {
      gameTournaments = getCuratedTournamentsByTeam(teamId);
    }

    const sgg = await fetchTargetedSGGTournaments();
    const sggForTeam = sgg.filter((t) => t.game === game);

    const result = mergeTournaments(gameTournaments, sggForTeam)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    if (result.length > 0) setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn(`Error fetching tournaments for team ${teamId}:`, error);
    return getCuratedTournamentsByTeam(teamId);
  }
}

// --- Legacy Match API wrappers (kept for backward compat) ----------------

/** @deprecated Use sggFetchUpcomingTournaments instead */
export async function sggFetchUpcomingMatches(): Promise<never[]> { return []; }
/** @deprecated Use sggFetchPastTournaments instead */
export async function sggFetchPastMatches(): Promise<never[]> { return []; }
/** @deprecated Use sggFetchLiveTournaments instead */
export async function sggFetchLiveMatches(): Promise<never[]> { return []; }
/** @deprecated Use sggFetchTournamentsByTeam instead */
export async function sggFetchMatchesByTeam(_teamId: string): Promise<never[]> { return []; }
