import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ProgressRing from '../components/ProgressRing';
import { Card } from '../components/ui';
import { useApp } from '../state/AppContext';
import { colors, fonts, spacing, type } from '../theme';

export default function ProgressScreen({ navigation }) {
  const { readinessScore, sessions } = useApp();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={type.h1}>Your progress</Text>

        <Card style={styles.ringCard}>
          <ProgressRing score={readinessScore} size={168} />
          <Text style={[type.bodySmall, { textAlign: 'center', marginTop: spacing.sm, maxWidth: 260 }]}>
            Your readiness score grows with every completed session and improves with your feedback scores.
          </Text>
        </Card>

        <Text style={[type.h2, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Session history
        </Text>

        {sessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="mic-outline" size={36} color={colors.textMuted} />
            <Text style={[type.h3, { marginTop: spacing.sm }]}>No sessions yet</Text>
            <Text style={[type.bodySmall, { textAlign: 'center', marginTop: 4 }]}>
              Complete your first mock interview and your history will show up here.
            </Text>
          </Card>
        ) : (
          sessions.map((s) => {
            const overall = Math.round(
              (s.summary.communication + s.summary.technicalDepth + s.summary.clarity) / 3
            );
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate('SessionSummary', { sessionId: s.id })}
              >
                <Card style={styles.historyRow}>
                  <View style={styles.scoreBubble}>
                    <Text style={styles.scoreBubbleText}>{overall}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={type.h3}>{s.title}</Text>
                    <Text style={type.bodySmall}>
                      {new Date(s.completedAt).toLocaleDateString()} · {s.answers.length} questions
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Card>
              </Pressable>
            );
          })
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingTop: spacing.md },
  ringCard: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  historyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  scoreBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBubbleText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
});
