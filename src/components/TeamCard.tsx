import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme';
import { Team, Game } from '../types';
import { gameColors, gameLogos } from '../data/mockData';
import { useTranslation } from 'react-i18next';

interface TeamCardProps {
  team: Team;
  onPress: () => void;
}

export default function TeamCard({ team, onPress }: TeamCardProps) {
  const { t } = useTranslation();
  const gameColor = gameColors[team.game];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.gameIndicator, { backgroundColor: gameColor }]} />
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={[styles.logoPlaceholder, { borderColor: gameColor }]}>
            <Image
              source={gameLogos[team.game]}
              style={styles.gameLogo}
              resizeMode="contain"
            />
          </View>
        </View>
        <View style={styles.info}>
          <Text style={styles.teamName} numberOfLines={1}>
            {team.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: gameColor + '20' }]}>
              <Text style={[styles.badgeText, { color: gameColor }]}>
                {t(`games.${team.game}`)}
              </Text>
            </View>
            <Text style={styles.division}>{team.division}</Text>
          </View>
          <Text style={styles.memberCount}>
            {team.members.length} {t('teams.members')}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={Colors.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  gameIndicator: {
    width: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  logoContainer: {
    marginRight: Spacing.md,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  gameLogo: {
    width: 34,
    height: 34,
  },
  info: {
    flex: 1,
  },
  teamName: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  division: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  memberCount: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});
