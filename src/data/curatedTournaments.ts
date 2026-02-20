/**
 * Curated KOI tournament data for TFT and Pokémon VGC.
 *
 * Since these tournaments are NOT reliably available via start.gg
 * (TFT Pro Circuit runs on Riot's systems, VGC runs on RK9 Labs),
 * we maintain a curated list of tournaments where KOI players
 * have participated, are participating, or will participate.
 *
 * Data sourced from Liquipedia:
 *   - https://liquipedia.net/tft/KOI
 *   - https://liquipedia.net/pokemon/KOI
 *
 * To add a new tournament:
 *   1. Add an entry to the appropriate array (tftTournaments / pokemonTournaments)
 *   2. Fill in known fields — unknown fields can be omitted
 *   3. Set status: 'upcoming' | 'live' | 'finished'
 *   4. For finished tournaments, add placement/results to koiParticipants
 */

import { Tournament, TournamentFormat, TournamentPhase, TournamentParticipant, MatchStatus, Game } from '../types';

// ─── Helper: build TFT phases ──────────────────────────────────────

function buildTFTPhases(status: MatchStatus, days: number = 1): TournamentPhase[] {
  if (days <= 1) {
    return [{
      name: 'Tournament',
      day: 1,
      status,
      description: '8-player lobbies, points per placement.',
    }];
  }

  const phases: TournamentPhase[] = [];
  for (let d = 1; d <= days; d++) {
    const phaseName = d === 1
      ? 'Day 1 — Open Lobbies'
      : d < days
        ? `Day ${d} — Elimination`
        : `Day ${d} — Grand Finals`;
    const phaseDesc = d === 1
      ? '8-player lobbies, points per placement. Bottom players eliminated.'
      : d < days
        ? 'Remaining players compete. More eliminations.'
        : 'Final 8 players. First to checkmate.';
    phases.push({
      name: phaseName,
      day: d,
      status: status === 'finished' ? 'finished' : 'upcoming',
      description: phaseDesc,
    });
  }
  return phases;
}

// ─── Helper: build VGC phases ──────────────────────────────────────

function buildVGCPhases(status: MatchStatus): TournamentPhase[] {
  return [
    {
      name: 'Day 1 — Swiss Rounds',
      day: 1,
      status: status === 'finished' ? 'finished' : status,
      description: 'Players matched by W/L record. Top players qualify to Day 2.',
    },
    {
      name: 'Day 2 — Top Cut',
      day: 2,
      status: status === 'finished' ? 'finished' : 'upcoming',
      description: 'Single elimination bracket until a champion is crowned.',
    },
  ];
}

// ─── KOI Player refs ───────────────────────────────────────────────

const tftPlayer = (name: string, opts?: Partial<TournamentParticipant>): TournamentParticipant => ({
  playerId: `static-tft-${name.toLowerCase().replace(/\s+/g, '-')}`,
  playerName: name,
  ...opts,
});

const vgcPlayer = (name: string, opts?: Partial<TournamentParticipant>): TournamentParticipant => ({
  playerId: `static-pokemon-${name.toLowerCase().replace(/\s+/g, '-')}`,
  playerName: name,
  ...opts,
});

// ─── TFT Tournaments ───────────────────────────────────────────────

export const tftTournaments: Tournament[] = [
  // ── 2026 — Upcoming ────────────────────────────────────────────────
  {
    id: 'curated-tft-tacticians-crown-2026',
    teamId: 'static-tft',
    game: 'tft',
    name: 'Lore & Legends: Tactician\'s Crown',
    location: 'TBD',
    startDate: '2026-03-27',
    endDate: '2026-03-29',
    time: '10:00',
    status: 'upcoming',
    format: 'points_elimination',
    totalParticipants: 40,
    phases: buildTFTPhases('upcoming', 3),
    koiParticipants: [
      tftPlayer('Reven'),
      tftPlayer('Dalesom'),
      tftPlayer('Safo20'),
      tftPlayer('ODESZA'),
    ],
    externalUrl: 'https://liquipedia.net/tft/Lore_%26_Legends/Tacticians_Crown',
  },
  {
    id: 'curated-tft-emea-regional-finals-2026',
    teamId: 'static-tft',
    game: 'tft',
    name: 'Lore & Legends: EMEA Regional Finals',
    location: 'Online',
    startDate: '2026-03-06',
    endDate: '2026-03-15',
    time: '18:00',
    status: 'upcoming',
    format: 'points_elimination',
    totalParticipants: 64,
    phases: buildTFTPhases('upcoming', 3),
    koiParticipants: [
      tftPlayer('Reven'),
      tftPlayer('Dalesom'),
      tftPlayer('Safo20'),
      tftPlayer('ODESZA'),
    ],
    externalUrl: 'https://liquipedia.net/tft/Lore_%26_Legends/EMEA/Regional_Finals',
  },

  // ── 2026 — Finished ───────────────────────────────────────────────
  {
    id: 'curated-tft-demacia-cup-2026',
    teamId: 'static-tft',
    game: 'tft',
    name: 'Lore & Legends: TPC - EMEA Demacia Cup',
    location: 'Online',
    startDate: '2026-02-15',
    time: '18:00',
    status: 'finished',
    format: 'points_elimination',
    phases: buildTFTPhases('finished'),
    koiParticipants: [
      tftPlayer('Dalesom', { placement: 2 }),
    ],
    externalUrl: 'https://liquipedia.net/tft/Lore_%26_Legends/TPC/EMEA/Demacia_Cup',
  },
  {
    id: 'curated-tft-emea-tacticians-cup-2-2026',
    teamId: 'static-tft',
    game: 'tft',
    name: 'Lore & Legends: EMEA Tactician\'s Cup #2',
    location: 'Online',
    startDate: '2026-02-08',
    time: '18:00',
    status: 'finished',
    format: 'points_elimination',
    phases: buildTFTPhases('finished'),
    koiParticipants: [
      tftPlayer('Safo20', { placement: 2 }),
    ],
    externalUrl: 'https://liquipedia.net/tft/Lore_%26_Legends/EMEA/Tacticians_Cup/2',
  },
  {
    id: 'curated-tft-amer-bilgewater-cup-2026',
    teamId: 'static-tft',
    game: 'tft',
    name: 'Lore & Legends: TPC - AMER Bilgewater Cup',
    location: 'Online',
    startDate: '2026-01-31',
    time: '18:00',
    status: 'finished',
    format: 'points_elimination',
    phases: buildTFTPhases('finished'),
    koiParticipants: [
      tftPlayer('Dalesom', { placement: 9 }),
    ],
    externalUrl: 'https://liquipedia.net/tft/Lore_%26_Legends/TPC/AMER/Bilgewater_Cup',
  },
  {
    id: 'curated-tft-emea-tacticians-cup-1-2026',
    teamId: 'static-tft',
    game: 'tft',
    name: 'Lore & Legends: EMEA Tactician\'s Cup #1',
    location: 'Online',
    startDate: '2026-01-18',
    time: '18:00',
    status: 'finished',
    format: 'points_elimination',
    phases: buildTFTPhases('finished'),
    koiParticipants: [
      tftPlayer('ODESZA', { placement: 4 }),
    ],
    externalUrl: 'https://liquipedia.net/tft/Lore_%26_Legends/EMEA/Tacticians_Cup/1',
  },
  {
    id: 'curated-tft-emea-shurima-cup-2026',
    teamId: 'static-tft',
    game: 'tft',
    name: 'Lore & Legends: TPC - EMEA Shurima Cup',
    location: 'Online',
    startDate: '2026-01-11',
    time: '18:00',
    status: 'finished',
    format: 'points_elimination',
    phases: buildTFTPhases('finished'),
    koiParticipants: [
      tftPlayer('Reven', { placement: 1 }),
      tftPlayer('Dalesom', { placement: 19 }),
    ],
    externalUrl: 'https://liquipedia.net/tft/Lore_%26_Legends/TPC/EMEA/Shurima_Cup',
  },

  // ── 2025 ──────────────────────────────────────────────────────────
  {
    id: 'curated-tft-paris-open-2025',
    teamId: 'static-tft',
    game: 'tft',
    name: 'Teamfight Tactics Paris Open',
    location: 'Paris, France',
    startDate: '2025-12-14',
    endDate: '2025-12-14',
    time: '10:00',
    status: 'finished',
    format: 'points_elimination',
    totalParticipants: 32,
    phases: buildTFTPhases('finished', 2),
    koiParticipants: [
      tftPlayer('Safo20', { placement: 3 }),
    ],
    externalUrl: 'https://liquipedia.net/tft/Teamfight_Tactics_Paris_Open',
  },
  {
    id: 'curated-tft-emea-regional-finals-2025',
    teamId: 'static-tft',
    game: 'tft',
    name: 'K.O. Coliseum: EMEA Regional Finals',
    location: 'Online',
    startDate: '2025-11-02',
    time: '18:00',
    status: 'finished',
    format: 'points_elimination',
    phases: buildTFTPhases('finished', 2),
    koiParticipants: [
      tftPlayer('Reven', { placement: 16 }),
    ],
    externalUrl: 'https://liquipedia.net/tft/K.O._Coliseum/EMEA/Regional_Finals',
  },
  {
    id: 'curated-tft-emea-star-guardian-cup-2025',
    teamId: 'static-tft',
    game: 'tft',
    name: 'K.O. Coliseum: TFT Pro Circuit - EMEA Star Guardian Cup',
    location: 'Online',
    startDate: '2025-10-05',
    time: '18:00',
    status: 'finished',
    format: 'points_elimination',
    phases: buildTFTPhases('finished'),
    koiParticipants: [
      tftPlayer('Reven', { placement: 8 }),
    ],
    externalUrl: 'https://liquipedia.net/tft/K.O._Coliseum/TPC/EMEA/Star_Guardian_Cup',
  },
  {
    id: 'curated-tft-emea-soul-fighter-cup-2025',
    teamId: 'static-tft',
    game: 'tft',
    name: 'K.O. Coliseum: TFT Pro Circuit - EMEA Soul Fighter Cup',
    location: 'Online',
    startDate: '2025-09-21',
    time: '18:00',
    status: 'finished',
    format: 'points_elimination',
    phases: buildTFTPhases('finished'),
    koiParticipants: [
      tftPlayer('Reven', { placement: 2 }),
    ],
    externalUrl: 'https://liquipedia.net/tft/K.O._Coliseum/TPC/EMEA/Soul_Fighter_Cup',
  },
];

// ─── Pokémon VGC Tournaments ───────────────────────────────────────

export const pokemonTournaments: Tournament[] = [
  // ── 2026 — Upcoming ────────────────────────────────────────────────
  {
    id: 'curated-vgc-worlds-2026',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2026 Pokémon World Championships - VGC',
    location: 'TBD',
    startDate: '2026-08-14',
    endDate: '2026-08-16',
    time: '09:00',
    status: 'upcoming',
    format: 'swiss_to_bracket',
    phases: buildVGCPhases('upcoming'),
    koiParticipants: [
      vgcPlayer('Eric Rios'),
      vgcPlayer('Alex Gómez'),
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2026_Pok%C3%A9mon_World_Championships/VGC',
  },
  {
    id: 'curated-vgc-naic-2026',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2026 Pokémon North America International Championships - VGC',
    location: 'New Orleans, US',
    startDate: '2026-06-13',
    endDate: '2026-06-15',
    time: '09:00',
    status: 'upcoming',
    format: 'swiss_to_bracket',
    totalParticipants: 1200,
    phases: buildVGCPhases('upcoming'),
    koiParticipants: [
      vgcPlayer('Eric Rios'),
      vgcPlayer('Alex Gómez'),
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2026_Pok%C3%A9mon_North_America_International_Championships/VGC',
  },

  // ── 2026 — Finished ───────────────────────────────────────────────
  {
    id: 'curated-vgc-euic-2026',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2026 Pokémon Europe International Championships - VGC',
    location: 'London, UK',
    startDate: '2026-02-14',
    endDate: '2026-02-16',
    time: '09:00',
    status: 'finished',
    format: 'swiss_to_bracket',
    totalParticipants: 1000,
    phases: buildVGCPhases('finished'),
    koiParticipants: [
      vgcPlayer('Alex Gómez', { placement: 13 }),   // 9th-16th
      vgcPlayer('Eric Rios', { placement: 7 }),      // 5th-8th
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2026_Pok%C3%A9mon_Europe_International_Championships/VGC',
  },

  // ── 2025/2026 Season ──────────────────────────────────────────────
  {
    id: 'curated-vgc-stuttgart-regional-2025',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2026 Pokémon Stuttgart Regional Championships - VGC',
    location: 'Stuttgart, Germany',
    startDate: '2025-11-30',
    endDate: '2025-12-01',
    time: '09:00',
    status: 'finished',
    format: 'swiss_to_bracket',
    phases: buildVGCPhases('finished'),
    koiParticipants: [
      vgcPlayer('Eric Rios', { placement: 2 }),
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2026_Pok%C3%A9mon_Stuttgart_Regional_Championships/VGC',
  },

  // ── 2024/2025 Season ──────────────────────────────────────────────
  {
    id: 'curated-vgc-naic-2025',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2025 Pokémon North America International Championships - VGC',
    location: 'New Orleans, US',
    startDate: '2025-06-14',
    endDate: '2025-06-16',
    time: '09:00',
    status: 'finished',
    format: 'swiss_to_bracket',
    totalParticipants: 1200,
    phases: buildVGCPhases('finished'),
    koiParticipants: [
      vgcPlayer('Eric Rios', { placement: 4 }),     // 3rd-4th
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2025_Pok%C3%A9mon_North_America_International_Championships/VGC',
  },
  {
    id: 'curated-vgc-stockholm-regional-2025',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2025 Pokémon Stockholm Regional Championships - VGC',
    location: 'Stockholm, Sweden',
    startDate: '2025-03-23',
    endDate: '2025-03-24',
    time: '09:00',
    status: 'finished',
    format: 'swiss_to_bracket',
    phases: buildVGCPhases('finished'),
    koiParticipants: [
      vgcPlayer('Eric Rios', { placement: 2 }),
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2025_Pok%C3%A9mon_Stockholm_Regional_Championships/VGC',
  },
  {
    id: 'curated-vgc-birmingham-regional-2025',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2025 Pokémon Birmingham Regional Championships - VGC',
    location: 'Birmingham, UK',
    startDate: '2025-01-19',
    endDate: '2025-01-20',
    time: '09:00',
    status: 'finished',
    format: 'swiss_to_bracket',
    phases: buildVGCPhases('finished'),
    koiParticipants: [
      vgcPlayer('Alex Gómez', { placement: 4 }),    // 3rd-4th
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2025_Pok%C3%A9mon_Birmingham_Regional_Championships/VGC',
  },
  {
    id: 'curated-vgc-laic-2024',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2025 Pokémon Latin America International Championships - VGC',
    location: 'São Paulo, Brazil',
    startDate: '2024-11-16',
    endDate: '2024-11-18',
    time: '09:00',
    status: 'finished',
    format: 'swiss_to_bracket',
    totalParticipants: 900,
    phases: buildVGCPhases('finished'),
    koiParticipants: [
      vgcPlayer('Eric Rios', { placement: 7 }),     // 5th-8th
      vgcPlayer('Alex Gómez', { placement: 7 }),    // 5th-8th
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2025_Pok%C3%A9mon_Latin_America_International_Championships/VGC',
  },

  // ── 2023/2024 Season ──────────────────────────────────────────────
  {
    id: 'curated-vgc-naic-2024',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2024 Pokémon North America International Championships - VGC',
    location: 'New Orleans, US',
    startDate: '2024-06-09',
    endDate: '2024-06-11',
    time: '09:00',
    status: 'finished',
    format: 'swiss_to_bracket',
    totalParticipants: 1100,
    phases: buildVGCPhases('finished'),
    koiParticipants: [
      vgcPlayer('Eric Rios', { placement: 13 }),    // 9th-16th
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2024_Pok%C3%A9mon_North_America_International_Championships/VGC',
  },
  {
    id: 'curated-vgc-euic-2024',
    teamId: 'static-pokemon',
    game: 'pokemon_vgc',
    name: '2024 Pokémon Europe International Championships - VGC',
    location: 'London, UK',
    startDate: '2024-04-06',
    endDate: '2024-04-08',
    time: '09:00',
    status: 'finished',
    format: 'swiss_to_bracket',
    totalParticipants: 1000,
    phases: buildVGCPhases('finished'),
    koiParticipants: [
      vgcPlayer('Alex Gómez', { placement: 4 }),    // 3rd-4th
    ],
    externalUrl: 'https://liquipedia.net/pokemon/2024_Pok%C3%A9mon_Europe_International_Championships/VGC',
  },
];

// ─── Combined export ───────────────────────────────────────────────

/** All curated KOI tournaments (TFT + Pokémon VGC) sorted newest first */
export const allCuratedTournaments: Tournament[] = [
  ...tftTournaments,
  ...pokemonTournaments,
].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

/** Get curated tournaments filtered by status */
export function getCuratedTournamentsByStatus(status: MatchStatus): Tournament[] {
  return allCuratedTournaments.filter((t) => t.status === status);
}

/** Get curated tournaments for a specific game */
export function getCuratedTournamentsByGame(game: Game): Tournament[] {
  return allCuratedTournaments.filter((t) => t.game === game);
}

/** Get curated tournaments for a specific team */
export function getCuratedTournamentsByTeam(teamId: string): Tournament[] {
  return allCuratedTournaments.filter((t) => t.teamId === teamId);
}

/** Find a curated tournament by ID */
export function getCuratedTournamentById(id: string): Tournament | undefined {
  return allCuratedTournaments.find((t) => t.id === id);
}
