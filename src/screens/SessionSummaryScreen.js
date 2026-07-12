import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, PrimaryButton, ScoreBar, SecondaryButton } from '../components/ui';
import { exportSession, pickStorageDirectory } from '../services/storage';
import { useApp } from '../state/AppContext';
import { colors, fonts, spacing, type } from '../theme';

// Post-session high-level metrics (PRD §4.4)
export default function SessionSummaryScreen({ navigation, route }) {
  const { sessions, storageDirUri, setStorageDirUri } = useApp();
  const session = sessions.find((s) => s.id === route.params.sessionId);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState('');

  const saveToDevice = async () => {
    if (!session) return;
    setExporting(true);
    setExportResult('');
    try {
      let dir = storageDirUri;
      // Android: first export prompts for a folder, remembered afterwards
      if (Platform.OS === 'android' && !dir) {
        dir = await pickStorageDirectory();
        if (dir) setStorageDirUri(dir);
      }
      setExportResult(await exportSession(session, dir));
    } catch (e) {
      setExportResult('Export failed — please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={type.body}>Session not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { summary } = session;
  const overall = Math.round((summary.communication + summary.technicalDepth + summary.clarity) / 3);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {route.params.celebrate && (
          <View style={styles.celebrateBadge}>
            <Ionicons name="trophy" size={34} color="#fff" />
          </View>
        )}
        <Text style={[type.h1, { textAlign: 'center' }]}>Session complete</Text>
        <Text style={[type.bodySmall, { textAlign: 'center', marginTop: 6, marginBottom: spacing.lg }]}>
          {session.title} · {session.answers.length} questions answered
        </Text>

        <Card style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <Text style={styles.overall}>{overall}</Text>
          <Text style={type.caption}>OVERALL PERFORMANCE</Text>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <ScoreBar label="Communication" score={summary.communication} />
          <ScoreBar label="Technical depth" score={summary.technicalDepth} tint={colors.accent} />
          <ScoreBar label="Clarity" score={summary.clarity} tint={colors.warning} />
        </Card>

        <Text style={[type.h2, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>Your answers</Text>
        {session.answers.map((a, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            onPress={() => navigation.navigate('AnswerReview', { sessionId: session.id, answerIndex: i })}
          >
            <Card style={styles.answerRow}>
              <View style={styles.qBadge}>
                <Text style={styles.qBadgeText}>Q{i + 1}</Text>
              </View>
              <Text style={[type.bodySmall, { flex: 1, marginHorizontal: spacing.sm }]} numberOfLines={2}>
                {a.question.questionText}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Card>
          </Pressable>
        ))}

        <PrimaryButton
          title="Review detailed feedback"
          icon="analytics"
          onPress={() => navigation.navigate('AnswerReview', { sessionId: session.id, answerIndex: 0 })}
          style={{ marginTop: spacing.md }}
        />
        <SecondaryButton
          title={exporting ? 'Saving…' : 'Save transcript & audio to device'}
          icon="download-outline"
          onPress={saveToDevice}
          style={{ marginTop: spacing.sm }}
        />
        {exportResult ? (
          <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.sm, color: colors.success }]}>
            {exportResult}
          </Text>
        ) : null}
        <SecondaryButton
          title="Back to dashboard"
          onPress={() => navigation.popToTop()}
          style={{ marginTop: spacing.sm }}
        />
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  celebrateBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  overall: { fontFamily: fonts.bold, fontSize: 52, color: colors.primary },
  answerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  qBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qBadgeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
