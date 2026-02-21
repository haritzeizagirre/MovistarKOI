import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { Tournament, TournamentParticipant, ResultsStackParamList, CalendarStackParamList } from '../../types';
import { ErrorView, LoadingIndicator } from '../../components/StatusViews';
import { gameColors } from '../../data/mockData';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { fetchTournamentById } from '../../services/dataService';

type Props = NativeStackScreenProps<
  ResultsStackParamList & CalendarStackParamList,
  'TournamentDetail'
>;

export default function TournamentDetailScreen({ route, navigation }: Props) {
  const { tournamentId } = route.params;
  const { t } = useTranslation();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchTournamentById(tournamentId);
        if (data) {
          setTournament(data);
        } else {
          setError('Tournament not found');
        }
      } catch (err: any) {
        setError(err.message || 'Error loading tournament');
      } finally {
        setLoading(false);
      }
    })();
  }, [tournamentId]);

  if (loading && !tournament) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('common.loading')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <LoadingIndicator message={t('common.loading')} />
      </SafeAreaView>
    );
  }

  if (error || !tournament) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={{ width: 24 }} />
        </View>
        <ErrorView message={error || 'Tournament not found'} onRetry={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const gameColor = gameColors[tournament.game] || Colors.primary;
  const isLive = tournament.status === 'live';
  const isFinished = tournament.status === 'finished';

  const formatPlacement = (p: number): string => {
    if (p === 1) return '1st';
    if (p === 2) return '2nd';
    if (p === 3) return '3rd';
    return `${p}th`;
  };

  const formatDateRange = () => {
    const start = new Date(tournament.startDate);
    const startStr = start.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (tournament.endDate && tournament.endDate !== tournament.startDate) {
      const end = new Date(tournament.endDate);
      const endStr = end.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return `${startStr} — ${endStr}`;
    }
    return startStr;
  };

  const openExternal = () => {
    if (tournament.externalUrl) {
      Linking.openURL(tournament.externalUrl);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('tournament.detail', { defaultValue: 'Torneo' })}
          </Text>
          <Text style={styles.headerSubtitle}>{t(`games.${tournament.game}`)}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Tournament Hero Section */}
        <View style={styles.heroSection}>
          {/* Tournament image */}
          {tournament.imageUrl ? (
            <Image source={{ uri: tournament.imageUrl }} style={styles.heroImage} />
          ) : null}
          <View style={[styles.heroOverlay, !tournament.imageUrl && { paddingTop: Spacing.xl }]}>
            {/* Status badge */}
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>EN VIVO</Text>
              </View>
            )}
            {isFinished && (
              <View style={styles.finishedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={Colors.textMuted} />
                <Text style={styles.finishedText}>{t('results.finished')}</Text>
              </View>
            )}

            {/* Game badge */}
            <View style={[styles.gameBadge, { backgroundColor: gameColor + '25', borderColor: gameColor + '50' }]}>
              <View style={[styles.gameDot, { backgroundColor: gameColor }]} />
              <Text style={[styles.gameText, { color: gameColor }]}>
                {t(`games.${tournament.game}`)}
              </Text>
            </View>

            {/* Tournament name */}
            <Text style={styles.tournamentName}>{tournament.name}</Text>

            {/* Date */}
            <Text style={styles.dateRange}>{formatDateRange()}</Text>

            {/* Info row */}
            <View style={styles.infoRow}>
              {!!tournament.location && (
                <View style={styles.infoPill}>
                  <Ionicons
                    name={tournament.location === 'Online' ? 'globe-outline' : 'location-outline'}
                    size={14}
                    color={Colors.textMuted}
                  />
                  <Text style={styles.infoText}>{tournament.location}</Text>
                </View>
              )}
              {!!tournament.totalParticipants && (
                <View style={styles.infoPill}>
                  <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.infoText}>{tournament.totalParticipants} {t('tournament.participants')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Format section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.textPrimary} />
            <Text style={styles.sectionTitle}>{t('tournament.formatLabel', { defaultValue: 'Formato' })}</Text>
          </View>
          <View style={styles.formatBadgeLg}>
            <Ionicons
              name={tournament.format === 'points_elimination' ? 'stats-chart' : 'git-branch-outline'}
              size={16}
              color={gameColor}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.formatTextLg, { color: gameColor }]}>
              {t(`tournament.format_${tournament.format}`)}
            </Text>
          </View>
          {tournament.format === 'points_elimination' && (
            <Text style={styles.formatDescription}>
              {t('tournament.tftFormatDesc', { defaultValue: 'Los jugadores compiten en lobbies de 8 personas. Cada partida asigna puntos según la posición final (1-8 pts). Los jugadores con menos puntos son eliminados progresivamente hasta la final.'})}
            </Text>
          )}
          {tournament.format === 'swiss_to_bracket' && (
            <Text style={styles.formatDescription}>
              {t('tournament.pokemonFormatDesc', { defaultValue: 'El Día 1 se juega con formato suizo: los jugadores se emparejan por récord de victorias/derrotas. Los mejores clasificados (Top 16/32) avanzan al Día 2, donde se juega eliminación directa hasta coronar al campeón.' })}
            </Text>
          )}
        </View>

        {/* Phases section */}
        {tournament.phases && tournament.phases.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="layers-outline" size={18} color={Colors.textPrimary} />
              <Text style={styles.sectionTitle}>{t('tournament.schedule', { defaultValue: 'Programa' })}</Text>
            </View>
            {tournament.phases.map((phase, index) => (
              <View key={index} style={styles.phaseItem}>
                <View style={[
                  styles.phaseStatusDot,
                  phase.status === 'live' && { backgroundColor: Colors.live },
                  phase.status === 'finished' && { backgroundColor: Colors.win },
                  phase.status === 'upcoming' && { backgroundColor: Colors.textMuted },
                ]} />
                <View style={styles.phaseContent}>
                  <Text style={[
                    styles.phaseName,
                    phase.status === 'live' && { color: Colors.live },
                  ]}>
                    {phase.name}
                  </Text>
                  {!!phase.description && (
                    <Text style={styles.phaseDesc}>{phase.description}</Text>
                  )}
                  {!!phase.qualifyingCount && (
                    <Text style={styles.phaseQualify}>
                      {t('tournament.qualifyCount', { count: phase.qualifyingCount, defaultValue: `${phase.qualifyingCount} jugadores clasifican` })}
                    </Text>
                  )}
                </View>
                {phase.status === 'live' && (
                  <View style={styles.phaseStatusBadge}>
                    <Text style={styles.phaseStatusText}>LIVE</Text>
                  </View>
                )}
                {phase.status === 'finished' && (
                  <Ionicons name="checkmark-circle" size={16} color={Colors.win} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* KOI Players section */}
        {tournament.koiParticipants.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="people" size={18} color={Colors.textPrimary} />
              <Text style={styles.sectionTitle}>
                {t('tournament.koiPlayers', { defaultValue: 'Jugadores KOI' })}
              </Text>
            </View>
            {tournament.koiParticipants.map((participant) => (
              <View key={participant.playerId} style={styles.playerCard}>
                {/* Avatar */}
                {participant.photoUrl ? (
                  <Image source={{ uri: participant.photoUrl }} style={styles.playerAvatar} />
                ) : (
                  <View style={[styles.playerAvatarPlaceholder, { borderColor: gameColor + '60' }]}>
                    <Text style={styles.playerInitial}>
                      {participant.playerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* Info */}
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{participant.playerName}</Text>
                  {!!participant.currentPhaseName && (
                    <Text style={styles.playerPhase}>{participant.currentPhaseName}</Text>
                  )}
                </View>

                {/* Result / Status */}
                <View style={styles.playerResult}>
                  {isFinished && participant.placement !== undefined && (
                    <View style={[
                      styles.placementBadge,
                      participant.placement === 1 && styles.goldBadge,
                      participant.placement === 2 && styles.silverBadge,
                      participant.placement === 3 && styles.bronzeBadge,
                    ]}>
                      <Ionicons
                        name={participant.placement === 1 ? 'trophy' : 'medal-outline'}
                        size={14}
                        color={
                          participant.placement === 1 ? '#FFD700' :
                          participant.placement === 2 ? '#C0C0C0' :
                          participant.placement === 3 ? '#CD7F32' :
                          Colors.textSecondary
                        }
                      />
                      <Text style={[
                        styles.placementText,
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
                        {participant.wins}W — {participant.losses ?? 0}L
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* External link */}
        {!!tournament.externalUrl && (
          <TouchableOpacity style={styles.externalLink} onPress={openExternal}>
            <Ionicons name="open-outline" size={18} color={Colors.primary} />
            <Text style={styles.externalLinkText}>
              {t('tournament.viewOnStartGG', { defaultValue: 'Ver en start.gg' })}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    justifyContent: 'space-between',
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitles: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },

  // Hero
  heroSection: {
    backgroundColor: Colors.surfaceLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 140,
    opacity: 0.3,
  },
  heroOverlay: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.live + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.live,
    alignSelf: 'flex-start',
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
  finishedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    alignSelf: 'flex-start',
  },
  finishedText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  gameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  gameDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  gameText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  tournamentName: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
    lineHeight: 28,
  },
  dateRange: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },

  // Section card
  sectionCard: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },

  // Format
  formatBadgeLg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  formatTextLg: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  formatDescription: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  // Phases
  phaseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  phaseStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: Spacing.sm,
  },
  phaseContent: {
    flex: 1,
  },
  phaseName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  phaseDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
    lineHeight: 18,
  },
  phaseQualify: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 4,
  },
  phaseStatusBadge: {
    backgroundColor: Colors.live + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.live,
  },
  phaseStatusText: {
    color: Colors.live,
    fontSize: FontSize.xs - 2,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Players
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    marginRight: Spacing.md,
  },
  playerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    marginRight: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  playerInitial: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  playerPhase: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  playerResult: {
    alignItems: 'flex-end',
  },
  placementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.border,
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
  placementText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  eliminatedText: {
    color: Colors.loss,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  pointsBadge: {
    backgroundColor: Colors.tft + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  pointsText: {
    color: Colors.tft,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  recordBadge: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  recordText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },

  // External link
  externalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  externalLinkText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
