import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../state/AppContext';
import { colors, fonts } from '../theme';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PracticeSetupScreen from '../screens/PracticeSetupScreen';
import HardwareCheckScreen from '../screens/HardwareCheckScreen';
import SessionScreen from '../screens/SessionScreen';
import SessionSummaryScreen from '../screens/SessionSummaryScreen';
import AnswerReviewScreen from '../screens/AnswerReviewScreen';
import ProgressScreen from '../screens/ProgressScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

const TAB_ICONS = {
  HomeTab: ['home', 'home-outline'],
  PracticeTab: ['mic', 'mic-outline'],
  ProgressTab: ['stats-chart', 'stats-chart-outline'],
  ProfileTab: ['person', 'person-outline'],
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="HomeTab" component={DashboardScreen} options={{ title: 'Home' }} />
      <Tabs.Screen name="PracticeTab" component={PracticeSetupScreen} options={{ title: 'Practice' }} />
      <Tabs.Screen name="ProgressTab" component={ProgressScreen} options={{ title: 'Progress' }} />
      <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tabs.Navigator>
  );
}

const headerOptions = {
  headerShadowVisible: false,
  headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  headerTintColor: colors.primary,
  headerStyle: { backgroundColor: colors.background },
};

export default function RootNavigator() {
  const { user, onboarded } = useApp();

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Welcome stack (PRD: Welcome → Onboarding → Main tabs)
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ ...headerOptions, headerShown: true, title: '' }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ ...headerOptions, headerShown: true, title: '' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ ...headerOptions, headerShown: true, title: '' }} />
          </>
        ) : !onboarded ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="HardwareCheck"
              component={HardwareCheckScreen}
              options={{ ...headerOptions, headerShown: true, title: 'Setup check', headerBackTitle: 'Back' }}
            />
            <Stack.Screen name="Session" component={SessionScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="SessionSummary" component={SessionSummaryScreen} />
            <Stack.Screen
              name="AnswerReview"
              component={AnswerReviewScreen}
              options={{ ...headerOptions, headerShown: true, title: 'Answer review', headerBackTitle: 'Back' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
