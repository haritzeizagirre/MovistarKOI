import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../theme';
import { Match, Game } from '../types';
import { gameColors } from '../data/mockData';
import { useTranslation } from 'react-i18next';

export type MatchBadge = 'fire' | 'ice' | 'trophy';

interface MatchCardProps {
  match: Match;
  onPress?: () => void;
  compact?: boolean;
  badges?: MatchBadge[];
}

export default function MatchCard({ match, onPress, compact = false, badges = [] }: MatchCardProps) {
  const { t } = useTranslation();
  const gameColor = gameColors[match.game];

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const isUpcoming = match.status === 'upcoming';

  // KOI is ALWAYS homeTeam in our data mapping, but also handle mock data
  const koiIsHome =
    match.homeTeam.tag.toUpperCase().includes('KOI') ||
    match.homeTeam.name.toLowerCase().includes('koi');

  const koiScore = koiIsHome ? match.homeTeam.score : match.awayTeam.score;
  const opponentScore = koiIsHome ? match.awayTeam.score : match.homeTeam.score;
  const koiWon = isFinished && koiScore !== undefined && opponentScore !== undefined && koiScore > opponentScore;
  const koiLost = isFinished && koiScore !== undefined && opponentScore !== undefined && koiScore < opponentScore;

  // Determine which score is higher for highlighting (works for both sides)
  const homeWins = match.homeTeam.score !== undefined && match.awayTeam.score !== undefined
    && match.homeTeam.score > match.awayTeam.score;
  const awayWins = match.homeTeam.score !== undefined && match.awayTeam.score !== undefined
    && match.awayTeam.score > match.homeTeam.score;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return t('calendar.today');
    if (isTomorrow) return 'Mañana';
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  // Card accent based on result
  const cardAccent = isLive
    ? Colors.live
    : koiWon
      ? Colors.win
      : koiLost
        ? Colors.loss
        : gameColor;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isLive && styles.liveCard,
        compact && styles.compactCard,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      {/* Left accent stripe */}
      <View style={[styles.accentStripe, { backgroundColor: cardAccent }]} />

      {/* Card content */}
      <View style={styles.cardContent}>
        {/* Header row: tournament + status */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.gameDot, { backgroundColor: gameColor }]} />
            <Text style={styles.tournament} numberOfLines={1}>
              {match.tournament}
            </Text>
          </View>

          {/* Badges */}
          {badges.length > 0 && (
            <View style={styles.badgesContainer}>
              {badges.map((badge, index) => (
                <View
                  key={`badge-${index}`}
                  style={[
                    styles.badgeIcon,
                    badge === 'fire' && styles.fireBadge,
                    badge === 'ice' && styles.iceBadge,
                    badge === 'trophy' && styles.trophyBadge,
                  ]}
                >
                  <Ionicons
                    name={badge === 'fire' ? 'flame' : badge === 'ice' ? 'snow' : 'trophy'}
                    size={10}
                    color={
                      badge === 'fire' ? Colors.fire :
                        badge === 'ice' ? Colors.ice :
                          '#FFC107' // Gold for trophy
                    }
                  />
                </View>
              ))}
            </View>
          )}

          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN VIVO</Text>
            </View>
          )}
          {isFinished && (
            <View style={[styles.resultBadge, koiWon ? styles.winBadge : styles.lossBadge]}>
              <Ionicons
                name={koiWon ? 'trophy' : 'close-circle'}
                size={12}
                color={koiWon ? Colors.win : Colors.loss}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.resultText, koiWon ? styles.winText : styles.lossText]}>
                {koiWon ? t('results.win') : t('results.loss')}
              </Text>
            </View>
          )}
          {isUpcoming && (
            <View style={styles.dateBadge}>
              <Ionicons name="time-outline" size={12} color={Colors.upcoming} style={{ marginRight: 3 }} />
              <Text style={styles.dateText}>
                {formatDate(match.date)} · {match.time}
              </Text>
            </View>
          )}
        </View>

        {/* Match type & standing */}
        {/* Match type */}
        {match.matchType && (
          <View style={styles.subtitleRow}>
            <View style={styles.matchTypeBadge}>
              <Ionicons name="flag-outline" size={10} color={Colors.textMuted} style={{ marginRight: 3 }} />
              <Text style={styles.matchTypeText}>{match.matchType}</Text>
            </View>
          </View>
        )}

        {/* Teams & Score */}
        <View style={styles.body}>
          {/* Home Team (KOI) */}
          <View style={styles.teamSide}>
            {match.homeTeam.logoUrl ? (
              <Image source={{ uri: match.homeTeam.logoUrl }} style={styles.teamLogo} />
            ) : (
              <View style={[styles.teamIcon, { borderColor: gameColor + '60' }]}>
                <Text style={styles.teamTagInner}>{match.homeTeam.tag}</Text>
              </View>
            )}
            <Text style={[styles.teamName, koiIsHome && styles.koiTeamName]} numberOfLines={1}>
              {compact ? match.homeTeam.tag : match.homeTeam.name}
            </Text>
            {match.standing && (
              <Text style={styles.teamStandingText}>{match.standing}</Text>
            )}
          </View>

          {/* Score / VS */}
          <View style={styles.scoreContainer}>
            {(isFinished || isLive) ? (
              <View style={styles.scoreRow}>
                <Text style={[
                  styles.score,
                  isFinished && homeWins && styles.winningScore,
                  isFinished && !homeWins && awayWins && styles.losingScore,
                ]}>
                  {match.homeTeam.score}
                </Text>
                <Text style={styles.scoreSeparator}>:</Text>
                <Text style={[
                  styles.score,
                  isFinished && awayWins && styles.winningScore,
                  isFinished && !awayWins && homeWins && styles.losingScore,
                ]}>
                  {match.awayTeam.score}
                </Text>
              </View>
            ) : (
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
              </View>
            )}
            {match.bestOf > 1 && (
              <Text style={styles.bestOf}>Bo{match.bestOf}</Text>
            )}
          </View>

          {/* Away Team (Opponent) */}
          <View style={[styles.teamSide, styles.teamRight]}>
            {match.awayTeam.logoUrl ? (
              <Image source={{ uri: match.awayTeam.logoUrl }} style={styles.teamLogo} />
            ) : (
              <View style={[styles.teamIcon, { borderColor: gameColor + '60' }]}>
                <Text style={styles.teamTagInner}>{match.awayTeam.tag}</Text>
              </View>
            )}
            <Text style={styles.teamName} numberOfLines={1}>
              {compact ? match.awayTeam.tag : match.awayTeam.name}
            </Text>
            {match.opponentStanding && (
              <Text style={styles.teamStandingText}>{match.opponentStanding}</Text>
            )}
          </View>
        </View>

        {/* Stream link for live */}
        {isLive && match.streamUrl && (
          <View style={styles.streamRow}>
            <Ionicons name="play-circle" size={14} color={Colors.live} />
            <Text style={styles.streamText}>Ver en directo</Text>
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
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  compactCard: {
    marginHorizontal: 0,
  },
  liveCard: {
    backgroundColor: Colors.surface,
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
    marginBottom: Spacing.sm + 2,
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
  tournament: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    flex: 1,
    letterSpacing: 0.3,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 8,
  },
  badgeIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  fireBadge: {
    backgroundColor: Colors.fire + '20', // 20% opacity
    borderColor: Colors.fire,
  },
  iceBadge: {
    backgroundColor: Colors.ice + '20',
    borderColor: Colors.ice,
  },
  trophyBadge: {
    backgroundColor: '#FFC107' + '20',
    borderColor: '#FFC107',
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
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  winBadge: {
    backgroundColor: Colors.win + '18',
    borderWidth: 1,
    borderColor: Colors.win + '30',
  },
  lossBadge: {
    backgroundColor: Colors.loss + '18',
    borderWidth: 1,
    borderColor: Colors.loss + '30',
  },
  resultText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  winText: {
    color: Colors.win,
  },
  lossText: {
    color: Colors.loss,
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
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamSide: {
    flex: 1,
    alignItems: 'center',
  },
  teamRight: {
    alignItems: 'center',
  },
  teamLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceLight,
    marginBottom: 6,
  },
  teamIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 6,
  },
  teamTagInner: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  teamName: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    textAlign: 'center',
    maxWidth: 100,
  },
  koiTeamName: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  scoreContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    minWidth: 90,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  score: {
    color: Colors.textPrimary,
    fontSize: FontSize.hero,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },
  winningScore: {
    color: Colors.win,
  },
  losingScore: {
    color: Colors.textMuted,
    opacity: 0.7,
  },
  scoreSeparator: {
    color: Colors.textMuted,
    fontSize: FontSize.xxl,
    marginHorizontal: 6,
    fontWeight: '300',
  },
  vsContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bestOf: {
    color: Colors.textMuted,
    fontSize: FontSize.xs - 1,
    marginTop: 3,
    letterSpacing: 0.5,
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
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  matchTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
  },
  matchTypeText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs - 1,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  teamStandingText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs - 2,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.8,
  },
});
