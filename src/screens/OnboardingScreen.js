import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Chip, PrimaryButton, StepProgress, TextField } from '../components/ui';
import { useApp } from '../state/AppContext';
import { colors, spacing, type } from '../theme';

const ROLES = ['Software Engineer', 'Product Manager', 'UX Designer', 'Data Scientist', 'Marketing', 'Sales'];
const INDUSTRIES = ['Tech', 'Finance', 'Healthcare', 'Education', 'Retail', 'Media'];
const EXPERIENCE = ['Student / New grad', '1–3 years', '4–7 years', '8+ years'];

// Chip group with an "Other" option that reveals a free-text input (enhancement #1)
function ChipGroupWithOther({ options, selected, onToggle, placeholder, addLabel }) {
  const [showOther, setShowOther] = useState(false);
  const [text, setText] = useState('');
  const customItems = selected.filter((s) => !options.includes(s));

  const addCustom = () => {
    const value = text.trim();
    if (!value) return;
    if (!selected.includes(value)) onToggle(value);
    setText('');
  };

  return (
    <View>
      <View style={styles.chipWrap}>
        {options.map((o) => (
          <Chip key={o} label={o} selected={selected.includes(o)} onPress={() => onToggle(o)} />
        ))}
        {customItems.map((c) => (
          <Chip key={c} label={`${c} ✕`} selected onPress={() => onToggle(c)} />
        ))}
        <Chip label="Other…" selected={showOther} onPress={() => setShowOther((s) => !s)} />
      </View>
      {showOther && (
        <View style={styles.otherRow}>
          <View style={{ flex: 1 }}>
            <TextField
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              onSubmitEditing={addCustom}
              returnKeyType="done"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            onPress={addCustom}
            style={[styles.addBtn, !text.trim() && { opacity: 0.5 }]}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

// 4-step onboarding: Account ✓ (done at signup) → Profile → Goals → Success (PRD §4.1)
export default function OnboardingScreen() {
  const { user, completeOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [experience, setExperience] = useState(null);
  const [roles, setRoles] = useState([]);
  const [industries, setIndustries] = useState([]);

  const toggle = (list, setList, item) =>
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeOnboarding({ experience, roles, industries });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          {step > 1 ? (
            <Pressable onPress={() => setStep((s) => s - 1)} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <Text style={type.caption}>Step {step + 1} of 4</Text>
          <View style={{ width: 24 }} />
        </View>
        <StepProgress step={step + 1} total={4} />

        {step === 1 && (
          <>
            <Text style={type.h1}>Nice to meet you, {user?.name} 👋</Text>
            <Text style={styles.sub}>How much professional experience do you have?</Text>
            <View style={styles.chipWrap}>
              {EXPERIENCE.map((e) => (
                <Chip key={e} label={e} selected={experience === e} onPress={() => setExperience(e)} />
              ))}
            </View>
            <PrimaryButton title="Continue" disabled={!experience} onPress={() => setStep(2)} style={{ marginTop: spacing.lg }} />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={type.h1}>What are you aiming for?</Text>
            <Text style={styles.sub}>Pick the roles and industries you're targeting — the AI tailors questions to these.</Text>
            <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Roles</Text>
            <ChipGroupWithOther
              options={ROLES}
              selected={roles}
              onToggle={(r) => toggle(roles, setRoles, r)}
              placeholder="e.g. DevOps Engineer"
              addLabel="Add custom role"
            />
            <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Industries</Text>
            <ChipGroupWithOther
              options={INDUSTRIES}
              selected={industries}
              onToggle={(i) => toggle(industries, setIndustries, i)}
              placeholder="e.g. Aerospace"
              addLabel="Add custom industry"
            />
            <PrimaryButton title="Continue" disabled={roles.length === 0} onPress={() => setStep(3)} style={{ marginTop: spacing.lg }} />
          </>
        )}

        {step === 3 && (
          <View style={styles.successWrap}>
            <View style={styles.successBadge}>
              <Ionicons name="rocket" size={40} color="#fff" />
            </View>
            <Text style={[type.h1, { textAlign: 'center' }]}>You're all set!</Text>
            <Text style={[styles.sub, { textAlign: 'center' }]}>
              We'll tailor your practice sessions to {roles.slice(0, 2).join(' and ') || 'your goals'}
              {industries.length ? ` in ${industries[0]}` : ''}. Your first mock interview is one tap away.
            </Text>
            <PrimaryButton title="Go to my dashboard" onPress={finish} style={{ alignSelf: 'stretch', marginTop: spacing.lg }} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, flexGrow: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sub: { ...type.bodySmall, marginTop: 8, marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  otherRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xs },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
