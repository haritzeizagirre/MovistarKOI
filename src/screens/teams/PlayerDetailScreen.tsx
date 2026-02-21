import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { TeamsStackParamList } from '../../types';
import { gameColors } from '../../data/mockData';
import { useTeam } from '../../hooks/usePandaScore';
import { fetchPlayerById } from '../../services/dataService';
import { LoadingIndicator, ErrorView } from '../../components/StatusViews';
import { Player } from '../../types';

type RouteType = RouteProp<TeamsStackParamList, 'PlayerDetail'>;

const FLAG_EMOJIS: Record<string, string> = {
  ES: '🇪🇸', SE: '🇸🇪', PL: '🇵🇱', GR: '🇬🇷', RU: '🇷🇺',
  UA: '🇺🇦', TR: '🇹🇷', DE: '🇩🇪', FR: '🇫🇷', KR: '🇰🇷',
  DK: '🇩🇰', BE: '🇧🇪', PT: '🇵🇹', IT: '🇮🇹', NL: '🇳🇱',
  US: '🇺🇸', GB: '🇬🇧', AR: '🇦🇷', CL: '🇨🇱', MX: '🇲🇽',
  BR: '🇧🇷', CN: '🇨🇳', JP: '🇯🇵', CZ: '🇨🇿', RO: '🇷🇴',
  FI: '🇫🇮', NO: '🇳🇴', HU: '🇭🇺', SK: '🇸🇰', BG: '🇧🇬',
};

export default function PlayerDetailScreen() {
  const route = useRoute<RouteType>();
  const { t } = useTranslation();
  const { playerId, teamId } = route.params;

  const { data: team, loading: teamLoading } = useTeam(teamId);
  const [player, setPlayer] = React.useState<Player | undefined>(undefined);
  const [playerLoading, setPlayerLoading] = React.useState(true);

  React.useEffect(() => {
    setPlayerLoading(true);
    fetchPlayerById(playerId, teamId)
      .then(setPlayer)
      .finally(() => setPlayerLoading(false));
  }, [playerId, teamId]);

  if (teamLoading || playerLoading) {
    return <LoadingIndicator message={t('common.loading')} />;
  }

  if (!player || !team) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{t('common.error')}</Text>
      </SafeAreaView>
    );
  }

  const gameColor = gameColors[team.game];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Player Header */}
        <View style={[styles.header, { backgroundColor: gameColor + '15' }]}>
          <View style={[styles.avatar, { borderColor: gameColor }]}>
            <Ionicons name="person" size={48} color={gameColor} />
          </View>
          <Text style={styles.nickname}>{player.nickname}</Text>
          <Text style={styles.realName}>
            {player.firstName} {player.lastName}
          </Text>
          <Text style={styles.teamLabel}>{team.name}</Text>
        </View>

        {/* Player Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('teams.role')}</Text>
              <View style={[styles.roleBadge, { backgroundColor: gameColor + '20' }]}>
                <Text style={[styles.roleText, { color: gameColor }]}>
                  {player.role}
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('teams.nationality')}</Text>
              <Text style={styles.infoValue}>
                {FLAG_EMOJIS[player.nationality] || '🏳️'} {player.nationality}
              </Text>
            </View>
            {!!player.age && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('teams.age')}</Text>
                <Text style={styles.infoValue}>{player.age}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Social Links */}
        {player.socialLinks && (
          <View style={styles.socialSection}>
            <Text style={styles.sectionTitle}>{t('teams.socialLinks')}</Text>
            <View style={styles.socialRow}>
              {!!player.socialLinks.twitter && (
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => Linking.openURL(player.socialLinks!.twitter!)}
                >
                  <Ionicons name="logo-twitter" size={22} color={Colors.primary} />
                  <Text style={styles.socialLabel}>Twitter</Text>
                </TouchableOpacity>
              )}
              {!!player.socialLinks.twitch && (
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => Linking.openURL(player.socialLinks!.twitch!)}
                >
                  <Ionicons name="logo-twitch" size={22} color="#9146FF" />
                  <Text style={styles.socialLabel}>Twitch</Text>
                </TouchableOpacity>
              )}
            </View>
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
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    marginBottom: Spacing.md,
  },
  nickname: {
    color: Colors.textPrimary,
    fontSize: FontSize.title,
    fontWeight: '800',
  },
  realName: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    marginTop: 4,
  },
  teamLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
  infoSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  infoValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  roleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  roleText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  socialSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  socialLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
});
