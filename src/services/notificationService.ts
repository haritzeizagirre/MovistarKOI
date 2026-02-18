/**
 * Notification Service
 *
 * Handles local push notifications for match reminders using expo-notifications.
 *
 * Capabilities:
 *  - Request notification permissions
 *  - Configure Android notification channel
 *  - Schedule match reminders (15 min before start)
 *  - Cancel / re-schedule when preferences change
 *
 * Live alerts and result alerts require a push backend (future work).
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, Game } from '../types';

// ─── Constants ─────────────────────────────────────────────

const NOTIF_PREFS_KEY = '@movistar_koi_notifications';
const REMINDER_MINUTES = 15; // how many minutes before the match

/** Human-readable game names for notification text */
const GAME_LABELS: Record<Game, string> = {
    league_of_legends: 'League of Legends',
    valorant: 'Valorant',
    call_of_duty: 'Call of Duty',
    tft: 'TFT',
    pokemon_vgc: 'Pokémon VGC',
};

// ─── Types ─────────────────────────────────────────────────

interface TeamNotifPreference {
    teamId: string;
    teamName: string;
    game: Game;
    enabled: boolean;
    matchReminders: boolean;
    liveAlerts: boolean;
    resultAlerts: boolean;
}

// ─── Initialisation ────────────────────────────────────────

/**
 * Call once at app startup.
 * - Configures the foreground notification handler
 * - Creates the Android notification channel
 * - Requests permissions on real devices (skipped in Expo Go to
 *   avoid the "push token not available" warning)
 *
 * Returns `true` if notifications are permitted.
 */
export async function initializeNotifications(): Promise<boolean> {
    // Configure how notifications are presented when the app is in the foreground
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });

    // Create Android channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('match-reminders', {
            name: 'Match Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
        });
    }

    // In Expo Go, skip permission requests to avoid the push-token warning.
    // Local notifications still work without explicit permission in Expo Go.
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
        console.log('Notifications: running in Expo Go — using local notifications only');
        return true;
    }

    // Request permissions (only works on physical devices)
    if (!Device.isDevice) {
        console.log('Notifications: running on simulator — permissions skipped');
        return true;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

/**
 * Check whether notification permissions have been granted.
 */
export async function hasNotificationPermission(): Promise<boolean> {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
}

// ─── Preference Helpers ────────────────────────────────────

/**
 * Read saved notification preferences from AsyncStorage.
 */
export async function getNotificationPreferences(): Promise<TeamNotifPreference[]> {
    try {
        const raw = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
        if (raw) return JSON.parse(raw) as TeamNotifPreference[];
    } catch {
        console.warn('Failed to read notification preferences');
    }
    return [];
}

// ─── Match Reminder Scheduling ─────────────────────────────

/**
 * Cancel all previously scheduled notifications and re-schedule
 * reminders for upcoming matches based on the user's preferences.
 *
 * Call this:
 *  - After match data is refreshed
 *  - After notification preferences are toggled
 */
export async function scheduleMatchReminders(matches: Match[]): Promise<number> {
    // Cancel everything first so we always have a clean slate
    await Notifications.cancelAllScheduledNotificationsAsync();

    const prefs = await getNotificationPreferences();
    if (prefs.length === 0) return 0;

    // Build a set of team IDs that have match reminders enabled
    const enabledTeamIds = new Set(
        prefs
            .filter((p) => p.enabled && p.matchReminders)
            .map((p) => p.teamId)
    );

    if (enabledTeamIds.size === 0) return 0;

    const now = Date.now();
    let scheduledCount = 0;

    for (const match of matches) {
        if (match.status !== 'upcoming') continue;
        if (!enabledTeamIds.has(match.teamId)) continue;

        // Build the trigger date (match time minus REMINDER_MINUTES)
        const matchDate = buildMatchDate(match.date, match.time);
        if (!matchDate) continue;

        const triggerTime = matchDate.getTime() - REMINDER_MINUTES * 60 * 1000;
        if (triggerTime <= now) continue; // already past

        const gameLabel = GAME_LABELS[match.game] || match.game;
        const opponent = match.awayTeam.name;
        const timeStr = match.time;

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: `⚔️ ${match.homeTeam.name} vs ${opponent}`,
                    body: `${gameLabel} — ${match.tournament}\nEmpieza en ${REMINDER_MINUTES} minutos (${timeStr})`,
                    data: { matchId: match.id, teamId: match.teamId },
                    sound: 'default',
                    ...(Platform.OS === 'android' && { channelId: 'match-reminders' }),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: new Date(triggerTime),
                },
            });
            scheduledCount++;
        } catch (err) {
            console.warn(`Failed to schedule reminder for match ${match.id}:`, err);
        }
    }

    console.log(`Notifications: scheduled ${scheduledCount} match reminders`);
    return scheduledCount;
}

/**
 * Cancel all scheduled notifications (e.g. when user disables all reminders).
 */
export async function cancelAllReminders(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Notifications: all reminders cancelled');
}

// ─── Internal Helpers ──────────────────────────────────────

/**
 * Parse a match date ("2026-02-20") + time ("18:00") into a Date object.
 */
function buildMatchDate(dateStr: string, timeStr: string): Date | null {
    try {
        // Match date format: "YYYY-MM-DD", time format: "HH:MM"
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;

        date.setHours(hours, minutes, 0, 0);
        return date;
    } catch {
        return null;
    }
}
