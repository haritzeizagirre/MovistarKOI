import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Colors } from './src/theme';
import './src/i18n'; // Initialize i18n
import AppNavigator from './src/navigation/AppNavigator';
import { useInitialize } from './src/hooks/usePandaScore';
import { initializeNotifications } from './src/services/notificationService';


export default function App() {
  const { ready } = useInitialize();

  // Initialize notification channel & permissions once
  useEffect(() => {
    if (ready) {
      initializeNotifications().catch((err) =>
        console.warn('Notification init error:', err)
      );
    }
  }, [ready]);


  if (!ready) {
    return (
      <View style={[styles.container, styles.splash]}>
        <StatusBar style="light" />
        <Text style={styles.logo}>KOI</Text>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <AppNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  splash: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    color: Colors.primary,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
  },
});
