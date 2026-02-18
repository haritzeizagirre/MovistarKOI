/**
 * Static team data for games not supported by PandaScore.
 * Source: Liquipedia (https://liquipedia.net)
 * Last updated: 2026-02-16
 */
import { Team, Player } from '../types';

// ─── TFT Team ──────────────────────────────────────────────────────

const tftPlayers: Player[] = [
  {
    id: 'static-tft-1',
    nickname: 'Reven',
    firstName: 'Antonio',
    lastName: 'Pino',
    role: 'Player',
    nationality: 'ES',
    photoUrl: 'https://liquipedia.net/commons/images/thumb/7/77/Reven_EMEA_2025.jpg/600px-Reven_EMEA_2025.jpg',
  },
  {
    id: 'static-tft-2',
    nickname: 'Dalesom',
    firstName: 'Ignacio',
    lastName: 'Cosano Perea',
    role: 'Player',
    nationality: 'ES',
    photoUrl: 'https://via.placeholder.com/200x200?text=Dalesom',
  },
  {
    id: 'static-tft-3',
    nickname: 'ODESZA',
    firstName: '',
    lastName: '',
    role: 'Player',
    nationality: 'ES',
    photoUrl: 'https://via.placeholder.com/200x200?text=ODESZA',
  },
  {
    id: 'static-tft-4',
    nickname: 'Safo20',
    firstName: 'Marc',
    lastName: 'Safont',
    role: 'Player',
    nationality: 'ES',
    photoUrl: 'https://via.placeholder.com/200x200?text=Safo20',
  },
];

export const tftTeam: Team = {
  id: 'static-tft',
  name: 'KOI TFT',
  game: 'tft',
  division: 'Lore & Legends',
  logoUrl: 'https://liquipedia.net/commons/images/thumb/5/54/KOI_2024_blue_allmode.png/600px-KOI_2024_blue_allmode.png',
  description: 'Equipo profesional de Teamfight Tactics de Movistar KOI.',
  members: tftPlayers,
  coach: {
    id: 'static-tft-coach',
    nickname: 'estanishing',
    firstName: 'Estanis',
    lastName: '',
    role: 'Head Coach',
    nationality: 'ES',
    photoUrl: 'https://via.placeholder.com/200x200?text=estanishing',
  },
  socialLinks: {
    twitter: 'https://twitter.com/MovistarKOI',
    instagram: 'https://instagram.com/movistarkoi',
  },
};

// ─── Pokémon VGC Team ──────────────────────────────────────────────

const pokemonPlayers: Player[] = [
  {
    id: 'static-pokemon-1',
    nickname: 'Alex Gómez',
    firstName: 'Alex',
    lastName: 'Gómez Berna',
    role: 'Player',
    nationality: 'ES',
    photoUrl: 'https://via.placeholder.com/200x200?text=Alex+G%C3%B3mez',
  },
  {
    id: 'static-pokemon-2',
    nickname: 'Eric Rios',
    firstName: 'Eric',
    lastName: 'Rios',
    role: 'Player',
    nationality: 'ES',
    photoUrl: 'https://via.placeholder.com/200x200?text=Eric+Rios',
  },
];

export const pokemonTeam: Team = {
  id: 'static-pokemon',
  name: 'KOI Pokémon VGC',
  game: 'pokemon_vgc',
  division: 'VGC Circuit',
  logoUrl: 'https://liquipedia.net/commons/images/thumb/5/54/KOI_2024_blue_allmode.png/600px-KOI_2024_blue_allmode.png',
  description: 'Equipo profesional de Pokémon VGC de Movistar KOI.',
  members: pokemonPlayers,
  socialLinks: {
    twitter: 'https://twitter.com/MovistarKOI',
    instagram: 'https://instagram.com/movistarkoi',
  },
};

/** All static teams (games not on PandaScore) */
export const staticTeams: Team[] = [tftTeam, pokemonTeam];
