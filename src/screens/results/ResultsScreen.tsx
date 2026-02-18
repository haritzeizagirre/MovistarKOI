import React, { useState } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { Game, Match } from '../../types';
import { useResultsData } from '../../hooks/usePandaScore';
import { MatchCard, GameFilter } from '../../components';
import { LoadingIndicator, ErrorView } from '../../components/StatusViews';

export default function ResultsScreen() {
  const { t } = useTranslation();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { liveMatches, pastMatches, loading, error, refresh } = useResultsData(
    selectedGame || 'all'
  );

  const filteredLive = liveMatches;
  const filteredFinished = pastMatches;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (loading && filteredLive.length === 0 && filteredFinished.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('results.title')}</Text>
          <Text style={styles.subtitle}>Movistar KOI</Text>
        </View>
        <LoadingIndicator message={t('common.loading')} />
      </SafeAreaView>
    );
  }

  // Calculate W/L stats
  const wins = filteredFinished.filter((m) => {
    const koiIsHome =
      m.homeTeam.tag.toUpperCase().includes('KOI') ||
      m.homeTeam.name.toLowerCase().includes('koi');
    const koiScore = koiIsHome ? m.homeTeam.score : m.awayTeam.score;
    const oppScore = koiIsHome ? m.awayTeam.score : m.homeTeam.score;
    return koiScore !== undefined && oppScore !== undefined && koiScore > oppScore;
  }).length;
  const losses = filteredFinished.length - wins;

  const sections: { title: string; data: Match[]; key: string }[] = [];
  if (filteredLive.length > 0) {
    sections.push({ title: t('results.liveNow'), data: filteredLive, key: 'live' });
  }
  if (filteredFinished.length > 0) {
    sections.push({ title: t('results.finished'), data: filteredFinished, key: 'finished' });
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>{t('results.title')}</Text>
        <Text style={styles.subtitle}>Movistar KOI</Text>
      </View>

      <GameFilter selectedGame={selectedGame} onSelect={setSelectedGame} />

      {/* Stats bar */}
      {filteredFinished.length > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: Colors.win }]} />
            <Text style={styles.statValue}>{wins}</Text>
            <Text style={styles.statLabel}>{t('results.win')}s</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statDot, { backgroundColor: Colors.loss }]} />
            <Text style={styles.statValue}>{losses}</Text>
            <Text style={styles.statLabel}>{t('results.loss')}s</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.primary }]}>
              {filteredFinished.length > 0
                ? Math.round((wins / filteredFinished.length) * 100)
                : 0}%
            </Text>
            <Text style={styles.statLabel}>Winrate</Text>
          </View>
        </View>
      )}

      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('results.noResults')}</Text>
          <Text style={styles.emptySubtitle}>Los resultados aparecerán aquí</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MatchCard match={item} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              {section.key === 'live' && (
                <View style={styles.sectionLiveDot} />
              )}
              <Text style={[
                styles.sectionTitle,
                section.key === 'live' && styles.sectionTitleLive,
              ]}>
                {section.key === 'live' ? `● ${section.title}` : section.title}
              </Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
              progressBackgroundColor={Colors.surface}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.title,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginLeft: 2,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },
  list: {
    paddingBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.live,
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.3,
  },
  sectionTitleLive: {
    color: Colors.live,
  },
  sectionCount: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});
