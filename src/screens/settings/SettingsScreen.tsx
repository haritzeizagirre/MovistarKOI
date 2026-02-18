import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, FontSize, BorderRadius } from '../../theme';
import { SettingsStackParamList } from '../../types';
import { auth } from '../../config/firebase';

type NavigationProp = NativeStackNavigationProp<SettingsStackParamList, 'SettingsMain'>;

const LANGUAGE_KEY = '@movistar_koi_language';

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language);

  const isLoggedIn = auth.currentUser !== null;
  const userEmail = auth.currentUser?.email;

  const toggleLanguage = async () => {
    const newLang = currentLang === 'es' ? 'en' : 'es';
    await i18n.changeLanguage(newLang);
    await AsyncStorage.setItem(LANGUAGE_KEY, newLang);
    setCurrentLang(newLang);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('settings.title')}</Text>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.account')}</Text>
          <View style={styles.card}>
            {isLoggedIn ? (
              <>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="person-circle" size={24} color={Colors.primary} />
                    <View style={styles.rowTextContainer}>
                      <Text style={styles.rowLabel}>{t('settings.loggedInAs')}</Text>
                      <Text style={styles.rowValue}>{userEmail}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    auth.signOut();
                    Alert.alert('OK', 'Logged out');
                  }}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="log-out-outline" size={24} color={Colors.loss} />
                    <Text style={[styles.rowLabel, { color: Colors.loss }]}>
                      {t('settings.logout')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => navigation.navigate('Login')}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="log-in-outline" size={24} color={Colors.primary} />
                    <Text style={styles.rowLabel}>{t('settings.login')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => navigation.navigate('Register')}
                >
                  <View style={styles.rowLeft}>
                    <Ionicons name="person-add-outline" size={24} color={Colors.accent} />
                    <Text style={styles.rowLabel}>{t('settings.register')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.notifications')}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('NotificationSettings')}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="notifications-outline" size={24} color={Colors.primary} />
                <Text style={styles.rowLabel}>
                  {t('settings.manageNotifications')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={toggleLanguage}>
              <View style={styles.rowLeft}>
                <Ionicons name="globe-outline" size={24} color={Colors.primary} />
                <Text style={styles.rowLabel}>{t('settings.language')}</Text>
              </View>
              <View style={styles.langBadge}>
                <Text style={styles.langText}>
                  {currentLang === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.about')}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="information-circle-outline" size={24} color={Colors.primary} />
                <Text style={styles.rowLabel}>{t('settings.version')}</Text>
              </View>
              <Text style={styles.versionText}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Branding Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLogo}>KOI</Text>
          <Text style={styles.footerText}>Movistar KOI Esports</Text>
          <Text style={styles.footerSub}>Fan App</Text>
        </View>

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
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: FontSize.title,
    fontWeight: '800',
  },
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  rowValue: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.md,
  },
  langBadge: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  langText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.lg,
  },
  footerLogo: {
    color: Colors.primary,
    fontSize: FontSize.hero,
    fontWeight: '900',
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
  footerSub: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
});
