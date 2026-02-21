import pandaScoreAPI, {
  PandaTeam,
  PandaPlayer,
  PandaMatch,
  PandaStanding,
} from './pandascoreApi';
import { enrichCodMatchGames } from './liquipediaCodService';
import { Team, Player, Match, Game, MatchStatus, StaffMember, Tournament } from '../types';
import { PANDASCORE_API_KEY } from '../config/pandascore';
import { staticTeams } from '../data/staticTeams';
import {
  sggFetchUpcomingTournaments,
  sggFetchLiveTournaments,
  sggFetchPastTournaments,
  sggFetchTournamentsByTeam,
} from './startggDataService';
import { getCuratedTournamentById } from '../data/curatedTournaments';

// ─── Mapping helpers ───────────────────────────────────────────────

const pandaGameToAppGame = (slug: string): Game | null => {
  const map: Record<string, Game> = {
    'league-of-legends': 'league_of_legends',
    'LoL': 'league_of_legends',
    'valorant': 'valorant',
    'Valorant': 'valorant',
    'cod-mw': 'call_of_duty',
    'Call of Duty': 'call_of_duty',
  };
  return map[slug] || null;
};

const mapPandaPlayerToPlayer = (p: PandaPlayer, game: Game): Player => ({
  id: String(p.id),
  nickname: p.name || p.slug,
  firstName: p.first_name || '',
  lastName: p.last_name || '',
  role: p.role || 'Player',
  nationality: p.nationality?.toUpperCase() || 'N/A',
  photoUrl: p.image_url || `https://via.placeholder.com/200x200?text=${encodeURIComponent(p.name || p.slug)}`,
  age: p.age || undefined,
  socialLinks: undefined,
});

// Minimum roster size per game to be considered a valid team
const MIN_ROSTER_SIZE: Record<Game, number> = {
  league_of_legends: 5,
  valorant: 5,
  call_of_duty: 4,
  tft: 1,
  pokemon_vgc: 1,
};

const mapPandaTeamToTeam = (t: PandaTeam): Team | null => {
  const game = pandaGameToAppGame(t.current_videogame?.slug || '');
  if (!game) return null;

  // Filter out teams without enough players
  const playerCount = (t.players || []).length;
  if (playerCount < MIN_ROSTER_SIZE[game]) return null;

  // Division will be resolved dynamically from match data in fetchAllTeams
  const division = '';

  const players: Player[] = (t.players || []).map((p) => mapPandaPlayerToPlayer(p, game));

  return {
    id: `panda-${t.id}`,
    name: t.name,
    game,
    division,
    logoUrl: t.image_url || 'https://via.placeholder.com/200x200?text=KOI',
    description: `${t.name} — equipo profesional de ${t.current_videogame?.name || game} de Movistar KOI.`,
    members: players,
    socialLinks: {
      twitter: 'https://twitter.com/KOI',
      instagram: 'https://instagram.com/koi',
    },
  };
};

const mapPandaMatchStatus = (status: PandaMatch['status']): MatchStatus => {
  switch (status) {
    case 'running':
      return 'live';
    case 'finished':
      return 'finished';
    case 'not_started':
    default:
      return 'upcoming';
  }
};

const mapPandaMatchToMatch = (m: PandaMatch, koiTeamIds: number[]): Match | null => {
  const game = pandaGameToAppGame(m.videogame?.slug || '');
  if (!game) return null;

  if (m.opponents.length < 2) return null;

  const opponent1 = m.opponents[0].opponent;
  const opponent2 = m.opponents[1].opponent;

  // Determine which is KOI
  const koiIsFirst = koiTeamIds.includes(opponent1.id);
  const koiOpponent = koiIsFirst ? opponent1 : opponent2;
  const otherOpponent = koiIsFirst ? opponent2 : opponent1;

  // Get scores
  const koiResult = m.results.find((r) => r.team_id === koiOpponent.id);
  const otherResult = m.results.find((r) => r.team_id === otherOpponent.id);

  // Find stream URL
  const stream = m.streams_list?.find((s) => s.main) || m.streams_list?.[0];

  // Build tournament name
  const tournamentName = [
    m.league?.name,
    m.serie?.full_name || m.serie?.name,
  ]
    .filter(Boolean)
    .join(' — ') || m.tournament?.name || 'Unknown Tournament';

  const scheduledDate = m.scheduled_at || m.begin_at || new Date().toISOString();
  const dateObj = new Date(scheduledDate);

  return {
    id: `panda-match-${m.id}`,
    teamId: `panda-${koiOpponent.id}`,
    game,
    tournament: tournamentName,
    matchType: (() => {
      const type = m.tournament?.name;
      if (type && /playoff|knockout|bracket|final/i.test(type) && m.name) {
        // Use specific match name (e.g. "Grand Final", "Semi-final") if descriptive
        if (/final|semi|quarter|decider|bracket|round/i.test(m.name)) {
          return m.name;
        }
      }
      return type || undefined;
    })(),
    date: dateObj.toISOString().split('T')[0],
    time: dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
    status: mapPandaMatchStatus(m.status),
    homeTeam: {
      id: String(koiOpponent.id),
      name: koiOpponent.name,
      tag: koiOpponent.acronym || koiOpponent.name.substring(0, 3).toUpperCase(),
      logoUrl: koiOpponent.image_url || '',
      score: koiResult?.score,
    },
    awayTeam: {
      id: String(otherOpponent.id),
      name: otherOpponent.name,
      tag: otherOpponent.acronym || otherOpponent.name.substring(0, 3).toUpperCase(),
      logoUrl: otherOpponent.image_url || '',
      score: otherResult?.score,
    },
    bestOf: m.number_of_games || 1,
    streamUrl: stream?.raw_url || m.live?.url || undefined,
    games: m.games?.map((g) => ({
      id: String(g.id),
      number: g.position,
      status: mapPandaMatchStatus(g.status),
      winnerId: g.winner?.id ? String(g.winner.id) : undefined,
      length: g.length,
      beginAt: g.begin_at,
    })),
    _tournamentId: m.tournament?.id, // internal: used for standings lookup
    _serieId: m.serie?.id,           // internal: identifying the series
    _koiTeamId: koiOpponent.id,      // internal: used for standings lookup
    _opponentTeamId: otherOpponent.id, // internal: used for standings lookup
  } as Match & { _tournamentId?: number; _serieId?: number; _koiTeamId?: number; _opponentTeamId?: number };
};

// ─── Cache ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<any>> = {};
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes for most data
const CACHE_TTL_LIVE = 30 * 1000; // 30 seconds for live data

function getCached<T>(key: string, ttl = CACHE_TTL): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache[key] = { data, timestamp: Date.now() };
}

// ─── Stored KOI team IDs ──────────────────────────────────────────

let koiPandaTeamIds: number[] = [];
let koiPandaTeams: PandaTeam[] = [];

/**
 * Singleton promise for initialization — ensures only ONE set of API
 * calls runs even when many hooks call initializeKoiTeams concurrently.
 */
let _initPromise: Promise<void> | null = null;

// ─── Public Service ────────────────────────────────────────────────

const isApiConfigured = () => {
  const key: string = PANDASCORE_API_KEY;
  return key.length > 0 && key !== 'YOUR_PANDASCORE_API_TOKEN';
};

/**
 * Initialize: discover KOI teams on PandaScore.
 * Uses a singleton promise so concurrent callers share the same in-flight request.
 */
export function initializeKoiTeams(): Promise<void> {
  if (!isApiConfigured()) {
    console.log('[initializeKoiTeams] API not configured');
    return Promise.resolve();
  }

  const cacheKey = 'koi-teams-init';
  const cached = getCached<PandaTeam[]>(cacheKey, 10 * 60 * 1000); // 10 min cache
  if (cached) {
    koiPandaTeams = cached;
    koiPandaTeamIds = cached.map((t) => t.id);
    return Promise.resolve();
  }

  // If already in-flight, return the same promise (prevents stampede)
  if (_initPromise) return _initPromise;

  _initPromise = _doInitialize(cacheKey)
    .finally(() => {
      _initPromise = null; // allow retry on next call after completion
    });

  return _initPromise;
}

/** Internal: perform the actual KOI team discovery with one retry. */
async function _doInitialize(cacheKey: string): Promise<void> {
  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[initializeKoiTeams] attempt ${attempt}/${MAX_RETRIES}...`);
      koiPandaTeams = await pandaScoreAPI.findKoiTeams();
      koiPandaTeamIds = koiPandaTeams.map((t) => t.id);
      console.log('[initializeKoiTeams] found KOI teams:', koiPandaTeamIds);
      if (koiPandaTeams.length > 0) {
        setCache(cacheKey, koiPandaTeams);
      }
      return; // success
    } catch (error) {
      console.warn(`[initializeKoiTeams] attempt ${attempt} failed:`, error);
      if (attempt < MAX_RETRIES) {
        // Wait before retrying (exponential back-off: 2s, 4s)
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }
  console.warn('[initializeKoiTeams] all attempts failed, matches will be empty until next retry');
}

/**
 * Get all KOI teams from PandaScore + static data.
 * PandaScore provides LoL, Valorant, CoD. Static data provides TFT, Pokémon VGC.
 */
export async function fetchAllTeams(): Promise<Team[]> {
  const cacheKey = 'all-teams';
  const cached = getCached<Team[]>(cacheKey);
  if (cached) return cached;

  let apiTeams: Team[] = [];

  if (isApiConfigured()) {
    try {
      await initializeKoiTeams();

      apiTeams = koiPandaTeams
        .map(mapPandaTeamToTeam)
        .filter((t): t is Team => t !== null);

      // Resolve divisions dynamically from each team's most recent match
      if (apiTeams.length > 0) {
        await resolveDivisions(apiTeams);
      }
    } catch (error) {
      console.warn('Error fetching teams:', error);
    }
  }

  // Merge API teams with static teams (TFT, Pokémon VGC)
  const allTeams = [...apiTeams, ...staticTeams];
  setCache(cacheKey, allTeams);
  return allTeams;
}

/**
 * Fetch one recent match per team to extract the league/division name.
 * Mutates the division field of each team in-place.
 */
async function resolveDivisions(teams: Team[]): Promise<void> {
  const GAME_DIVISION_FALLBACK: Record<string, string> = {
    league_of_legends: 'League of Legends',
    valorant: 'Valorant',
    call_of_duty: 'Call of Duty',
  };

  await Promise.all(
    teams.map(async (team) => {
      try {
        // Extract numeric PandaScore ID from our "panda-XXXXX" format
        const numericId = parseInt(team.id.replace('panda-', ''), 10);
        if (isNaN(numericId)) return;

        // Fetch 1 past match — most reliable for getting the current league
        const pastMatches = await pandaScoreAPI.getPastMatchesByTeam(numericId, 1);
        if (pastMatches.length > 0 && pastMatches[0].league?.name) {
          team.division = pastMatches[0].league.name;
          return;
        }

        // Fallback: try upcoming matches
        const upcomingMatches = await pandaScoreAPI.getUpcomingMatchesByTeam(numericId, 1);
        if (upcomingMatches.length > 0 && upcomingMatches[0].league?.name) {
          team.division = upcomingMatches[0].league.name;
          return;
        }

        // Final fallback: generic game name
        team.division = GAME_DIVISION_FALLBACK[team.game] || team.game;
      } catch (err) {
        console.warn(`Failed to resolve division for team ${team.id}:`, err);
        team.division = GAME_DIVISION_FALLBACK[team.game] || team.game;
      }
    })
  );
}

/**
 * Get a single team by ID
 */
export async function fetchTeamById(teamId: string): Promise<Team | undefined> {
  // Check static teams first (TFT, Pokémon VGC)
  const staticTeam = staticTeams.find((t) => t.id === teamId);
  if (staticTeam) return staticTeam;

  if (!isApiConfigured() || !teamId.startsWith('panda-')) {
    return undefined;
  }

  const pandaId = parseInt(teamId.replace('panda-', ''), 10);
  const cacheKey = `team-${pandaId}`;
  const cached = getCached<Team>(cacheKey);
  if (cached) return cached;

  try {
    const pandaTeam = await pandaScoreAPI.getTeamById(pandaId);
    const team = mapPandaTeamToTeam(pandaTeam);
    if (team) setCache(cacheKey, team);
    return team || undefined;
  } catch (error) {
    console.warn(`Error fetching team ${pandaId}:`, error);
    return undefined;
  }
}

/**
 * Get all upcoming matches across all KOI teams (PandaScore games only)
 */
export async function fetchUpcomingMatches(): Promise<Match[]> {
  const cacheKey = 'upcoming-matches';
  const cached = getCached<Match[]>(cacheKey);
  if (cached) return cached;

  const pandaMatches = await fetchPandaUpcoming();

  const allMatches = [...pandaMatches];

  allMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Only cache non-empty results so a manual refresh can retry
  if (allMatches.length > 0) {
    setCache(cacheKey, allMatches);
  }
  return allMatches;
}

/** Internal: fetch upcoming from PandaScore only */
async function fetchPandaUpcoming(): Promise<Match[]> {
  if (!isApiConfigured()) return [];
  try {
    await initializeKoiTeams();
    if (koiPandaTeamIds.length === 0) return [];

    const pandaMatches = await pandaScoreAPI.getAllUpcomingMatches(koiPandaTeamIds);
    const mapped = pandaMatches
      .map((m) => mapPandaMatchToMatch(m, koiPandaTeamIds))
      .filter((m): m is Match => m !== null);

    await resolveStandings(mapped);
    return mapped;
  } catch (error) {
    console.warn('PandaScore upcoming error:', error);
    return [];
  }
}

/**
 * Get live matches (PandaScore games only)
 */
export async function fetchLiveMatches(): Promise<Match[]> {
  const cacheKey = 'live-matches';
  const cached = getCached<Match[]>(cacheKey, CACHE_TTL_LIVE);
  if (cached) return cached;

  const pandaMatches = await fetchPandaLive();
  if (pandaMatches.length > 0) {
    setCache(cacheKey, pandaMatches);
  }
  return pandaMatches;
}

/** Internal: fetch live from PandaScore only */
async function fetchPandaLive(): Promise<Match[]> {
  if (!isApiConfigured()) return [];
  try {
    await initializeKoiTeams();
    if (koiPandaTeamIds.length === 0) return [];

    const pandaMatches = await pandaScoreAPI.getAllLiveMatches(koiPandaTeamIds);
    return pandaMatches
      .map((m) => mapPandaMatchToMatch(m, koiPandaTeamIds))
      .filter((m): m is Match => m !== null);
  } catch (error) {
    console.warn('PandaScore live error:', error);
    return [];
  }
}

/**
 * Get past (finished) matches (PandaScore games only)
 */
export async function fetchPastMatches(): Promise<Match[]> {
  console.log('[fetchPastMatches] called');
  const cacheKey = 'past-matches';
  const cached = getCached<Match[]>(cacheKey);
  if (cached) {
    console.log('[fetchPastMatches] returning cached:', cached.length, 'matches');
    return cached;
  }

  const pandaMatches = await fetchPandaPast();

  console.log('[fetchPastMatches] panda:', pandaMatches.length);

  const allMatches = [...pandaMatches];

  allMatches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Only cache non-empty results so a manual refresh can retry
  if (allMatches.length > 0) {
    setCache(cacheKey, allMatches);
  }
  return allMatches;
}

/** Internal: fetch past from PandaScore only */
async function fetchPandaPast(): Promise<Match[]> {
  if (!isApiConfigured()) {
    console.log('[fetchPandaPast] API not configured');
    return [];
  }
  try {
    await initializeKoiTeams();
    console.log('[fetchPandaPast] koiPandaTeamIds:', koiPandaTeamIds.length, koiPandaTeamIds);
    if (koiPandaTeamIds.length === 0) return [];

    const pandaMatches = await pandaScoreAPI.getAllPastMatches(koiPandaTeamIds, 50);
    console.log('[fetchPandaPast] raw pandaMatches:', pandaMatches.length);
    const mapped = pandaMatches
      .map((m) => mapPandaMatchToMatch(m, koiPandaTeamIds))
      .filter((m): m is Match => m !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log('[fetchPandaPast] mapped matches:', mapped.length);
    await resolveStandings(mapped);
    return mapped;
  } catch (error) {
    console.warn('[fetchPandaPast] error:', error);
    return [];
  }
}

/**
 * Batch-fetch standings for each unique tournament and attach KOI's
 * and opponent's rank to matching matches. Mutates `standing` in-place.
 */
type ExtendedMatch = Match & { _tournamentId?: number; _serieId?: number; _koiTeamId?: number; _opponentTeamId?: number };

async function resolveStandings(matches: Match[]): Promise<void> {
  // Collect unique tournament IDs
  const tournamentMap = new Map<number, ExtendedMatch[]>();
  for (const m of matches as ExtendedMatch[]) {
    const tid = m._tournamentId;
    if (!tid) continue;
    if (!tournamentMap.has(tid)) tournamentMap.set(tid, []);
    tournamentMap.get(tid)!.push(m);
  }

  if (tournamentMap.size === 0) return;

  // Fetch standings in parallel (batches of 5 to avoid rate limits)
  const entries = Array.from(tournamentMap.entries());
  const BATCH = 5;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async ([tid, mList]) => {
        try {
          // If match is playoffs/knockout/finals, try to find the "Regular Season" tournament in the same series
          let targetTournamentId = tid;
          const firstMatch = mList[0];

          const isPlayoffs = /playoff|knockout|bracket|final|semi|quarter|decider|round/i.test(firstMatch.matchType || '');

          if (isPlayoffs && firstMatch._serieId) {
            try {
              const tournaments = await pandaScoreAPI.getTournamentsBySerie(firstMatch._serieId);
              // Find a tournament that looks like "Regular Season" or "Group Stage"
              const regularSeason = tournaments.find((t) =>
                /regular|group|split|season/i.test(t.name) &&
                !/playoff|knockout|bracket|final/i.test(t.name)
              );
              if (regularSeason) {
                targetTournamentId = regularSeason.id;
              }
            } catch (err) {
              // fallback to current tournament
            }
          }

          const standings = await pandaScoreAPI.getStandingsByTournament(targetTournamentId);
          if (standings.length === 0) return;

          for (const m of mList) {
            // 1. Resolve KOI's standing
            if (m._koiTeamId) {
              const koiEntry = standings.find((s) => s.team?.id === m._koiTeamId);
              if (koiEntry) {
                m.standing = `${ordinal(koiEntry.rank)} / ${standings.length}`;
              }
            }

            // 2. Resolve Opponent's standing
            if (m._opponentTeamId) {
              const oppEntry = standings.find((s) => s.team?.id === m._opponentTeamId);
              if (oppEntry) {
                m.opponentStanding = `${ordinal(oppEntry.rank)} / ${standings.length}`;
              }
            }
          }
        } catch {
          // standings not available for this tournament
        }
      })
    );
  }

  // Clean up internal fields
  for (const m of matches as ExtendedMatch[]) {
    delete m._tournamentId;
    delete m._serieId;
    delete m._koiTeamId;
    delete m._opponentTeamId;
  }
}

/** Format a rank number as ordinal: 1 → "1st", 2 → "2nd", etc. */
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Get matches for a specific team
 * Note: For static teams (TFT, Pokémon VGC), use fetchTournamentsByTeam instead.
 */
export async function fetchMatchesByTeam(teamId: string): Promise<Match[]> {
  // For static teams (TFT, Pokémon VGC) → no matches, only tournaments
  if (teamId.startsWith('static-')) {
    return [];
  }

  // For PandaScore teams
  if (!isApiConfigured() || !teamId.startsWith('panda-')) return [];

  const pandaId = parseInt(teamId.replace('panda-', ''), 10);
  const cacheKey = `team-matches-${pandaId}`;
  const cached = getCached<Match[]>(cacheKey);
  if (cached) return cached;

  try {
    const [upcoming, live, past] = await Promise.all([
      pandaScoreAPI.getUpcomingMatchesByTeam(pandaId, 5),
      pandaScoreAPI.getLiveMatchesByTeam(pandaId),
      pandaScoreAPI.getPastMatchesByTeam(pandaId, 50),
    ]);

    const allPandaMatches = [...live, ...upcoming, ...past];
    const matches = allPandaMatches
      .map((m) => mapPandaMatchToMatch(m, [pandaId]))
      .filter((m): m is Match => m !== null);

    setCache(cacheKey, matches);
    return matches;
  } catch (error) {
    console.warn(`Error fetching matches for team ${pandaId}:`, error);
    return [];
  }
}

// ─── Tournament Data (TFT, Pokémon VGC) ───────────────────────────

/** Race a promise against a timeout. Resolves to null on timeout. */
function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[dataService] tournament fetch timed out after ${ms}ms, using mock data`);
      resolve(null);
    }, ms);
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); console.warn('[dataService] tournament fetch error:', e); resolve(null); });
  });
}

/** Max time to wait for start.gg */
const TOURNAMENT_FETCH_TIMEOUT = 12_000; // 12 seconds

/**
 * Fetch upcoming tournaments for TFT and Pokémon VGC.
 */
export async function fetchUpcomingTournaments(): Promise<Tournament[]> {
  console.log('[fetchUpcomingTournaments] called');
  const result = await raceTimeout(sggFetchUpcomingTournaments(), TOURNAMENT_FETCH_TIMEOUT);
  console.log('[fetchUpcomingTournaments] got', result?.length ?? 0, 'from start.gg');
  return result || [];
}

/**
 * Fetch live tournaments for TFT and Pokémon VGC.
 */
export async function fetchLiveTournaments(): Promise<Tournament[]> {
  const result = await raceTimeout(sggFetchLiveTournaments(), TOURNAMENT_FETCH_TIMEOUT);
  return result || [];
}

/**
 * Fetch past/completed tournaments for TFT and Pokémon VGC.
 */
export async function fetchPastTournaments(): Promise<Tournament[]> {
  console.log('[fetchPastTournaments] called');
  const result = await raceTimeout(sggFetchPastTournaments(), TOURNAMENT_FETCH_TIMEOUT);
  console.log('[fetchPastTournaments] got', result?.length ?? 0, 'from start.gg');
  return result || [];
}

/**
 * Fetch tournaments for a specific team (for Teams tab detail).
 */
export async function fetchTournamentsByTeam(teamId: string): Promise<Tournament[]> {
  try {
    return await sggFetchTournamentsByTeam(teamId);
  } catch (err) {
    console.warn(`Error fetching tournaments for team ${teamId}:`, err);
    return [];
  }
}

/**
 * Fetch a single tournament by ID.
 * Right now we search across cached results; in the future this
 * could be a dedicated start.gg query.
 */
export async function fetchTournamentById(tournamentId: string): Promise<Tournament | undefined> {
  // Fast path: check curated data first (no API call needed)
  const curated = getCuratedTournamentById(tournamentId);
  if (curated) return curated;

  // Fallback: search across fetched tournament lists
  const allSources = await Promise.all([
    fetchUpcomingTournaments(),
    fetchLiveTournaments(),
    fetchPastTournaments(),
  ]);

  for (const list of allSources) {
    const found = list.find((t) => t.id === tournamentId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Get a player by ID
 */
export async function fetchPlayerById(
  playerId: string,
  teamId: string
): Promise<Player | undefined> {
  // For static teams, find the player in static data
  if (teamId.startsWith('static-')) {
    const team = staticTeams.find((t) => t.id === teamId);
    return team?.members.find((m) => m.id === playerId);
  }

  if (!isApiConfigured() || !teamId.startsWith('panda-')) return undefined;

  const numericId = parseInt(playerId, 10);
  if (isNaN(numericId)) return undefined;

  const cacheKey = `player-${numericId}`;
  const cached = getCached<Player>(cacheKey, 5 * 60 * 1000);
  if (cached) return cached;

  try {
    const pandaPlayer = await pandaScoreAPI.getPlayerById(numericId);
    const team = await fetchTeamById(teamId);
    const player = mapPandaPlayerToPlayer(pandaPlayer, team?.game || 'league_of_legends');
    setCache(cacheKey, player);
    return player;
  } catch (error) {
    console.warn(`Error fetching player ${numericId}:`, error);
    return undefined;
  }
}

/**
 * Get detailed match information, including games and potentially drafts.
 */
export async function fetchMatchDetails(matchId: string): Promise<Match | undefined> {
  // We only support PandaScore details for now
  if (!matchId.startsWith('panda-match-')) return undefined;

  const numericId = parseInt(matchId.replace('panda-match-', ''), 10);
  if (isNaN(numericId)) return undefined;

  try {
    const pandaMatch = await pandaScoreAPI.getMatchById(numericId);

    // Determine KOI team ID from match opponents
    // This is needed for mapPandaMatchToMatch to know which is home/away
    await initializeKoiTeams();

    const mappedMatch = mapPandaMatchToMatch(pandaMatch, koiPandaTeamIds);
    if (!mappedMatch) return undefined;

    // Fetch deep game data based on the game type
    if (mappedMatch.games && mappedMatch.games.length > 0) {
      const detailedGames = await Promise.all(
        mappedMatch.games.map(async (game) => {
          try {
            if (mappedMatch.game === 'league_of_legends') {
              const lolGame = await pandaScoreAPI.getLolGameById(parseInt(game.id, 10));
              return enhanceLolGame(game, lolGame);
            } else if (mappedMatch.game === 'valorant') {
              const valGame = await pandaScoreAPI.getValorantGameById(parseInt(game.id, 10));
              return enhanceValorantGame(game, valGame);
            }
          } catch (e) {
            console.warn(`Failed to fetch deep game detail for game ${game.id}`, e);
          }
          return game; // return basic game if deep fetch fails
        })
      );
      mappedMatch.games = detailedGames;
    }

    // Enrich CoD matches with map/mode data from Liquipedia (best-effort, with timeout)
    if (mappedMatch.game === 'call_of_duty' && mappedMatch.games && mappedMatch.status === 'finished') {
      try {
        const enriched = await Promise.race([
          enrichCodMatchGames(
            mappedMatch.games,
            mappedMatch.homeTeam.name,
            mappedMatch.awayTeam.name,
            mappedMatch.date,
          ),
          new Promise<typeof mappedMatch.games>((resolve) =>
            setTimeout(() => {
              console.warn('[CoD Enrichment] Timed out after 10s, using base data');
              resolve(mappedMatch.games!);
            }, 10_000)
          ),
        ]);
        mappedMatch.games = enriched;
      } catch (e) {
        console.warn('[CoD Enrichment] Failed:', e);
      }
    }

    return mappedMatch;
  } catch (error) {
    console.warn(`Error fetching details for match ${numericId}:`, error);
    return undefined;
  }
}

// Helper to map LoL specific game response to our MatchGame format
function enhanceLolGame(baseGame: any, lolData: any): any {
  if (!lolData) return baseGame;

  const enhanced = { ...baseGame };

  if (lolData.teams && lolData.teams.length >= 2) {
    const t1 = lolData.teams[0];
    const t2 = lolData.teams[1];

    // Map team 1 as home, team 2 as away (we will match by ID in the UI later)
    enhanced.draft = {
      homeTeamDetails: {
        side: t1.color || 'blue',
        picks: (t1.picks || []).map((p: any) => ({
          championId: String(p.champion?.id),
          championName: p.champion?.name,
          championImageUrl: p.champion?.image_url,
          playerId: String(p.player_id),
        })),
        bans: (t1.bans || []).map((b: any) => ({
          championId: String(b.champion?.id),
          championName: b.champion?.name,
          championImageUrl: b.champion?.image_url,
        })),
      },
      awayTeamDetails: {
        side: t2.color || 'red',
        picks: (t2.picks || []).map((p: any) => ({
          championId: String(p.champion?.id),
          championName: p.champion?.name,
          championImageUrl: p.champion?.image_url,
          playerId: String(p.player_id), // Link pick to a player
        })),
        bans: (t2.bans || []).map((b: any) => ({
          championId: String(b.champion?.id),
          championName: b.champion?.name,
          championImageUrl: b.champion?.image_url,
        })),
      }
    };
  }
  return enhanced;
}

// Helper to map Valorant specific game response to our MatchGame format
function enhanceValorantGame(baseGame: any, valData: any): any {
  if (!valData) return baseGame;

  const enhanced = { ...baseGame };

  if (valData.map) {
    enhanced.map = {
      id: String(valData.map.id),
      name: valData.map.name,
      imageUrl: valData.map.image_url,
    };
  }

  if (valData.teams && valData.teams.length >= 2) {
    const t1 = valData.teams[0];
    const t2 = valData.teams[1];

    // Save map scores
    enhanced.homeTeamScore = t1.score;
    enhanced.awayTeamScore = t2.score;

    // We can also extract Agent picks for Valorant here if PandaScore provides them in `valData`.
    // Example logic assuming structure is similar to the LoL one or standard PandaScore structure.
    enhanced.draft = {
      homeTeamDetails: {
        side: t1.color || 'attacker',
        picks: (t1.players || []).map((p: any) => ({
          championId: String(p.agent?.id || p.character?.id),
          championName: p.agent?.name || p.character?.name || 'Agent',
          championImageUrl: p.agent?.image_url || p.character?.image_url,
          playerId: String(p.id)
        })).filter((p: any) => p.championName !== 'Agent'),
        bans: []
      },
      awayTeamDetails: {
        side: t2.color || 'defender',
        picks: (t2.players || []).map((p: any) => ({
          championId: String(p.agent?.id || p.character?.id),
          championName: p.agent?.name || p.character?.name || 'Agent',
          championImageUrl: p.agent?.image_url || p.character?.image_url,
          playerId: String(p.id)
        })).filter((p: any) => p.championName !== 'Agent'),
        bans: []
      }
    }
  };
  return enhanced;
}


