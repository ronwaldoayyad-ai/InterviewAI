import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';

export function PrimaryButton({ title, onPress, loading, disabled, icon, style }) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={inactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress && onPress();
      }}
      style={({ pressed }) => [
        styles.primaryBtn,
        pressed && { backgroundColor: colors.primaryDark },
        inactive && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 8 }} /> : null}
          <Text style={styles.primaryBtnText}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, icon, style, danger }) {
  const tint = danger ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        Haptics.selectionAsync();
        onPress && onPress();
      }}
      style={({ pressed }) => [
        styles.secondaryBtn,
        { borderColor: danger ? colors.dangerSoft : colors.primarySoft },
        pressed && { backgroundColor: danger ? colors.dangerSoft : colors.primaryLight },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={tint} style={{ marginRight: 8 }} /> : null}
      <Text style={[styles.secondaryBtnText, { color: tint }]}>{title}</Text>
    </Pressable>
  );
}

export function OAuthButton({ provider, icon, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${provider}`}
      onPress={() => {
        Haptics.selectionAsync();
        onPress && onPress();
      }}
      style={({ pressed }) => [styles.oauthBtn, pressed && { backgroundColor: colors.primaryLight }]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text style={styles.oauthText}>Continue with {provider}</Text>
    </Pressable>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress && onPress();
      }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({ label, ...props }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, props.multiline && { height: 120, textAlignVertical: 'top', paddingTop: 12 }]}
        {...props}
      />
    </View>
  );
}

export function StepProgress({ step, total }) {
  return (
    <View style={styles.stepRow} accessibilityLabel={`Step ${step} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.stepSegment, i < step && { backgroundColor: colors.primary }]} />
      ))}
    </View>
  );
}

export function ScoreBar({ label, score, tint = colors.primary }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.scoreHead}>
        <Text style={type.label}>{label}</Text>
        <Text style={[type.label, { color: tint }]}>{score}</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${score}%`, backgroundColor: tint }]} />
      </View>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={type.h2}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    ...shadow.raised,
  },
  primaryBtnText: { fontFamily: fonts.semibold, fontSize: 16, color: '#fff' },
  secondaryBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  secondaryBtnText: { fontFamily: fonts.semibold, fontSize: 16 },
  oauthBtn: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.sm,
  },
  oauthText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  chipTextSelected: { color: '#fff' },
  fieldLabel: { ...type.label, marginBottom: 6 },
  input: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  stepRow: { flexDirection: 'row', gap: 6, marginVertical: spacing.md },
  stepSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  scoreHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  scoreTrack: { height: 8, borderRadius: 4, backgroundColor: colors.primaryLight, overflow: 'hidden' },
  scoreFill: { height: 8, borderRadius: 4 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionAction: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
