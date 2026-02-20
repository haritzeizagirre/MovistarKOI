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
import { Game, CalendarItem, isTournament, isMatch } from '../../types';
import { useResultsData } from '../../hooks/usePandaScore';
import { MatchCard, GameFilter, TournamentCard } from '../../components';
import { calculateMatchMilestones } from '../../utils/streakHelpers';
import { LoadingIndicator, ErrorView } from '../../components/StatusViews';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ResultsStackParamList } from '../../types';

type ResultsNavigationProp = NativeStackNavigationProp<ResultsStackParamList, 'ResultsMain'>;

export default function ResultsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<ResultsNavigationProp>();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const {
    liveMatches,
    pastMatches,
    liveTournaments,
    pastTournaments,
    allItems,
    loading,
    error,
    refresh,
  } = useResultsData(selectedGame || 'all');

  // Calculate milestones for matches only
  const milestones = React.useMemo(() => {
    return calculateMatchMilestones(pastMatches);
  }, [pastMatches]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const totalItems = allItems.length;

  if (loading && totalItems === 0) {
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

  if (error && totalItems === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('results.title')}</Text>
          <Text style={styles.subtitle}>Movistar KOI</Text>
        </View>
        <ErrorView message={error} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  // Build sections: live items first, then finished
  const liveItems: CalendarItem[] = [...liveMatches, ...liveTournaments];
  const finishedItems: CalendarItem[] = [...pastMatches, ...pastTournaments];

  const sections: { title: string; data: CalendarItem[]; key: string }[] = [];
  if (liveItems.length > 0) {
    sections.push({ title: t('results.liveNow'), data: liveItems, key: 'live' });
  }
  if (finishedItems.length > 0) {
    sections.push({ title: t('results.finished'), data: finishedItems, key: 'finished' });
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>{t('results.title')}</Text>
        <Text style={styles.subtitle}>Movistar KOI</Text>
      </View>

      <GameFilter selectedGame={selectedGame} onSelect={setSelectedGame} />

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
          renderItem={({ item }) => {
            if (isTournament(item)) {
              return (
                <TournamentCard
                  tournament={item}
                  onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item.id })}
                />
              );
            }
            return (
              <MatchCard
                match={item}
                badges={milestones[item.id]}
                onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
              />
            );
          }}
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
