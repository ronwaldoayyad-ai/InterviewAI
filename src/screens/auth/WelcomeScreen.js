import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OAuthButton, PrimaryButton, SecondaryButton } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { colors, spacing, type } from '../../theme';

export default function WelcomeScreen({ navigation }) {
  const { signIn } = useApp();

  const oauthSignIn = (provider) =>
    signIn({ name: 'Ron', email: 'ronayyad@gmail.com', authProvider: provider });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Ionicons name="mic" size={34} color="#fff" />
          </View>
          <Text style={[type.display, styles.title]}>InterviewAI</Text>
          <Text style={styles.tagline}>
            Practice interviews tailored to your goals, with AI feedback that actually makes you better.
          </Text>
        </View>

        <View style={styles.actions}>
          <OAuthButton provider="Google" icon="logo-google" onPress={() => oauthSignIn('google')} />
          <OAuthButton provider="Apple" icon="logo-apple" onPress={() => oauthSignIn('apple')} />
          <OAuthButton provider="LinkedIn" icon="logo-linkedin" onPress={() => oauthSignIn('linkedin')} />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <PrimaryButton title="Sign up with email" onPress={() => navigation.navigate('Signup')} />
          <SecondaryButton
            title="I already have an account"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: spacing.xxl },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { marginBottom: spacing.sm },
  tagline: {
    ...type.bodySmall,
    textAlign: 'center',
    maxWidth: 300,
    fontSize: 15,
    lineHeight: 23,
  },
  actions: { marginTop: spacing.xl },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...type.caption },
});
