import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme';
import { Game } from '../types';
import { gameColors, gameLogos } from '../data/mockData';
import { useTranslation } from 'react-i18next';

interface GameFilterProps {
  selectedGame: Game | null;
  onSelect: (game: Game | null) => void;
}

const games: (Game | null)[] = [
  null, // "All"
  'league_of_legends',
  'valorant',
  'call_of_duty',
  'tft',
  'pokemon_vgc',
];

export default function GameFilter({ selectedGame, onSelect }: GameFilterProps) {
  const { t } = useTranslation();

  const getLabel = (game: Game | null) => {
    if (game === null) return t('calendar.allGames');
    return t(`games.${game}`);
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={styles.container}
    >
      {games.map((game) => {
        const isSelected = game === selectedGame;
        const color = game ? gameColors[game] : Colors.primary;

        return (
          <TouchableOpacity
            key={game ?? 'all'}
            style={[
              styles.chip,
              isSelected && { backgroundColor: color + '30', borderColor: color },
              !isSelected && styles.chipInactive,
            ]}
            onPress={() => onSelect(game)}
          >
            <View style={styles.chipContent}>
              {game && (
                <Image
                  source={gameLogos[game]}
                  style={[
                    styles.chipLogo,
                    !isSelected && { opacity: 0.5 },
                  ]}
                  resizeMode="contain"
                />
              )}
              <Text
                style={[
                  styles.chipText,
                  isSelected && { color },
                  !isSelected && styles.chipTextInactive,
                ]}
              >
                {getLabel(game)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  chipInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipLogo: {
    width: 18,
    height: 18,
    marginRight: 6,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  chipTextInactive: {
    color: Colors.textSecondary,
  },
});
