/**
 * Liquipedia Configuration
 *
 * Minimal configuration for automated tournament data fetching.
 * Update these values when a new TFT set launches or a new Pokemon
 * championship year begins (typically 2 updates per year total).
 *
 * Everything else is automated via Liquipedia API parsing.
 */

/**
 * Current TFT set/season page slug on Liquipedia.
 *
 * This determines which season page is scraped for upcoming EMEA events.
 * Update this when a new TFT set launches (~every 6 months).
 *
 * Find the current season at: https://liquipedia.net/tft/Main_Page
 * Use the page slug (the part after /tft/ in the URL, URL-encoded).
 *
 * History:
 *   - K.O. Coliseum  → 'K.O._Coliseum'
 *   - Lore & Legends → 'Lore_%26_Legends'   (current, Set 16)
 */
export const TFT_SEASON_PAGE = 'Lore_%26_Legends';

/**
 * Current Pokémon Championship Series year.
 *
 * Update once per year when the new season starts (usually September).
 *
 * The page fetched will be: /pokemon/Pokemon_Championships/{YEAR}
 */
export const POKEMON_CHAMPIONSHIP_YEAR = '2026';

/**
 * TFT regions relevant to KOI players.
 * KOI competes in EMEA events + World championship.
 * These keywords are matched against region labels on the season page.
 */
export const KOI_TFT_REGIONS = ['EMEA', 'Europe', 'World'];

/**
 * KOI TFT player names (used to populate koiParticipants on upcoming events).
 * These should match the nicknames in staticTeams.ts.
 */
export const KOI_TFT_PLAYERS = ['Reven', 'Dalesom', 'Safo20', 'ODESZA'];

/**
 * KOI Pokémon VGC player names.
 */
export const KOI_VGC_PLAYERS = ['Eric Rios', 'Alex Gómez'];

// ─── Call of Duty ────────────────────────────────────────────────────

/**
 * Current CDL season page slug on Liquipedia.
 *
 * Update once per year when the new CDL season starts.
 * Find at: https://liquipedia.net/callofduty/Main_Page
 *
 * History:
 *   - Call_of_Duty_League/2025  (Black Ops 6)
 *   - Call_of_Duty_League/2026  (current)
 */
export const CDL_SEASON_PAGE = 'Call_of_Duty_League/2026';

/**
 * KOI's CoD team name as it appears on Liquipedia.
 * Used to match teams in bracket/match data.
 */
export const KOI_COD_TEAM_NAME = 'KOI';

/**
 * Known CoD game modes and their short labels.
 * Used for display in the UI and for matching Liquipedia text.
 */
export const COD_GAME_MODES: Record<string, string> = {
  'Hardpoint': 'HP',
  'Search and Destroy': 'S&D',
  'Search & Destroy': 'S&D',
  'Control': 'CTL',
  'S&D': 'S&D',
  'HP': 'HP',
  'CTL': 'CTL',
};
