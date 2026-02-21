import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme';
import { Tournament, TournamentParticipant } from '../types';
import { gameColors } from '../data/mockData';
import { useTranslation } from 'react-i18next';

interface TournamentCardProps {
  tournament: Tournament;
  onPress?: () => void;
}

export default function TournamentCard({ tournament, onPress }: TournamentCardProps) {
  const { t } = useTranslation();
  const gameColor = gameColors[tournament.game];

  const isLive = tournament.status === 'live';
  const isFinished = tournament.status === 'finished';
  const isUpcoming = tournament.status === 'upcoming';

  // Format date range
  const formatDateRange = () => {
    const start = new Date(tournament.startDate);
    const now = new Date();
    const isToday = start.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = start.toDateString() === tomorrow.toDateString();

    const startStr = isToday
      ? t('calendar.today')
      : isTomorrow
        ? t('tournament.tomorrow')
        : start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

    if (tournament.endDate && tournament.endDate !== tournament.startDate) {
      const end = new Date(tournament.endDate);
      const endStr = end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      return `${startStr} — ${endStr}`;
    }
    return `${startStr} · ${tournament.time}`;
  };

  // Get current phase name for live tournaments
  const currentPhase = tournament.phases?.find((p) => p.status === 'live');

  // Determine card accent
  const cardAccent = isLive
    ? Colors.live
    : isFinished
      ? gameColor
      : Colors.upcoming;

  // Format placement
  const formatPlacement = (p: number): string => {
    if (p === 1) return '1st';
    if (p === 2) return '2nd';
    if (p === 3) return '3rd';
    return `${p}th`;
  };

  // Get best KOI placement for finished tournaments
  const bestPlacement = isFinished
    ? tournament.koiParticipants
        .filter((p) => p.placement !== undefined)
        .sort((a, b) => (a.placement ?? 999) - (b.placement ?? 999))[0]
    : null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isLive && styles.liveCard,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      {/* Left accent stripe */}
      <View style={[styles.accentStripe, { backgroundColor: cardAccent }]} />

      <View style={styles.cardContent}>
        {/* Header: game + status */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.gameDot, { backgroundColor: gameColor }]} />
            <View style={styles.gameTag}>
              <Ionicons name="trophy-outline" size={10} color={gameColor} style={{ marginRight: 3 }} />
              <Text style={[styles.gameTagText, { color: gameColor }]}>
                {t('tournament.label')}
              </Text>
            </View>
          </View>

          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN VIVO</Text>
            </View>
          )}
          {isFinished && bestPlacement && (
            <View style={[
              styles.placementBadge,
              bestPlacement.placement === 1 && styles.goldBadge,
              bestPlacement.placement === 2 && styles.silverBadge,
              bestPlacement.placement === 3 && styles.bronzeBadge,
              (bestPlacement.placement ?? 0) > 3 && styles.defaultBadge,
            ]}>
              <Ionicons
                name={bestPlacement.placement === 1 ? 'trophy' : 'medal-outline'}
                size={12}
                color={
                  bestPlacement.placement === 1 ? '#FFD700' :
                  bestPlacement.placement === 2 ? '#C0C0C0' :
                  bestPlacement.placement === 3 ? '#CD7F32' :
                  Colors.textSecondary
                }
                style={{ marginRight: 3 }}
              />
              <Text style={[
                styles.placementText,
                bestPlacement.placement === 1 && { color: '#FFD700' },
                bestPlacement.placement === 2 && { color: '#C0C0C0' },
                bestPlacement.placement === 3 && { color: '#CD7F32' },
              ]}>
                {formatPlacement(bestPlacement.placement!)}
              </Text>
            </View>
          )}
          {isUpcoming && (
            <View style={styles.dateBadge}>
              <Ionicons name="calendar-outline" size={12} color={Colors.upcoming} style={{ marginRight: 3 }} />
              <Text style={styles.dateText}>{formatDateRange()}</Text>
            </View>
          )}
        </View>

        {/* Tournament name */}
        <Text style={styles.tournamentName} numberOfLines={2}>
          {tournament.name}
        </Text>

        {/* Location + participants info row */}
        <View style={styles.infoRow}>
          {!!tournament.location && (
            <View style={styles.infoPill}>
              <Ionicons
                name={tournament.location === 'Online' ? 'globe-outline' : 'location-outline'}
                size={11}
                color={Colors.textMuted}
              />
              <Text style={styles.infoText}>{tournament.location}</Text>
            </View>
          )}
          {!!tournament.totalParticipants && (
            <View style={styles.infoPill}>
              <Ionicons name="people-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.infoText}>{tournament.totalParticipants} {t('tournament.participants')}</Text>
            </View>
          )}
          {isLive && !isFinished && (
            <View style={styles.infoPill}>
              <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.infoText}>{formatDateRange()}</Text>
            </View>
          )}
          {isFinished && (
            <View style={styles.infoPill}>
              <Ionicons name="checkmark-circle-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.infoText}>{formatDateRange()}</Text>
            </View>
          )}
        </View>

        {/* Current phase (for live) */}
        {isLive && currentPhase && (
          <View style={styles.phaseRow}>
            <View style={styles.phaseBadge}>
              <Ionicons name="play-circle" size={12} color={Colors.live} style={{ marginRight: 4 }} />
              <Text style={styles.phaseText}>{currentPhase.name}</Text>
            </View>
            {!!currentPhase.description && (
              <Text style={styles.phaseDescription}>{currentPhase.description}</Text>
            )}
          </View>
        )}

        {/* Format badge */}
        <View style={styles.formatRow}>
          <View style={styles.formatBadge}>
            <Ionicons
              name={tournament.format === 'points_elimination' ? 'stats-chart' : 'git-branch-outline'}
              size={10}
              color={Colors.textMuted}
              style={{ marginRight: 3 }}
            />
            <Text style={styles.formatText}>
              {t(`tournament.format_${tournament.format}`)}
            </Text>
          </View>
        </View>

        {/* KOI Players section */}
        {tournament.koiParticipants.length > 0 && (
          <View style={styles.playersSection}>
            <View style={styles.playersDivider} />
            <View style={styles.playersContainer}>
              {tournament.koiParticipants.map((participant, index) => (
                <View key={participant.playerId} style={styles.playerRow}>
                  {/* Player avatar */}
                  {participant.photoUrl ? (
                    <Image source={{ uri: participant.photoUrl }} style={styles.playerAvatar} />
                  ) : (
                    <View style={[styles.playerAvatarPlaceholder, { borderColor: gameColor + '60' }]}>
                      <Text style={styles.playerInitial}>
                        {participant.playerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {/* Player name */}
                  <Text style={styles.playerName} numberOfLines={1}>
                    {participant.playerName}
                  </Text>

                  {/* Player status/result */}
                  {isFinished && participant.placement !== undefined && (
                    <View style={[
                      styles.playerPlacement,
                      participant.placement <= 3 && styles.topPlacement,
                    ]}>
                      <Text style={[
                        styles.playerPlacementText,
                        participant.placement === 1 && { color: '#FFD700' },
                        participant.placement === 2 && { color: '#C0C0C0' },
                        participant.placement === 3 && { color: '#CD7F32' },
                      ]}>
                        {formatPlacement(participant.placement)}
                      </Text>
                    </View>
                  )}

                  {isFinished && participant.eliminated && participant.placement === undefined && (
                    <Text style={styles.eliminatedText}>{t('tournament.eliminated')}</Text>
                  )}

                  {isLive && participant.points !== undefined && (
                    <View style={styles.pointsBadge}>
                      <Text style={styles.pointsText}>{participant.points} pts</Text>
                    </View>
                  )}

                  {isLive && participant.wins !== undefined && (
                    <View style={styles.recordBadge}>
                      <Text style={styles.recordText}>
                        {participant.wins}W-{participant.losses ?? 0}L
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Stream / external link for live */}
        {isLive && !!tournament.streamUrl && (
          <View style={styles.streamRow}>
            <Ionicons name="play-circle" size={14} color={Colors.live} />
            <Text style={styles.streamText}>{t('tournament.watchLive')}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs + 2,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  liveCard: {
    borderColor: Colors.live + '40',
    borderWidth: 1,
  },
  accentStripe: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  gameDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  gameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  gameTagText: {
    fontSize: FontSize.xs - 1,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.live + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.live + '30',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.live,
    marginRight: 5,
  },
  liveText: {
    color: Colors.live,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  placementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
  },
  goldBadge: {
    backgroundColor: '#FFD700' + '18',
    borderColor: '#FFD700' + '40',
  },
  silverBadge: {
    backgroundColor: '#C0C0C0' + '18',
    borderColor: '#C0C0C0' + '40',
  },
  bronzeBadge: {
    backgroundColor: '#CD7F32' + '18',
    borderColor: '#CD7F32' + '40',
  },
  defaultBadge: {
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.border,
  },
  placementText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.upcoming + '12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  dateText: {
    color: Colors.upcoming,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  tournamentName: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  phaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.live + '12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
  },
  phaseText: {
    color: Colors.live,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  phaseDescription: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  formatRow: {
    marginBottom: Spacing.sm,
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
    alignSelf: 'flex-start',
  },
  formatText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs - 1,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  playersSection: {
    marginTop: 2,
  },
  playersDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  playersContainer: {
    gap: Spacing.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    marginRight: Spacing.sm,
  },
  playerAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  playerInitial: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  playerName: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  playerPlacement: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  topPlacement: {
    backgroundColor: Colors.surfaceHover,
  },
  playerPlacementText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  eliminatedText: {
    color: Colors.loss,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  pointsBadge: {
    backgroundColor: Colors.tft + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  pointsText: {
    color: Colors.tft,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  recordBadge: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  recordText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  streamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  streamText: {
    color: Colors.live,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginLeft: 5,
  },
});
