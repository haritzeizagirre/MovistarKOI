import pandaScoreAPI, {
  PandaTeam,
  PandaPlayer,
  PandaMatch,
  PandaStanding,
} from './pandascoreApi';
import { Team, Player, Match, Game, MatchStatus, StaffMember } from '../types';
import { PANDASCORE_API_KEY } from '../config/pandascore';
import { staticTeams } from '../data/staticTeams';
import {
  sggFetchUpcomingMatches,
  sggFetchLiveMatches,
  sggFetchPastMatches,
  sggFetchMatchesByTeam,
} from './startggDataService';

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
      name: koiOpponent.name,
      tag: koiOpponent.acronym || koiOpponent.name.substring(0, 3).toUpperCase(),
      logoUrl: koiOpponent.image_url || '',
      score: koiResult?.score,
    },
    awayTeam: {
      name: otherOpponent.name,
      tag: otherOpponent.acronym || otherOpponent.name.substring(0, 3).toUpperCase(),
      logoUrl: otherOpponent.image_url || '',
      score: otherResult?.score,
    },
    bestOf: m.number_of_games || 1,
    streamUrl: stream?.raw_url || m.live?.url || undefined,
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

// ─── Public Service ────────────────────────────────────────────────

const isApiConfigured = () => {
  const key: string = PANDASCORE_API_KEY;
  return key.length > 0 && key !== 'YOUR_PANDASCORE_API_TOKEN';
};

/**
 * Initialize: discover KOI teams on PandaScore
 */
export async function initializeKoiTeams(): Promise<void> {
  if (!isApiConfigured()) return;

  const cacheKey = 'koi-teams-init';
  const cached = getCached<PandaTeam[]>(cacheKey, 10 * 60 * 1000); // 10 min cache
  if (cached) {
    koiPandaTeams = cached;
    koiPandaTeamIds = cached.map((t) => t.id);
    return;
  }

  try {
    koiPandaTeams = await pandaScoreAPI.findKoiTeams();
    koiPandaTeamIds = koiPandaTeams.map((t) => t.id);
    setCache(cacheKey, koiPandaTeams);
  } catch (error) {
    console.warn('Failed to fetch KOI teams from PandaScore:', error);
  }
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
      await resolveDivisions(apiTeams);
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
 * Get all upcoming matches across all KOI teams
 */
export async function fetchUpcomingMatches(): Promise<Match[]> {
  const cacheKey = 'upcoming-matches';
  const cached = getCached<Match[]>(cacheKey);
  if (cached) return cached;

  // Fetch from both sources in parallel
  const [pandaMatches, sggMatches] = await Promise.all([
    fetchPandaUpcoming(),
    sggFetchUpcomingMatches().catch((err) => {
      console.warn('start.gg upcoming error:', err);
      return [] as Match[];
    }),
  ]);


  const allMatches = [...pandaMatches, ...sggMatches]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  setCache(cacheKey, allMatches);
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
 * Get live matches
 */
export async function fetchLiveMatches(): Promise<Match[]> {
  const cacheKey = 'live-matches';
  const cached = getCached<Match[]>(cacheKey, CACHE_TTL_LIVE);
  if (cached) return cached;

  // Fetch from both sources in parallel
  const [pandaMatches, sggMatches] = await Promise.all([
    fetchPandaLive(),
    sggFetchLiveMatches().catch((err) => {
      console.warn('start.gg live error:', err);
      return [] as Match[];
    }),
  ]);

  const allMatches = [...pandaMatches, ...sggMatches];
  setCache(cacheKey, allMatches);
  return allMatches;
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
 * Get past (finished) matches
 */
export async function fetchPastMatches(): Promise<Match[]> {
  console.log('[fetchPastMatches] called');
  const cacheKey = 'past-matches';
  const cached = getCached<Match[]>(cacheKey);
  if (cached) {
    console.log('[fetchPastMatches] returning cached:', cached.length, 'matches');
    return cached;
  }

  // Fetch from both sources in parallel
  const [pandaMatches, sggMatches] = await Promise.all([
    fetchPandaPast(),
    sggFetchPastMatches().catch((err) => {
      console.warn('start.gg past error:', err);
      return [] as Match[];
    }),
  ]);

  console.log('[fetchPastMatches] panda:', pandaMatches.length, 'sgg:', sggMatches.length);

  const allMatches = [...pandaMatches, ...sggMatches]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  setCache(cacheKey, allMatches);
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
 */
export async function fetchMatchesByTeam(teamId: string): Promise<Match[]> {
  // For static teams (TFT, Pokémon VGC) → delegate to start.gg
  if (teamId.startsWith('static-')) {
    return sggFetchMatchesByTeam(teamId).catch((err) => {
      console.warn(`start.gg team matches error for ${teamId}:`, err);
      return [] as Match[];
    });
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
