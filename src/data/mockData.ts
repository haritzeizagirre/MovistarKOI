import { Game } from '../types';
import { ImageSourcePropType } from 'react-native';

// ─── Game color mappings (used by components) ───────────────────────
export const gameColors: Record<Game, string> = {
  league_of_legends: '#C89B3C',
  valorant: '#FF4655',
  tft: '#E8A33D',
  call_of_duty: '#4CAF50',
  pokemon_vgc: '#FFCB05',
};

export const gameIcons: Record<Game, string> = {
  league_of_legends: 'gamepad-variant',
  valorant: 'target',
  tft: 'chess-knight',
  call_of_duty: 'crosshairs-gps',
  pokemon_vgc: 'pokeball',
};

// ─── Game logo images (local PNGs) ──────────────────────────────────
export const gameLogos: Record<Game, ImageSourcePropType> = {
  league_of_legends: require('../../assets/games/lol.png'),
  valorant: require('../../assets/games/valorant.png'),
  tft: require('../../assets/games/tft.png'),
  call_of_duty: require('../../assets/games/cod.png'),
  pokemon_vgc: require('../../assets/games/pokemon.png'),
};
