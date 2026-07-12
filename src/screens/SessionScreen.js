import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { Card, StepProgress } from '../components/ui';
import Waveform from '../components/Waveform';
import { analyzeAnswer, summarizeSession } from '../data/mockAI';
import { useApp } from '../state/AppContext';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Real-time interview session: question → record answer → next (TDD §4.3)
export default function SessionScreen({ navigation, route }) {
  const { session } = route.params;
  const { addSession } = useApp();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('ready'); // ready | recording | processing
  const [elapsed, setElapsed] = useState(0);
  const answersRef = useRef([]);
  const timerRef = useRef(null);

  const question = session.questions[index];
  const isLast = index === session.questions.length - 1;

  useEffect(() => () => clearInterval(timerRef.current), []);

  const startRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const perm = await AudioModule.getRecordingPermissionsAsync();
      if (perm.granted) {
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch {
      // Recording unavailable (e.g. web preview) — session still works with mock analysis
    }
    setElapsed(0);
    setPhase('recording');
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('processing');
    let uri = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch {
      // ignore — mock analysis continues without audio
    }

    // Simulates upload → Whisper STT → LLM critique
    setTimeout(() => {
      answersRef.current.push({
        question,
        audioUri: uri,
        durationSec: elapsed,
        analysis: analyzeAnswer({ question, durationSec: elapsed }),
      });

      if (isLast) {
        const answers = answersRef.current;
        const completed = {
          id: `s_${Date.now()}`,
          title: session.title,
          sessionType: session.sessionType,
          contextSource: session.contextSource,
          completedAt: new Date().toISOString(),
          answers,
          summary: summarizeSession(answers),
        };
        addSession(completed);
        navigation.replace('SessionSummary', { sessionId: completed.id, celebrate: true });
      } else {
        setIndex((i) => i + 1);
        setElapsed(0);
        setPhase('ready');
      }
    }, 1400);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End session"
            onPress={() => navigation.goBack()}
            hitSlop={12}
          >
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </Pressable>
          <Text style={type.caption}>
            Question {index + 1} of {session.questions.length}
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <StepProgress step={index + 1} total={session.questions.length} />

        <Card style={styles.questionCard}>
          <View style={styles.focusPill}>
            <Ionicons name="locate-outline" size={13} color={colors.primary} />
            <Text style={styles.focusText}>{question.expectedFocus}</Text>
          </View>
          <Text style={styles.questionText}>{question.questionText}</Text>
        </Card>

        <View style={styles.recordZone}>
          {phase === 'recording' && (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC {formatTime(elapsed)}</Text>
            </View>
          )}
          <Waveform active={phase === 'recording'} tint={colors.recording} height={56} />

          {phase === 'processing' ? (
            <View style={styles.processing}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={[type.bodySmall, { color: colors.primary, fontFamily: fonts.semibold }]}>
                Analyzing your answer…
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={phase === 'recording' ? 'Stop recording' : 'Start answering'}
              onPress={phase === 'recording' ? stopRecording : startRecording}
              style={({ pressed }) => [
                styles.recordBtn,
                phase === 'recording' && styles.recordBtnActive,
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <Ionicons name={phase === 'recording' ? 'stop' : 'mic'} size={30} color="#fff" />
            </Pressable>
          )}
          <Text style={[type.bodySmall, { textAlign: 'center' }]}>
            {phase === 'recording'
              ? isLast
                ? 'Tap to finish your final answer'
                : 'Tap when you finish your answer'
              : phase === 'processing'
              ? 'Hang tight — feedback is being generated'
              : 'Tap the mic and answer out loud'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  questionCard: { marginTop: spacing.md, padding: spacing.lg },
  focusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    marginBottom: spacing.md,
  },
  focusText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  questionText: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 30, color: colors.text },
  recordZone: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.lg },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.recording },
  recText: { fontFamily: fonts.bold, fontSize: 14, color: colors.recording, letterSpacing: 1 },
  recordBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  recordBtnActive: { backgroundColor: colors.recording, shadowColor: colors.recording },
  processing: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 76 },
});
