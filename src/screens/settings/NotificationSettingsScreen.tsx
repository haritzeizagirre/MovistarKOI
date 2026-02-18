import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { gameColors } from '../../data/mockData';
import { Game, NotificationPreference } from '../../types';
import { fetchAllTeams, fetchUpcomingMatches } from '../../services/dataService';
import {
  hasNotificationPermission,
  scheduleMatchReminders,
  initializeNotifications,
} from '../../services/notificationService';

const NOTIF_KEY = '@movistar_koi_notifications';

type TeamNotif = {
  teamId: string;
  teamName: string;
  game: Game;
  enabled: boolean;
  matchReminders: boolean;
  liveAlerts: boolean;
  resultAlerts: boolean;
};

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const [teamNotifs, setTeamNotifs] = useState<TeamNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(true);

  useEffect(() => {
    loadPreferences();
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const granted = await hasNotificationPermission();
    setPermissionGranted(granted);
  };

  const requestPermission = async () => {
    const granted = await initializeNotifications();
    setPermissionGranted(granted);
    if (!granted) {
      // Open system settings so user can enable manually
      if (Platform.OS === 'ios') {
        Linking.openURL('app-settings:');
      } else {
        Linking.openSettings();
      }
    }
  };

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const apiTeams = await fetchAllTeams();
      const stored = await AsyncStorage.getItem(NOTIF_KEY);
      if (stored) {
        const savedNotifs: TeamNotif[] = JSON.parse(stored);
        // Merge: keep saved preferences for teams that still exist, add new teams
        const merged = apiTeams.map((team) => {
          const existing = savedNotifs.find((n) => n.teamId === team.id);
          if (existing) return { ...existing, teamName: team.name, game: team.game };
          return {
            teamId: team.id,
            teamName: team.name,
            game: team.game,
            enabled: true,
            matchReminders: true,
            liveAlerts: true,
            resultAlerts: true,
          };
        });
        setTeamNotifs(merged);
        await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(merged));
      } else {
        const defaults = apiTeams.map((team) => ({
          teamId: team.id,
          teamName: team.name,
          game: team.game,
          enabled: true,
          matchReminders: true,
          liveAlerts: true,
          resultAlerts: true,
        }));
        setTeamNotifs(defaults);
        await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(defaults));
      }
    } catch {
      // If API fails, just show whatever was stored
      const stored = await AsyncStorage.getItem(NOTIF_KEY).catch(() => null);
      if (stored) setTeamNotifs(JSON.parse(stored));
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (updated: TeamNotif[]) => {
    setTeamNotifs(updated);
    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
    // Re-schedule notifications with the new preferences
    try {
      const matches = await fetchUpcomingMatches();
      await scheduleMatchReminders(matches);
    } catch (err) {
      console.warn('Failed to re-schedule after preference change:', err);
    }
  };

  const toggleTeam = (teamId: string) => {
    const updated = teamNotifs.map((tn) =>
      tn.teamId === teamId
        ? {
          ...tn,
          enabled: !tn.enabled,
          matchReminders: !tn.enabled,
          liveAlerts: !tn.enabled,
          resultAlerts: !tn.enabled,
        }
        : tn
    );
    savePreferences(updated);
  };

  const toggleSub = (teamId: string, key: 'matchReminders' | 'liveAlerts' | 'resultAlerts') => {
    const updated = teamNotifs.map((tn) =>
      tn.teamId === teamId ? { ...tn, [key]: !tn[key] } : tn
    );
    savePreferences(updated);
  };

  const enableAll = () => {
    const updated = teamNotifs.map((tn) => ({
      ...tn,
      enabled: true,
      matchReminders: true,
      liveAlerts: true,
      resultAlerts: true,
    }));
    savePreferences(updated);
  };

  const disableAll = () => {
    const updated = teamNotifs.map((tn) => ({
      ...tn,
      enabled: false,
      matchReminders: false,
      liveAlerts: false,
      resultAlerts: false,
    }));
    savePreferences(updated);
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : teamNotifs.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
          <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
          <Text style={{ color: Colors.textSecondary, marginTop: Spacing.md, textAlign: 'center' }}>
            {t('common.noData')}
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Permission banner */}
          {!permissionGranted && (
            <TouchableOpacity style={styles.permissionBanner} onPress={requestPermission}>
              <Ionicons name="warning-outline" size={20} color="#FFC107" />
              <Text style={styles.permissionText}>
                {t('settings.notificationsDisabledDevice', 'Las notificaciones están desactivadas. Toca aquí para activarlas.')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Bulk Actions */}
          <View style={styles.bulkRow}>
            <TouchableOpacity style={styles.bulkButton} onPress={enableAll}>
              <Text style={styles.bulkButtonText}>{t('settings.enableAll')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkButton, styles.bulkButtonSecondary]}
              onPress={disableAll}
            >
              <Text style={[styles.bulkButtonText, styles.bulkButtonTextSecondary]}>
                {t('settings.disableAll')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Per-team notification settings */}
          {teamNotifs.map((tn) => {
            const gameColor = gameColors[tn.game];
            return (
              <View key={tn.teamId} style={styles.teamCard}>
                {/* Team header toggle */}
                <View style={styles.teamHeader}>
                  <View style={[styles.gameDot, { backgroundColor: gameColor }]} />
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{tn.teamName}</Text>
                    <Text style={[styles.gameName, { color: gameColor }]}>
                      {t(`games.${tn.game}`)}
                    </Text>
                  </View>
                  <Switch
                    value={tn.enabled}
                    onValueChange={() => toggleTeam(tn.teamId)}
                    trackColor={{ false: Colors.surfaceLight, true: Colors.primary + '60' }}
                    thumbColor={tn.enabled ? Colors.primary : Colors.textMuted}
                  />
                </View>

                {/* Sub-toggles */}
                {tn.enabled && (
                  <View style={styles.subToggles}>
                    <View style={styles.subRow}>
                      <View style={styles.subRowLeft}>
                        <Ionicons name="alarm-outline" size={18} color={Colors.textSecondary} />
                        <Text style={styles.subLabel}>{t('settings.matchReminders')}</Text>
                      </View>
                      <Switch
                        value={tn.matchReminders}
                        onValueChange={() => toggleSub(tn.teamId, 'matchReminders')}
                        trackColor={{ false: Colors.surfaceLight, true: Colors.primary + '60' }}
                        thumbColor={tn.matchReminders ? Colors.primary : Colors.textMuted}
                      />
                    </View>
                    <View style={styles.subRow}>
                      <View style={styles.subRowLeft}>
                        <Ionicons name="radio-outline" size={18} color={Colors.live} />
                        <Text style={styles.subLabel}>{t('settings.liveAlerts')}</Text>
                      </View>
                      <Switch
                        value={tn.liveAlerts}
                        onValueChange={() => toggleSub(tn.teamId, 'liveAlerts')}
                        trackColor={{ false: Colors.surfaceLight, true: Colors.live + '60' }}
                        thumbColor={tn.liveAlerts ? Colors.live : Colors.textMuted}
                      />
                    </View>
                    <View style={styles.subRow}>
                      <View style={styles.subRowLeft}>
                        <Ionicons name="trophy-outline" size={18} color={Colors.win} />
                        <Text style={styles.subLabel}>{t('settings.resultAlerts')}</Text>
                      </View>
                      <Switch
                        value={tn.resultAlerts}
                        onValueChange={() => toggleSub(tn.teamId, 'resultAlerts')}
                        trackColor={{ false: Colors.surfaceLight, true: Colors.win + '60' }}
                        thumbColor={tn.resultAlerts ? Colors.win : Colors.textMuted}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFC10720',
    borderWidth: 1,
    borderColor: '#FFC10740',
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  permissionText: {
    flex: 1,
    color: '#FFC107',
    fontSize: FontSize.sm,
  },
  bulkRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  bulkButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  bulkButtonSecondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bulkButtonText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  bulkButtonTextSecondary: {
    color: Colors.textSecondary,
  },
  teamCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  gameDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  gameName: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  subToggles: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  subRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  subLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
});
