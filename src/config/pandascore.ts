// PandaScore API Configuration
// Register for a free API key at https://pandascore.co
// Free tier: 1,000 requests/hour

export const PANDASCORE_API_KEY = 'oQKyaHu941EUEiVxECb28ZmOT4-kNhRASxOQkmsvP727nru8-jE'; // TODO: Replace with your token
export const PANDASCORE_BASE_URL = 'https://api.pandascore.co';

// Movistar KOI team slugs on PandaScore
// These are the identifiers used by PandaScore to identify KOI teams
export const KOI_TEAM_SLUGS: Record<string, string> = {
  // League of Legends
  'koi-lol': 'koi-rl', // KOI in LEC (slug may vary — will be resolved dynamically)

  // Valorant
  'koi-valorant': 'koi-valorant',

  // Call of Duty
  'koi-cod': 'toronto-koi', // Toronto KOI in CDL
};

// PandaScore videogame slugs
export const GAME_SLUGS = {
  league_of_legends: 'league-of-legends',
  valorant: 'valorant',
  call_of_duty: 'cod-mw',
  // TFT is not on PandaScore
} as const;

// Supported games on PandaScore
export const PANDASCORE_SUPPORTED_GAMES = ['league_of_legends', 'valorant', 'call_of_duty'] as const;
