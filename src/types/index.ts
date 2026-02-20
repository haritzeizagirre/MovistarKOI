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
};

export type ResultsStackParamList = {
  ResultsMain: undefined;
  MatchDetail: { matchId: string };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  NotificationSettings: undefined;
  LanguageSettings: undefined;
  Login: undefined;
  Register: undefined;
};
