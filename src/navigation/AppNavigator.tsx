import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, FontSize } from '../theme';
import {
  RootTabParamList,
  TeamsStackParamList,
  CalendarStackParamList,
  ResultsStackParamList,
  SettingsStackParamList,
} from '../types';

// Screens
import TeamsListScreen from '../screens/teams/TeamsListScreen';
import TeamDetailScreen from '../screens/teams/TeamDetailScreen';
import PlayerDetailScreen from '../screens/teams/PlayerDetailScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import ResultsScreen from '../screens/results/ResultsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import LoginScreen from '../screens/settings/LoginScreen';
import RegisterScreen from '../screens/settings/RegisterScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();
const TeamsStack = createNativeStackNavigator<TeamsStackParamList>();
const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();
const ResultsStack = createNativeStackNavigator<ResultsStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

// ─── Stack Navigators ─────────────────────────────────────────────
function TeamsStackNavigator() {
  const { t } = useTranslation();
  return (
    <TeamsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <TeamsStack.Screen
        name="TeamsList"
        component={TeamsListScreen}
        options={{ headerShown: false }}
      />
      <TeamsStack.Screen
        name="TeamDetail"
        component={TeamDetailScreen}
        options={{ title: '' }}
      />
      <TeamsStack.Screen
        name="PlayerDetail"
        component={PlayerDetailScreen}
        options={{ title: '' }}
      />
    </TeamsStack.Navigator>
  );
}

function CalendarStackNavigator() {
  return (
    <CalendarStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <CalendarStack.Screen
        name="CalendarMain"
        component={CalendarScreen}
        options={{ headerShown: false }}
      />
    </CalendarStack.Navigator>
  );
}

function ResultsStackNavigator() {
  return (
    <ResultsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <ResultsStack.Screen
        name="ResultsMain"
        component={ResultsScreen}
        options={{ headerShown: false }}
      />
    </ResultsStack.Navigator>
  );
}

function SettingsStackNavigator() {
  const { t } = useTranslation();
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <SettingsStack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: t('settings.notifications') }}
      />
      <SettingsStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: t('settings.login') }}
      />
      <SettingsStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: t('settings.register') }}
      />
    </SettingsStack.Navigator>
  );
}

// ─── Tab Navigator (Root) ─────────────────────────────────────────
export default function AppNavigator() {
  const { t } = useTranslation();

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          lazy: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarLabelStyle: {
            fontSize: FontSize.xs,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="TeamsTab"
          component={TeamsStackNavigator}
          options={{
            tabBarLabel: t('tabs.teams'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="CalendarTab"
          component={CalendarStackNavigator}
          options={{
            tabBarLabel: t('tabs.calendar'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="ResultsTab"
          component={ResultsStackNavigator}
          options={{
            tabBarLabel: t('tabs.results'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trophy" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsStackNavigator}
          options={{
            tabBarLabel: t('tabs.settings'),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
