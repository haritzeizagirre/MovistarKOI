/**
 * start.gg Data Service
 *
 * Maps start.gg tournament data into the app's Match type.
 * Covers TFT and Pokémon VGC only (PandaScore handles LoL, Valorant, CoD).
 *
 * Strategy:
 * - Upcoming tournaments → shown as upcoming matches in the calendar
 * - Completed tournaments → shown as results
 * - KOI participation is detected by checking entrant/participant names
 */

import startGGClient, { StartGGTournament } from './startggApi';
import { Match, Game } from '../types';
import {
  STARTGG_VIDEOGAME_IDS,
  STARTGG_TOP_TOURNAMENT_KEYWORDS,
} from '../config/startgg';

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
 * Check if a tournament is a top-tier (regional / international) event.
 * Matches the tournament name against the keyword list for its game.
 * If no keywords are configured for the game, all tournaments pass.
 */
function isTopTierTournament(tournament: StartGGTournament): boolean {
  const game = inferGameFromTournament(tournament);
  if (!game) return false;

  const keywords = STARTGG_TOP_TOURNAMENT_KEYWORDS[game];
  if (!keywords || keywords.length === 0) return true; // no filter configured → allow all

  const name = tournament.name.toLowerCase();
  return keywords.some((kw) => name.includes(kw));
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
    // Prefer profile type, fallback to first available
    const profile = tournament.images.find((img) => img.type === 'profile');
    return (profile || tournament.images[0]).url;
  }
  return '';
}

/** Get tournament URL on start.gg */
function getTournamentUrl(tournament: StartGGTournament): string {
  return `https://start.gg/${tournament.slug}`;
}

/**
 * Map a start.gg tournament to our Match type.
 * For individual games (TFT, Pokemon VGC), we treat the tournament
 * as a "match" where KOI competes against the field.
 */
function mapTournamentToMatch(tournament: StartGGTournament): Match | null {
  const game = inferGameFromTournament(tournament);
  if (!game) return null;

  const status = tournamentStateToStatus(tournament.state);
  const startAt = tournament.startAt
    ? new Date(tournament.startAt * 1000)
    : new Date();

  // Location info for the tournament
  const locationParts = [tournament.city, tournament.countryCode].filter(Boolean);
  const location = locationParts.length > 0 ? locationParts.join(', ') : (tournament.isOnline ? 'Online' : '');
  const tournamentLabel = location ? `${tournament.name} — ${location}` : tournament.name;

  return {
    id: `sgg-${tournament.id}`,
    teamId: getStaticTeamId(game),
    game,
    tournament: tournamentLabel,
    date: startAt.toISOString().split('T')[0],
    time: startAt.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    status,
    homeTeam: {
      name: 'KOI',
      tag: 'KOI',
      logoUrl: KOI_LOGO,
      score: undefined, // KOI placement could be set from standings
    },
    awayTeam: {
      name: tournament.name,
      tag: 'TRN',
      logoUrl: getTournamentImage(tournament),
      score: tournament.numAttendees || undefined, // Show attendee count as context
    },
    bestOf: 1, // Tournaments are single events
    streamUrl: getTournamentUrl(tournament),
  };
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Check if start.gg API is configured
 */
export function isStartGGConfigured(): boolean {
  return startGGClient.isConfigured();
}

/**
 * Fetch upcoming tournaments for TFT and Pokémon VGC
 */
export async function sggFetchUpcomingMatches(): Promise<Match[]> {
  if (!startGGClient.isConfigured()) return [];

  const cacheKey = 'sgg-upcoming';
  const cached = getCached<Match[]>(cacheKey);
  if (cached) return cached;

  try {
    const videogameIds = Object.values(STARTGG_VIDEOGAME_IDS);
    const { tournaments } = await startGGClient.getUpcomingTournaments(videogameIds, 1, 10);

    const matches = tournaments
      .filter(isTopTierTournament)
      .map(mapTournamentToMatch)
      .filter((m): m is Match => m !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setCache(cacheKey, matches);
    return matches;
  } catch (error) {
    console.warn('Error fetching upcoming tournaments from start.gg:', error);
    return [];
  }
}

/**
 * Fetch past/completed tournaments for TFT and Pokémon VGC
 */
export async function sggFetchPastMatches(): Promise<Match[]> {
  if (!startGGClient.isConfigured()) return [];

  const cacheKey = 'sgg-past';
  const cached = getCached<Match[]>(cacheKey);
  if (cached) return cached;

  try {
    const videogameIds = Object.values(STARTGG_VIDEOGAME_IDS);
    const { tournaments } = await startGGClient.getPastTournaments(videogameIds, 1, 10);

    const matches = tournaments
      .filter(isTopTierTournament)
      .map(mapTournamentToMatch)
      .filter((m): m is Match => m !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setCache(cacheKey, matches);
    return matches;
  } catch (error) {
    console.warn('Error fetching past tournaments from start.gg:', error);
    return [];
  }
}

/**
 * Fetch live/active tournaments for TFT and Pokémon VGC.
 * start.gg marks in-progress tournaments with state=2.
 * These are included in upcoming tournaments response,
 * so we filter for state === 2.
 */
export async function sggFetchLiveMatches(): Promise<Match[]> {
  if (!startGGClient.isConfigured()) return [];

  const cacheKey = 'sgg-live';
  const cached = getCached<Match[]>(cacheKey, 60 * 1000); // 1 minute TTL
  if (cached) return cached;

  try {
    const videogameIds = Object.values(STARTGG_VIDEOGAME_IDS);
    // Fetch upcoming which includes active tournaments
    const { tournaments } = await startGGClient.getUpcomingTournaments(videogameIds, 1, 10);

    const matches = tournaments
      .filter((t) => t.state === 2) // Active/live only
      .filter(isTopTierTournament)
      .map(mapTournamentToMatch)
      .filter((m): m is Match => m !== null);

    setCache(cacheKey, matches);
    return matches;
  } catch (error) {
    console.warn('Error fetching live tournaments from start.gg:', error);
    return [];
  }
}

/**
 * Fetch tournaments relevant to a specific team (by game).
 * For static teams (TFT / Pokemon), we query start.gg for that game's tournaments.
 */
export async function sggFetchMatchesByTeam(teamId: string): Promise<Match[]> {
  if (!startGGClient.isConfigured()) return [];

  // Determine which game this team belongs to
  let videogameIds: number[] = [];
  if (teamId === 'static-tft' && STARTGG_VIDEOGAME_IDS.tft) {
    videogameIds = [STARTGG_VIDEOGAME_IDS.tft];
  } else if (teamId === 'static-pokemon' && STARTGG_VIDEOGAME_IDS.pokemon_vgc) {
    videogameIds = [STARTGG_VIDEOGAME_IDS.pokemon_vgc];
  } else {
    return []; // Not a start.gg-tracked team
  }

  const cacheKey = `sgg-team-${teamId}`;
  const cached = getCached<Match[]>(cacheKey);
  if (cached) return cached;

  try {
    const [upcoming, past] = await Promise.all([
      startGGClient.getUpcomingTournaments(videogameIds, 1, 10),
      startGGClient.getPastTournaments(videogameIds, 1, 10),
    ]);

    const allTournaments = [...upcoming.tournaments, ...past.tournaments];
    const matches = allTournaments
      .filter(isTopTierTournament)
      .map(mapTournamentToMatch)
      .filter((m): m is Match => m !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setCache(cacheKey, matches);
    return matches;
  } catch (error) {
    console.warn(`Error fetching tournaments for team ${teamId} from start.gg:`, error);
    return [];
  }
}
