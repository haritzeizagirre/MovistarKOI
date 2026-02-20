// ─── Game Enum ───────────────────────────────────────────
export type Game =
  | 'league_of_legends'
  | 'valorant'
  | 'tft'
  | 'call_of_duty'
  | 'pokemon_vgc';

// ─── Team ────────────────────────────────────────────────
export interface Team {
  id: string;
  name: string;
  game: Game;
  division: string;          // e.g. "LEC", "Superliga", "VCT", etc.
  logoUrl: string;
  bannerUrl?: string;
  description: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    twitch?: string;
  };
  members: Player[];
  coach?: StaffMember;
  analyst?: StaffMember;
}

// ─── Player ──────────────────────────────────────────────
export interface Player {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  role: string;              // e.g. "Top", "Jungle", "Mid", "ADC", "Support", "Duelist", etc.
  nationality: string;
  photoUrl: string;
  age?: number;
  socialLinks?: {
    twitter?: string;
    twitch?: string;
  };
}

// ─── Staff Member ────────────────────────────────────────
export interface StaffMember {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  role: string;              // "Head Coach", "Analyst", "Manager"
  nationality: string;
  photoUrl: string;
}

// ─── Match ───────────────────────────────────────────────
export type MatchStatus = 'upcoming' | 'live' | 'finished';

export interface Match {
  id: string;
  teamId: string;
  game: Game;
  tournament: string;        // e.g. "LEC Spring 2026"
  matchType?: string;        // e.g. "Regular Season", "Playoffs", "Grand Final"
  standing?: string;         // e.g. "3rd / 10" — KOI's position in this stage
  opponentStanding?: string; // e.g. "1st / 10" — Opponent's position
  date: string;              // ISO date
  time: string;              // "18:00"
  status: MatchStatus;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  bestOf: number;            // Bo1, Bo3, Bo5
  streamUrl?: string;
  games?: MatchGame[];       // Detailed data per game in the series
}

export interface MatchTeam {
  id?: string;
  name: string;
  tag: string;
  logoUrl: string;
  score?: number;
}

// ─── Match Details (Games/Maps) ──────────────────────────
export interface MatchGame {
  id: string;
  number: number;
  status: MatchStatus;
  map?: MatchMap;
  winnerId?: string;
  length?: number; // duration in seconds
  beginAt?: string; // game start time
  homeTeamScore?: number; // e.g., round wins in Valorant
  awayTeamScore?: number;
  draft?: MatchDraft; // for LoL / Valorant
}

export interface MatchMap {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface MatchDraft {
  homeTeamDetails?: DraftTeamDetails;
  awayTeamDetails?: DraftTeamDetails;
}

export interface DraftTeamDetails {
  picks: DraftPick[];
  bans: DraftBan[];
  side?: 'blue' | 'red' | 'attacker' | 'defender'; // LoL sides or Valo starting sides
}

export interface DraftPick {
  championId: string;
  championName: string;
  championImageUrl?: string;
  playerId?: string;
  stats?: DraftPlayerStats;
}

export interface DraftPlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  cs?: number; // Creep score
  gold?: number; // Total gold
}

export interface DraftBan {
  championId: string;
  championName: string;
  championImageUrl?: string;
}

// ─── Tournament (TFT / Pokémon VGC) ─────────────────────

/** Games that use tournament format instead of team-vs-team matches */
export const TOURNAMENT_GAMES: Game[] = ['tft', 'pokemon_vgc'];

/** Check if a game uses tournament format */
export function isTournamentGame(game: Game): boolean {
  return TOURNAMENT_GAMES.includes(game);
}

/**
 * Tournament format descriptor.
 * - points_elimination: TFT style – 8 players per lobby, points per placement, bottom eliminated each round
 * - swiss_to_bracket:   Pokémon VGC style – Swiss Day 1, top-cut single elimination Day 2
 * - bracket:            Pure single/double elimination bracket
 * - other:              Catch-all
 */
export type TournamentFormat = 'points_elimination' | 'swiss_to_bracket' | 'bracket' | 'other';

/** A phase/day within a tournament */
export interface TournamentPhase {
  name: string;               // "Day 1", "Swiss Rounds", "Top Cut", "Grand Finals"
  day: number;                // 1-indexed day number
  status: MatchStatus;        // upcoming / live / finished
  description?: string;       // Optional human-readable description
  qualifyingCount?: number;   // How many players qualify from this phase
}

/** A KOI player's status in a tournament */
export interface TournamentParticipant {
  playerId: string;            // Links to Player.id
  playerName: string;          // Display name / gamerTag
  photoUrl?: string;
  placement?: number;          // Final placement (1st, 2nd, 3rd…)
  wins?: number;               // For swiss/bracket formats
  losses?: number;
  points?: number;             // For points-based formats (TFT)
  eliminated?: boolean;        // Whether the player has been knocked out
  currentPhaseName?: string;   // Which phase they're currently in
}

export interface Tournament {
  id: string;
  teamId: string;              // Links to the static team (e.g. 'static-tft')
  game: Game;
  name: string;                // Tournament name
  location?: string;           // City, Country or "Online"
  startDate: string;           // ISO date (first day)
  endDate?: string;            // ISO date (last day) — multi-day events
  time: string;                // Start time
  status: MatchStatus;
  format: TournamentFormat;
  totalParticipants?: number;
  phases?: TournamentPhase[];
  koiParticipants: TournamentParticipant[];
  streamUrl?: string;
  imageUrl?: string;
  externalUrl?: string;        // Link to start.gg page
}

/**
 * Union type for items displayed in Calendar / Results lists.
 * Use isTournament() type guard to discriminate.
 */
export type CalendarItem = Match | Tournament;

/** Type guard: is this calendar item a Tournament? */
export function isTournament(item: CalendarItem): item is Tournament {
  return 'format' in item && 'koiParticipants' in item;
}

/** Type guard: is this calendar item a Match? */
export function isMatch(item: CalendarItem): item is Match {
  return 'homeTeam' in item && 'awayTeam' in item;
}

/** Get the sort date from either a Match or Tournament */
export function getItemDate(item: CalendarItem): string {
  return isTournament(item) ? item.startDate : item.date;
}

/** Get the status from either a Match or Tournament */
export function getItemStatus(item: CalendarItem): MatchStatus {
  return item.status;
}

/** Get the game from either a Match or Tournament */
export function getItemGame(item: CalendarItem): Game {
  return item.game;
}

// ─── Notification Preference ─────────────────────────────
export interface NotificationPreference {
  teamId: string;
  enabled: boolean;
  matchReminders: boolean;
  liveAlerts: boolean;
  resultAlerts: boolean;
}

// ─── User Settings ───────────────────────────────────────
export interface UserSettings {
  language: 'es' | 'en';
  notificationPreferences: NotificationPreference[];
  favoriteTeams: string[];
}

// ─── Navigation Types ────────────────────────────────────
export type RootTabParamList = {
  TeamsTab: undefined;
  CalendarTab: undefined;
  ResultsTab: undefined;
  SettingsTab: undefined;
};

export type TeamsStackParamList = {
  TeamsList: undefined;
  TeamDetail: { teamId: string };
  PlayerDetail: { playerId: string; teamId: string };
};

export type CalendarStackParamList = {
  CalendarMain: undefined;
  MatchDetail: { matchId: string };
  TournamentDetail: { tournamentId: string };
};

export type ResultsStackParamList = {
  ResultsMain: undefined;
  MatchDetail: { matchId: string };
  TournamentDetail: { tournamentId: string };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  NotificationSettings: undefined;
  LanguageSettings: undefined;
  Login: undefined;
  Register: undefined;
};
