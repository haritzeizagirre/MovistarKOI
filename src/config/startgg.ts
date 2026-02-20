/**
 * start.gg (formerly smash.gg) API Configuration
 *
 * GraphQL API for tournament data.
 * Create a free token at: https://start.gg/admin/profile/developer
 *
 * Used for TFT and Pokémon VGC tournament data (calendar & results).
 * PandaScore handles LoL, Valorant, and CoD.
 */

export const STARTGG_API_TOKEN = '74e65196eb276e71444c994071bc4693';
export const STARTGG_API_URL = 'https://api.start.gg/gql/alpha';

/**
 * start.gg videogame IDs — discovered via the `videogames` GraphQL query
 * on 2026-02-20.
 *
 *  - Teamfight Tactics: 33594
 *  - Pokémon Scarlet/Violet (VGC): 45331
 */
export const STARTGG_VIDEOGAME_IDS: Record<string, number> = {
  tft: 33594,
  pokemon_vgc: 45331,
};

/** Games handled by start.gg in this app */
export const STARTGG_SUPPORTED_GAMES = ['tft', 'pokemon_vgc'] as const;

/**
 * start.gg user IDs for KOI players.
 *
 * When populated, the service will query tournaments these specific players
 * have entered, instead of fetching all tournaments for the videogame.
 *
 * To find a player's user ID:
 *   1. Open their start.gg profile (e.g. https://start.gg/user/abc123)
 *   2. Use the API: query { user(slug: "user/abc123") { id } }
 *
 * Leave empty arrays to fall back to curated tournament data.
 */
export const STARTGG_PLAYER_USER_IDS: Record<string, number[]> = {
  tft: [],           // e.g. [12345, 67890]  ← add Reven, Dalesom, etc.
  pokemon_vgc: [],   // e.g. [11111, 22222]  ← add Alex Gómez, Eric Rios, etc.
};

/**
 * Specific start.gg tournament slugs to track.
 *
 * When populated, the service will fetch these exact tournaments from start.gg.
 * This is useful for tracking specific KOI events without knowing player IDs.
 *
 * To find a slug: visit the tournament page on start.gg and copy the URL path
 * e.g. "tournament/tft-emea-pro-circuit-2026" from https://start.gg/tournament/tft-emea-pro-circuit-2026
 */
export const STARTGG_TRACKED_TOURNAMENT_SLUGS: Record<string, string[]> = {
  tft: [],           // e.g. ['tournament/tft-emea-pro-circuit-2026']
  pokemon_vgc: [],   // e.g. ['tournament/2026-pokemon-madrid-regional']
};

/**
 * Minimum number of attendees for a tournament fetched by videogame ID
 * to be shown in the app. Filters out tiny locals / test events.
 * Only applies to the videogame-ID fallback; player-based and slug-based
 * tournaments are always shown regardless of size.
 */
export const STARTGG_MIN_ATTENDEES = 16;
