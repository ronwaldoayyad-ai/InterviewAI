import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, TextField } from '../../components/ui';
import { useApp } from '../../state/AppContext';
import { colors, fonts, spacing, type } from '../../theme';

export default function LoginScreen({ navigation }) {
  const { signIn } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = () => {
    if (!email.includes('@') || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      signIn({ name: email.split('@')[0], email, authProvider: 'email' });
    }, 700);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={type.h1}>Welcome back</Text>
          <Text style={[type.bodySmall, { marginTop: 6, marginBottom: spacing.lg }]}>
            Log in to continue your interview prep.
          </Text>

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton title="Log in" onPress={submit} loading={loading} />

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            style={{ marginTop: spacing.md, alignSelf: 'center' }}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingTop: spacing.xl },
  error: { ...type.bodySmall, color: colors.danger, marginBottom: spacing.md },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
