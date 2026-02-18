import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { TeamsStackParamList } from '../../types';
import { gameColors } from '../../data/mockData';
import { useTeam, useTeamMatches } from '../../hooks/usePandaScore';
import { PlayerCard, MatchCard } from '../../components';
import { LoadingIndicator, ErrorView } from '../../components/StatusViews';

type RouteType = RouteProp<TeamsStackParamList, 'TeamDetail'>;
type NavigationProp = NativeStackNavigationProp<TeamsStackParamList, 'TeamDetail'>;

export default function TeamDetailScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { teamId } = route.params;

  const { data: team, loading: teamLoading, error: teamError, refresh } = useTeam(teamId);
  const { upcoming: upcomingMatches, live: liveMatches, past: recentResults } = useTeamMatches(teamId);

  if (teamLoading) {
    return <LoadingIndicator message={t('common.loading')} />;
  }

  if (teamError || !team) {
    return <ErrorView message={teamError || t('common.error')} onRetry={refresh} />;
  }

  const gameColor = gameColors[team.game];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[styles.banner, { backgroundColor: gameColor + '30' }]}>
          <View style={[styles.logoCircle, { borderColor: gameColor }]}>
            <Text style={[styles.logoText, { color: gameColor }]}>KOI</Text>
          </View>
          <Text style={styles.teamName}>{team.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: gameColor + '20' }]}>
              <Text style={[styles.badgeText, { color: gameColor }]}>
                {t(`games.${team.game}`)}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: Colors.surfaceLight }]}>
              <Text style={[styles.badgeText, { color: Colors.textSecondary }]}>
                {team.division}
              </Text>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.description}>{team.description}</Text>
        </View>

        {/* Social Links */}
        {team.socialLinks && (
          <View style={styles.socialRow}>
            {team.socialLinks.twitter && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL(team.socialLinks!.twitter!)}
              >
                <Ionicons name="logo-twitter" size={20} color={Colors.primary} />
              </TouchableOpacity>
            )}
            {team.socialLinks.instagram && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL(team.socialLinks!.instagram!)}
              >
                <Ionicons name="logo-instagram" size={20} color={Colors.accent} />
              </TouchableOpacity>
            )}
            {team.socialLinks.youtube && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL(team.socialLinks!.youtube!)}
              >
                <Ionicons name="logo-youtube" size={20} color="#FF0000" />
              </TouchableOpacity>
            )}
            {team.socialLinks.twitch && (
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL(team.socialLinks!.twitch!)}
              >
                <Ionicons name="logo-twitch" size={20} color="#9146FF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Live Matches */}
        {liveMatches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              🔴 {t('results.liveNow')}
            </Text>
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} compact />
            ))}
          </View>
        )}

        {/* Roster */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('teams.roster')} ({team.members.length})
          </Text>
          {team.members.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              gameColor={gameColor}
              onPress={() =>
                navigation.navigate('PlayerDetail', {
                  playerId: player.id,
                  teamId: team.id,
                })
              }
            />
          ))}
        </View>

        {/* Coach */}
        {team.coach && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('teams.coach')}</Text>
            <PlayerCard
              player={{
                ...team.coach,
                age: undefined,
                socialLinks: undefined,
              }}
              gameColor={gameColor}
            />
          </View>
        )}

        {/* Upcoming Matches */}
        {upcomingMatches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('teams.upcomingMatches')}</Text>
            {upcomingMatches.map((match) => (
              <MatchCard key={match.id} match={match} compact />
            ))}
          </View>
        )}

        {/* Recent Results */}
        {recentResults.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('teams.recentResults')}</Text>
            {recentResults.map((match) => (
              <MatchCard key={match.id} match={match} compact />
            ))}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.xxl,
  },
  banner: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    marginBottom: Spacing.md,
  },
  logoText: {
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  teamName: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  badgeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
