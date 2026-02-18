/**
 * start.gg GraphQL API Client
 *
 * Queries tournament data for TFT and Pokémon VGC.
 * Endpoint: https://api.start.gg/gql/alpha
 * Auth: Bearer token
 */

import { STARTGG_API_TOKEN, STARTGG_API_URL } from '../config/startgg';

// ─── Types ─────────────────────────────────────────────────────────

export interface StartGGPageInfo {
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
}

export interface StartGGTournament {
  id: number;
  name: string;
  slug: string;
  startAt: number | null; // Unix timestamp
  endAt: number | null;
  state: number | null; // 1=Created, 2=Active, 3=Completed
  numAttendees: number | null;
  images: StartGGImage[] | null;
  events: StartGGEvent[] | null;
  isOnline: boolean | null;
  city: string | null;
  countryCode: string | null;
  url: string | null;
}

export interface StartGGEvent {
  id: number;
  name: string;
  slug: string;
  state: string | null; // 'ACTIVE', 'COMPLETED', 'CREATED'
  startAt: number | null;
  numEntrants: number | null;
  videogame: { id: number; name: string } | null;
  sets: {
    pageInfo: StartGGPageInfo;
    nodes: StartGGSet[];
  } | null;
  standings: {
    nodes: StartGGStanding[];
  } | null;
}

export interface StartGGSet {
  id: number;
  completedAt: number | null;
  startAt: number | null;
  state: number | null; // 1=Not started, 2=Started, 3=Completed
  fullRoundText: string | null;
  displayScore: string | null;
  winnerId: number | null;
  totalGames: number | null;
  slots: StartGGSlot[] | null;
  event: { id: number; name: string; slug: string } | null;
}

export interface StartGGSlot {
  id: number;
  entrant: StartGGEntrant | null;
  standing: { stats: { score: { value: number } } } | null;
}

export interface StartGGEntrant {
  id: number;
  name: string;
  participants: StartGGParticipant[] | null;
}

export interface StartGGParticipant {
  id: number;
  gamerTag: string;
  prefix: string | null;
  player: { id: number; gamerTag: string } | null;
}

export interface StartGGStanding {
  placement: number;
  entrant: StartGGEntrant;
}

export interface StartGGImage {
  id: number | null;
  url: string;
  type: string | null;
}

// ─── GraphQL Queries ───────────────────────────────────────────────

const UPCOMING_TOURNAMENTS_QUERY = `
  query UpcomingTournaments($videogameIds: [ID!], $perPage: Int!, $page: Int!) {
    tournaments(query: {
      perPage: $perPage
      page: $page
      sortBy: "startAt asc"
      filter: {
        upcoming: true
        videogameIds: $videogameIds
      }
    }) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        id
        name
        slug
        startAt
        endAt
        state
        numAttendees
        isOnline
        city
        countryCode
        images {
          url
          type
        }
        events {
          id
          name
          slug
          state
          startAt
          numEntrants
          videogame {
            id
            name
          }
        }
      }
    }
  }
`;

const PAST_TOURNAMENTS_QUERY = `
  query PastTournaments($videogameIds: [ID!], $perPage: Int!, $page: Int!) {
    tournaments(query: {
      perPage: $perPage
      page: $page
      sortBy: "startAt desc"
      filter: {
        past: true
        videogameIds: $videogameIds
      }
    }) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        id
        name
        slug
        startAt
        endAt
        state
        numAttendees
        isOnline
        city
        countryCode
        images {
          url
          type
        }
        events {
          id
          name
          slug
          state
          startAt
          numEntrants
          videogame {
            id
            name
          }
        }
      }
    }
  }
`;

const EVENT_STANDINGS_QUERY = `
  query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      id
      name
      standings(query: { perPage: $perPage, page: $page }) {
        nodes {
          placement
          entrant {
            id
            name
            participants {
              id
              gamerTag
              prefix
            }
          }
        }
      }
    }
  }
`;

const EVENT_SETS_QUERY = `
  query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      id
      name
      sets(page: $page, perPage: $perPage, sortType: STANDARD) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          completedAt
          startAt
          state
          fullRoundText
          displayScore
          winnerId
          totalGames
          slots {
            id
            entrant {
              id
              name
              participants {
                id
                gamerTag
                prefix
              }
            }
            standing {
              stats {
                score {
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

const VIDEOGAME_SEARCH_QUERY = `
  query VideogameSearch($name: String!) {
    videogames(query: { filter: { name: $name }, perPage: 10 }) {
      nodes {
        id
        name
        displayName
      }
    }
  }
`;

// ─── API Client ────────────────────────────────────────────────────

class StartGGClient {
  private token: string;

  constructor() {
    this.token = STARTGG_API_TOKEN;
  }

  isConfigured(): boolean {
    return this.token.length > 0;
  }

  private async query<T>(gql: string, variables: Record<string, any>): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('start.gg API token not configured');
    }

    const response = await fetch(STARTGG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ query: gql, variables }),
    });

    if (!response.ok) {
      throw new Error(`start.gg API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors) {
      throw new Error(`start.gg GraphQL error: ${json.errors[0]?.message || 'Unknown error'}`);
    }

    return json.data as T;
  }

  /**
   * Discover a videogame ID by name (useful for initial setup)
   */
  async discoverVideogameId(name: string): Promise<{ id: number; name: string; displayName: string }[]> {
    const data = await this.query<{
      videogames: { nodes: { id: number; name: string; displayName: string }[] };
    }>(VIDEOGAME_SEARCH_QUERY, { name });
    return data.videogames?.nodes || [];
  }

  /**
   * Get upcoming tournaments for given videogame IDs
   */
  async getUpcomingTournaments(
    videogameIds: number[],
    page = 1,
    perPage = 15
  ): Promise<{ tournaments: StartGGTournament[]; total: number }> {
    const data = await this.query<{
      tournaments: { pageInfo: StartGGPageInfo; nodes: StartGGTournament[] };
    }>(UPCOMING_TOURNAMENTS_QUERY, {
      videogameIds: videogameIds.map(String),
      page,
      perPage,
    });
    return {
      tournaments: data.tournaments?.nodes || [],
      total: data.tournaments?.pageInfo?.total || 0,
    };
  }

  /**
   * Get past/completed tournaments for given videogame IDs
   */
  async getPastTournaments(
    videogameIds: number[],
    page = 1,
    perPage = 15
  ): Promise<{ tournaments: StartGGTournament[]; total: number }> {
    const data = await this.query<{
      tournaments: { pageInfo: StartGGPageInfo; nodes: StartGGTournament[] };
    }>(PAST_TOURNAMENTS_QUERY, {
      videogameIds: videogameIds.map(String),
      page,
      perPage,
    });
    return {
      tournaments: data.tournaments?.nodes || [],
      total: data.tournaments?.pageInfo?.total || 0,
    };
  }

  /**
   * Get standings for an event
   */
  async getEventStandings(
    eventId: number,
    page = 1,
    perPage = 25
  ): Promise<StartGGStanding[]> {
    const data = await this.query<{
      event: { standings: { nodes: StartGGStanding[] } };
    }>(EVENT_STANDINGS_QUERY, { eventId: String(eventId), page, perPage });
    return data.event?.standings?.nodes || [];
  }

  /**
   * Get sets (matches) for an event
   */
  async getEventSets(
    eventId: number,
    page = 1,
    perPage = 20
  ): Promise<{ sets: StartGGSet[]; total: number }> {
    const data = await this.query<{
      event: { sets: { pageInfo: StartGGPageInfo; nodes: StartGGSet[] } };
    }>(EVENT_SETS_QUERY, { eventId: String(eventId), page, perPage });
    return {
      sets: data.event?.sets?.nodes || [],
      total: data.event?.sets?.pageInfo?.total || 0,
    };
  }
}

const startGGClient = new StartGGClient();
export default startGGClient;
