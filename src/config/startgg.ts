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
 * start.gg videogame IDs — discover via the `videogames` query.
 * These need to be confirmed once you have an API token; use the
 * `discoverVideogameId()` helper in startggApi.ts to look them up.
 *
 * Known IDs from community:
 *  - Teamfight Tactics: 33795
 *  - Pokémon VGC (Scarlet & Violet): 48548
 */
export const STARTGG_VIDEOGAME_IDS: Record<string, number> = {
  tft: 33795,
  pokemon_vgc: 48548,
};

/** Games handled by start.gg in this app */
export const STARTGG_SUPPORTED_GAMES = ['tft', 'pokemon_vgc'] as const;

/**
 * Keywords that identify top-tier (regional / international) tournaments.
 * Tournaments whose name does NOT contain any of these keywords will be
 * filtered out so only official competitive events appear in the calendar.
 */
export const STARTGG_TOP_TOURNAMENT_KEYWORDS: Record<string, string[]> = {
  pokemon_vgc: [
    'regional',
    'international',
    'world championship',
    'special championship',
    'worlds',
  ],
  tft: [
    'pro circuit',
    'tpc',
    "tactician's crown",
    'tacticians crown',
    'regional final',
    'golden spatula',
    'tactician trial',
    'lore & legends',
    'ko coliseum',
  ],
};
