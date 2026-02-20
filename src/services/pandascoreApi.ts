import { PANDASCORE_API_KEY, PANDASCORE_BASE_URL } from '../config/pandascore';

// ─── Types from PandaScore API ──────────────────────────────────────

export interface PandaTeam {
  id: number;
  slug: string;
  name: string;
  acronym: string;
  image_url: string | null;
  current_videogame: {
    id: number;
    name: string;
    slug: string;
  };
  players: PandaPlayer[];
  location: string | null;
}

export interface PandaPlayer {
  id: number;
  slug: string;
  name: string; // nickname/gamertag
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  nationality: string | null;
  image_url: string | null;
  age: number | null;
  birthday: string | null;
  current_team?: {
    id: number;
    name: string;
    slug: string;
  };
}

export interface PandaMatch {
  id: number;
  slug: string;
  name: string;
  status: 'not_started' | 'running' | 'finished' | 'canceled';
  scheduled_at: string | null;
  begin_at: string | null;
  end_at: string | null;
  number_of_games: number; // best of
  videogame: {
    id: number;
    name: string;
    slug: string;
  };
  league: {
    id: number;
    name: string;
    slug: string;
    image_url: string | null;
  };
  serie: {
    id: number;
    name: string;
    full_name: string;
  };
  tournament: {
    id: number;
    name: string;
    slug: string;
  };
  opponents: PandaOpponent[];
  results: PandaResult[];
  games?: PandaGame[];
  streams_list: PandaStream[];
  live?: {
    opens_at: string | null;
    supported: boolean;
    url: string | null;
  };
  winner?: {
    id: number;
    name: string;
    acronym: string;
  };
  forfeit: boolean;
}

export interface PandaGame {
  id: number;
  position: number;
  status: 'not_started' | 'running' | 'finished';
  winner?: { id: number; type: string };
  winner_type?: string;
  match_id: number;
  forfeit: boolean;
  length?: number; // seconds
  begin_at?: string;
  end_at?: string;
}

// These types are mostly for LoL / Valorant specific detailed match endpoints
export interface PandaPick {
  champion?: {
    id: number;
    name: string;
    image_url: string | null;
  };
  player_id?: number | null;
}

export interface PandaBan {
  champion?: {
    id: number;
    name: string;
    image_url: string | null;
  };
}

export interface PandaOpponent {
  type: string;
  opponent: {
    id: number;
    slug: string;
    name: string;
    acronym: string;
    image_url: string | null;
    location: string | null;
  };
}

export interface PandaResult {
  team_id: number;
  score: number;
}

export interface PandaStream {
  language: string;
  main: boolean;
  official: boolean;
  raw_url: string;
}

export interface PandaSerie {
  id: number;
  name: string;
  full_name: string;
  slug: string;
  league: {
    id: number;
    name: string;
    slug: string;
    image_url: string | null;
  };
}

export interface PandaTournament {
  id: number;
  name: string;
  slug: string;
  begin_at: string | null;
  end_at: string | null;
  serie_id: number;
  league_id: number;
}

export interface PandaStanding {
  rank: number;
  team: {
    id: number;
    name: string;
    acronym: string;
    image_url: string | null;
  };
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

// ─── API Client ────────────────────────────────────────────────────

/** Max time (ms) to wait for a single PandaScore API request */
const PANDASCORE_REQUEST_TIMEOUT = 10_000; // 10 seconds

class PandaScoreAPI {
  private baseUrl = PANDASCORE_BASE_URL;
  private token = PANDASCORE_API_KEY;

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    url.searchParams.append('token', this.token);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PANDASCORE_REQUEST_TIMEOUT);

    try {
      const response = await fetch(url.toString(), { signal: controller.signal });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PandaScore API error ${response.status}: ${errorText}`);
      }

      return response.json() as Promise<T>;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`PandaScore request timed out after ${PANDASCORE_REQUEST_TIMEOUT}ms: ${endpoint}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Teams ──────────────────────────────────────────────────────

  /** Search for teams by name */
  async searchTeams(name: string, videogameSlug?: string): Promise<PandaTeam[]> {
    const params: Record<string, string> = {
      'search[name]': name,
      'per_page': '25',
    };
    const endpoint = videogameSlug
      ? `/${videogameSlug}/teams`
      : '/teams';
    return this.fetch<PandaTeam[]>(endpoint, params);
  }

  /** Get a team by ID */
  async getTeamById(teamId: number): Promise<PandaTeam> {
    return this.fetch<PandaTeam>(`/teams/${teamId}`);
  }

  /** Get a team by slug */
  async getTeamBySlug(slug: string): Promise<PandaTeam[]> {
    return this.fetch<PandaTeam[]>('/teams', {
      'filter[slug]': slug,
      'per_page': '1',
    });
  }

  // ─── Players ──────────────────────────────────────────────────

  /** Get players of a team */
  async getTeamPlayers(teamId: number): Promise<PandaPlayer[]> {
    const team = await this.getTeamById(teamId);
    return team.players || [];
  }

  /** Search players */
  async searchPlayers(name: string): Promise<PandaPlayer[]> {
    return this.fetch<PandaPlayer[]>('/players', {
      'search[name]': name,
      'per_page': '25',
    });
  }

  /** Get player by ID */
  async getPlayerById(playerId: number): Promise<PandaPlayer> {
    return this.fetch<PandaPlayer>(`/players/${playerId}`);
  }

  // ─── Matches ─────────────────────────────────────────────────

  /** Get upcoming matches for a team */
  async getUpcomingMatchesByTeam(teamId: number, perPage = 10): Promise<PandaMatch[]> {
    return this.fetch<PandaMatch[]>('/matches/upcoming', {
      'filter[opponent_id]': String(teamId),
      'sort': 'scheduled_at',
      'per_page': String(perPage),
    });
  }

  /** Get running (live) matches for a team */
  async getLiveMatchesByTeam(teamId: number): Promise<PandaMatch[]> {
    return this.fetch<PandaMatch[]>('/matches/running', {
      'filter[opponent_id]': String(teamId),
      'per_page': '10',
    });
  }

  /** Get past matches for a team */
  async getPastMatchesByTeam(teamId: number, perPage = 10): Promise<PandaMatch[]> {
    return this.fetch<PandaMatch[]>('/matches/past', {
      'filter[opponent_id]': String(teamId),
      'sort': '-scheduled_at',
      'per_page': String(perPage),
    });
  }

  /** Get all upcoming matches across all KOI teams */
  async getAllUpcomingMatches(teamIds: number[], perPage = 20): Promise<PandaMatch[]> {
    const idsFilter = teamIds.join(',');
    return this.fetch<PandaMatch[]>('/matches/upcoming', {
      'filter[opponent_id]': idsFilter,
      'sort': 'scheduled_at',
      'per_page': String(perPage),
    });
  }

  /** Get all live matches across all KOI teams */
  async getAllLiveMatches(teamIds: number[]): Promise<PandaMatch[]> {
    const idsFilter = teamIds.join(',');
    return this.fetch<PandaMatch[]>('/matches/running', {
      'filter[opponent_id]': idsFilter,
      'per_page': '20',
    });
  }

  /** Get all past matches across all KOI teams */
  async getAllPastMatches(teamIds: number[], perPage = 20): Promise<PandaMatch[]> {
    const idsFilter = teamIds.join(',');
    return this.fetch<PandaMatch[]>('/matches/past', {
      'filter[opponent_id]': idsFilter,
      'sort': '-scheduled_at',
      'per_page': String(perPage),
    });
  }

  /** Get detailed match info, including games/maps */
  async getMatchById(matchId: number): Promise<PandaMatch> {
    return this.fetch<PandaMatch>(`/matches/${matchId}`);
  }

  // ─── LoL/Valorant Specific Draf/Games APIs ───────────────

  /** Fetch a specific game of a match, useful for LoL where drafts are inside */
  async getLolGameById(gameId: number): Promise<any> {
    return this.fetch<any>(`/lol/games/${gameId}`);
  }

  async getValorantGameById(gameId: number): Promise<any> {
    return this.fetch<any>(`/valorant/games/${gameId}`);
  }

  // ─── KOI-specific helpers ────────────────────────────────────

  /** Find all KOI teams across videogames */
  async findKoiTeams(): Promise<PandaTeam[]> {
    // Search for "KOI" and "Movistar KOI" across all games
    const [koiResults, movistarResults] = await Promise.all([
      this.searchTeams('KOI'),
      this.searchTeams('Movistar KOI'),
    ]);

    // Merge and deduplicate
    const allTeams = [...koiResults, ...movistarResults];
    const uniqueTeams = allTeams.reduce<PandaTeam[]>((acc, team) => {
      if (!acc.find((t) => t.id === team.id)) {
        acc.push(team);
      }
      return acc;
    }, []);

    // Filter for actual KOI teams (the acronym is usually "KOI")
    return uniqueTeams.filter(
      (t) =>
        t.acronym?.toUpperCase() === 'KOI' ||
        t.name.toLowerCase().includes('koi') &&
        (t.name.toLowerCase().includes('movistar') ||
          t.name.toLowerCase().includes('koi'))
    );
  }

  // ─── Standings ──────────────────────────────────────────────────

  /** Get standings for a tournament */
  async getStandingsByTournament(tournamentId: number): Promise<PandaStanding[]> {
    try {
      return await this.fetch<PandaStanding[]>(`/tournaments/${tournamentId}/standings`);
    } catch {
      // Not all tournaments have standings; fail gracefully
      return [];
    }
  }

  /** Get tournaments for a series */
  async getTournamentsBySerie(serieId: number): Promise<PandaTournament[]> {
    return this.fetch<PandaTournament[]>(`/series/${serieId}/tournaments`);
  }
}

export const pandaScoreAPI = new PandaScoreAPI();
export default pandaScoreAPI;
