import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  SectionList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { Game, Match } from '../../types';
import { useCalendarData } from '../../hooks/usePandaScore';
import { MatchCard, GameFilter } from '../../components';
import { LoadingIndicator, ErrorView } from '../../components/StatusViews';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { liveMatches, upcomingMatches, loading, error, refresh } = useCalendarData(
    selectedGame || 'all'
  );

  const filteredMatches = [...liveMatches, ...upcomingMatches];

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (loading && filteredMatches.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('calendar.title')}</Text>
          <Text style={styles.subtitle}>Movistar KOI</Text>
        </View>
        <LoadingIndicator message={t('common.loading')} />
      </SafeAreaView>
    );
  }

  if (error && filteredMatches.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('calendar.title')}</Text>
          <Text style={styles.subtitle}>Movistar KOI</Text>
        </View>
        <ErrorView message={error} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  // Group by date
  const grouped = filteredMatches.reduce<Record<string, Match[]>>((acc, match) => {
    const dateKey = match.date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(match);
    return acc;
  }, {});

  const sections = Object.entries(grouped)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([date, data]) => ({
      title: formatSectionDate(date),
      raw: date,
      data,
    }));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>{t('calendar.title')}</Text>
        <Text style={styles.subtitle}>Movistar KOI</Text>
      </View>

      <GameFilter selectedGame={selectedGame} onSelect={setSelectedGame} />

      {/* Live count banner */}
      {liveMatches.length > 0 && (
        <View style={styles.liveBanner}>
          <View style={styles.livePulse} />
          <Text style={styles.liveBannerText}>
            {liveMatches.length} {liveMatches.length === 1 ? 'partido en directo' : 'partidos en directo'}
          </Text>
        </View>
      )}

      {filteredMatches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('calendar.noMatches')}</Text>
          <Text style={styles.emptySubtitle}>No hay partidos programados</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MatchCard match={item} />}
          renderSectionHeader={({ section }) => {
            const isToday = new Date(section.raw).toDateString() === new Date().toDateString();
            return (
              <View style={styles.sectionHeader}>
                <Ionicons
                  name={isToday ? 'today' : 'calendar-outline'}
                  size={16}
                  color={isToday ? Colors.primary : Colors.textMuted}
                  style={{ marginRight: 8 }}
                />
                <Text style={[
                  styles.sectionTitle,
                  isToday && styles.sectionTitleToday,
                ]}>
                  {section.title}
                </Text>
                <Text style={styles.sectionCount}>{section.data.length}</Text>
              </View>
            );
          }}
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

function formatSectionDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return 'Hoy';
  if (isTomorrow) return 'Mañana';

  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
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
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.live + '15',
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.live + '25',
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.live,
    marginRight: 8,
  },
  liveBannerText: {
    color: Colors.live,
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.3,
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
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '700',
    flex: 1,
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  sectionTitleToday: {
    color: Colors.primary,
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
