import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, StepProgress, TextField } from '../../components/ui';
import { colors, spacing, type } from '../../theme';

// Multi-step recovery flow: Request > Verification > Reset > Success (PRD §4.1)
export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const next = () => {
    if (step === 0 && !email.includes('@')) return setError('Enter a valid email address.');
    if (step === 1 && code.length !== 6) return setError('Enter the 6-digit code we sent you.');
    if (step === 2 && password.length < 6) return setError('Password must be at least 6 characters.');
    setError('');
    setStep((s) => s + 1);
  };

  const steps = [
    {
      title: 'Reset your password',
      body: "Enter the email on your account and we'll send a verification code.",
      field: (
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
      ),
      cta: 'Send code',
    },
    {
      title: 'Check your inbox',
      body: `We sent a 6-digit code to ${email}.`,
      field: (
        <TextField
          label="Verification code"
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
        />
      ),
      cta: 'Verify',
    },
    {
      title: 'Choose a new password',
      body: 'Make it at least 6 characters.',
      field: (
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />
      ),
      cta: 'Reset password',
    },
  ];

  if (step === 3) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={44} color="#fff" />
          </View>
          <Text style={[type.h1, { textAlign: 'center' }]}>Password updated</Text>
          <Text style={[type.bodySmall, { textAlign: 'center', marginTop: 8, marginBottom: spacing.xl }]}>
            You're all set. Log in with your new password.
          </Text>
          <PrimaryButton title="Back to log in" onPress={() => navigation.navigate('Login')} style={{ alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  const current = steps[step];
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <StepProgress step={step + 1} total={4} />
        <Text style={type.h1}>{current.title}</Text>
        <Text style={[type.bodySmall, { marginTop: 6, marginBottom: spacing.lg }]}>{current.body}</Text>
        {current.field}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title={current.cta} onPress={next} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  error: { ...type.bodySmall, color: colors.danger, marginBottom: spacing.md },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  successBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
