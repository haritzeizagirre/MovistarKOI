import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize } from '../../theme';
import { TeamsStackParamList, Game } from '../../types';
import { useTeams } from '../../hooks/usePandaScore';
import { TeamCard, GameFilter } from '../../components';
import { LoadingIndicator, ErrorView } from '../../components/StatusViews';

type NavigationProp = NativeStackNavigationProp<TeamsStackParamList, 'TeamsList'>;

export default function TeamsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const { teams: filteredTeams, loading, error, refresh } = useTeams(
    selectedGame || 'all'
  );

  if (loading && filteredTeams.length === 0) {
    return <LoadingIndicator message={t('common.loading')} />;
  }

  if (error && filteredTeams.length === 0) {
    return <ErrorView message={error} onRetry={refresh} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>{t('teams.title')}</Text>
        <Text style={styles.subtitle}>Movistar KOI Esports</Text>
      </View>

      <GameFilter selectedGame={selectedGame} onSelect={setSelectedGame} />

      <FlatList
        data={filteredTeams}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TeamCard
            team={item}
            onPress={() =>
              navigation.navigate('TeamDetail', { teamId: item.id })
            }
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('teams.noTeams')}</Text>
          </View>
        }
      />
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
    paddingBottom: Spacing.sm,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.title,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '500',
    marginTop: 2,
  },
  list: {
    paddingBottom: Spacing.xxl,
  },
  emptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
});
