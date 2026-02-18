import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme';
import { Player } from '../types';

interface PlayerCardProps {
  player: Player;
  onPress?: () => void;
  gameColor?: string;
}

const FLAG_EMOJIS: Record<string, string> = {
  ES: '🇪🇸',
  SE: '🇸🇪',
  PL: '🇵🇱',
  GR: '🇬🇷',
  RU: '🇷🇺',
  UA: '🇺🇦',
  TR: '🇹🇷',
  DE: '🇩🇪',
  FR: '🇫🇷',
  KR: '🇰🇷',
  DK: '🇩🇰',
  BE: '🇧🇪',
};

export default function PlayerCard({ player, onPress, gameColor = Colors.primary }: PlayerCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      <View style={[styles.avatar, { borderColor: gameColor }]}>
        <Ionicons name="person" size={24} color={gameColor} />
      </View>
      <View style={styles.info}>
        <Text style={styles.nickname}>{player.nickname}</Text>
        <Text style={styles.realName}>
          {player.firstName} {player.lastName}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.roleBadge, { backgroundColor: gameColor + '20' }]}>
            <Text style={[styles.roleText, { color: gameColor }]}>
              {player.role}
            </Text>
          </View>
          <Text style={styles.flag}>
            {FLAG_EMOJIS[player.nationality] || '🏳️'} {player.nationality}
          </Text>
        </View>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginRight: Spacing.md,
  },
  info: {
    flex: 1,
  },
  nickname: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  realName: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  roleText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  flag: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});
