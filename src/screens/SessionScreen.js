import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { Card, StepProgress } from '../components/ui';
import SiriOrb from '../components/SiriOrb';
import Waveform from '../components/Waveform';
import { analyzeAnswer, nextQuestion, summarizeSession } from '../data/mockAI';
import { setPlaybackMode, setRecordingMode } from '../services/audioSession';
import { persistRecording } from '../services/storage';
import { speakText } from '../services/voice';
import { useApp } from '../state/AppContext';
import { colors, fonts, radii, shadow, spacing, type } from '../theme';

const COUNTDOWN_SECONDS = 5;

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Real-time interview session (TDD §4.3).
// Flow per question: TTS readback → 5s countdown → mic auto-starts → tap stop.
export default function SessionScreen({ navigation, route }) {
  const { session } = route.params;
  const unlimited = session.questionLimit === 'unlimited';
  const { addSession, voiceGender, appVolume, setAppVolume } = useApp();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // Notification cue played when a question starts and when the mic arms
  const notificationSound = useAudioPlayer(require('../../assets/sounds/notification.mp3'));
  const playSound = (player) => {
    try {
      player.volume = appVolume;
      player.seekTo(0);
      player.play();
    } catch {}
  };

  const changeVolume = (delta) => {
    Haptics.selectionAsync();
    setAppVolume((v) => Math.min(1, Math.max(0.1, Math.round((v + delta) * 10) / 10)));
  };

  const [questions, setQuestions] = useState(session.questions);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('reading'); // reading | countdown | recording | processing
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const answersRef = useRef([]);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const finishingRef = useRef(false);
  const speechRef = useRef(null);
  const phaseRef = useRef('reading');
  phaseRef.current = phase;

  const question = questions[index];
  const isLast = !unlimited && index === questions.length - 1;

  // Question readback via natural TTS voice, then hand off to the countdown
  useEffect(() => {
    setPhase('reading');
    setMuted(false);
    setElapsed(0);
    let cancelled = false;
    const advance = () => {
      if (!cancelled && phaseRef.current === 'reading') beginCountdown();
    };
    playSound(notificationSound);
    speechRef.current = speakText(question.questionText, voiceGender, {
      volume: appVolume,
      onDone: advance,
      onError: advance,
    });
    // Safety net in case TTS callbacks never fire (some web/emulator engines)
    const fallback = setTimeout(advance, 6000 + question.questionText.length * 100);
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      speechRef.current?.cancel();
    };
  }, [index]);

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      clearInterval(countdownRef.current);
      speechRef.current?.cancel();
    },
    []
  );

  const beginCountdown = () => {
    speechRef.current?.cancel();
    setPhase('countdown');
    setCountdown(COUNTDOWN_SECONDS);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          startRecording();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const startRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playSound(notificationSound);
    try {
      const perm = await AudioModule.getRecordingPermissionsAsync();
      if (perm.granted) {
        // Record mode only while the mic is live (keeps iOS TTS on loudspeaker)
        await setRecordingMode();
        if (session.micInputUid) {
          try {
            await recorder.setInput(session.micInputUid);
          } catch {}
        }
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch {
      // Recording unavailable (e.g. web preview) — session still works with mock analysis
    }
    setElapsed(0);
    setMuted(false);
    setPhase('recording');
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  // Mute pauses the recorder + timer so muted time never counts against pacing
  const toggleMute = () => {
    Haptics.selectionAsync();
    setMuted((m) => {
      const next = !m;
      try {
        if (next) {
          recorder.pause();
          clearInterval(timerRef.current);
        } else {
          recorder.record();
          timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
        }
      } catch {}
      return next;
    });
  };

  const finalizeSession = () => {
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
  };

  const stopRecording = async (finishAfter = false) => {
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
    setPlaybackMode(); // back to loudspeaker for the next question's TTS
    if (uri) {
      uri = await persistRecording(uri, `${Date.now()}_q${index + 1}.m4a`);
    }

    const answeredQuestion = question;
    const answeredElapsed = elapsed;
    // Simulates upload → Whisper STT → LLM critique
    setTimeout(() => {
      answersRef.current.push({
        question: answeredQuestion,
        audioUri: uri,
        durationSec: answeredElapsed,
        analysis: analyzeAnswer({ question: answeredQuestion, durationSec: answeredElapsed }),
      });

      if (finishAfter || isLast) {
        finalizeSession();
      } else {
        if (unlimited && index + 1 >= questions.length) {
          setQuestions((qs) => [
            ...qs,
            nextQuestion({
              sessionType: session.sessionType,
              contextText: session.contextText,
              customBank: session.customBank,
            }),
          ]);
        }
        setIndex((i) => i + 1);
      }
    }, 1400);
  };

  // "End interview" for unlimited sessions (and early exit for finite ones)
  const endInterview = () => {
    if (finishingRef.current) return;
    if (phase === 'recording') {
      finishingRef.current = true;
      stopRecording(true);
      return;
    }
    speechRef.current?.cancel();
    clearInterval(countdownRef.current);
    if (answersRef.current.length > 0) {
      finishingRef.current = true;
      finalizeSession();
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End session"
            onPress={endInterview}
            hitSlop={12}
          >
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </Pressable>
          <Text style={type.caption}>
            {unlimited ? `Question ${index + 1} · Unlimited` : `Question ${index + 1} of ${questions.length}`}
          </Text>
          <View style={{ width: 26 }} />
        </View>
        {!unlimited && <StepProgress step={index + 1} total={questions.length} />}

        <View style={styles.volumeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease volume"
            onPress={() => changeVolume(-0.1)}
            style={styles.volBtn}
            hitSlop={8}
          >
            <Ionicons name="remove" size={18} color={colors.primary} />
          </Pressable>
          <Ionicons
            name={appVolume <= 0.3 ? 'volume-low' : appVolume <= 0.7 ? 'volume-medium' : 'volume-high'}
            size={18}
            color={colors.textSecondary}
          />
          <View
            style={styles.volTrack}
            accessibilityLabel={`Interviewer volume ${Math.round(appVolume * 100)} percent`}
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <View key={i} style={[styles.volSeg, i < Math.round(appVolume * 10) && styles.volSegOn]} />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase volume"
            onPress={() => changeVolume(0.1)}
            style={styles.volBtn}
            hitSlop={8}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <Card style={styles.questionCard}>
          <View style={styles.focusRow}>
            <View style={styles.focusPill}>
              <Ionicons name="locate-outline" size={13} color={colors.primary} />
              <Text style={styles.focusText}>{question.expectedFocus}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Read question again"
              hitSlop={8}
              onPress={() => {
                if (phase === 'recording' || phase === 'processing') return;
                speechRef.current?.cancel();
                clearInterval(countdownRef.current);
                setPhase('reading');
                speechRef.current = speakText(question.questionText, voiceGender, {
                  volume: appVolume,
                  onDone: beginCountdown,
                  onError: beginCountdown,
                });
              }}
            >
              <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.questionText}>{question.questionText}</Text>
          {phase === 'reading' && (
            <View style={styles.readingRow}>
              <Ionicons name="volume-high" size={15} color={colors.accent} />
              <Text style={[type.caption, { color: colors.accent }]}>Reading question aloud…</Text>
            </View>
          )}
        </Card>

        <View style={styles.recordZone}>
          <SiriOrb
            key={index}
            size={88}
            state={
              phase === 'reading'
                ? 'speaking'
                : phase === 'countdown'
                ? 'countdown'
                : phase === 'recording'
                ? 'listening'
                : 'processing'
            }
          />
          {phase === 'countdown' && (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.countdownNum}>{countdown}</Text>
              <Text style={type.bodySmall}>Get ready — mic turns on automatically</Text>
            </View>
          )}

          {phase === 'recording' && (
            <View style={styles.recBadge}>
              <View style={[styles.recDot, muted && { backgroundColor: colors.textMuted }]} />
              <Text style={[styles.recText, muted && { color: colors.textMuted }]}>
                {muted ? 'MUTED' : 'REC'} {formatTime(elapsed)}
              </Text>
            </View>
          )}
          <Waveform active={phase === 'recording' && !muted} tint={colors.recording} height={56} />

          {phase === 'processing' ? (
            <View style={styles.processing}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={[type.bodySmall, { color: colors.primary, fontFamily: fonts.semibold }]}>
                Analyzing your answer…
              </Text>
            </View>
          ) : phase === 'recording' ? (
            <View style={styles.controlsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
                onPress={toggleMute}
                style={[styles.sideBtn, muted && { backgroundColor: colors.border }]}
              >
                <Ionicons name={muted ? 'mic-off' : 'mic'} size={22} color={muted ? colors.textSecondary : colors.primary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop recording"
                onPress={() => stopRecording(false)}
                style={({ pressed }) => [
                  styles.recordBtn,
                  styles.recordBtnActive,
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
              >
                <Ionicons name="stop" size={30} color="#fff" />
              </Pressable>
              <View style={[styles.sideBtn, { opacity: 0 }]} pointerEvents="none" />
            </View>
          ) : phase === 'countdown' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start answering now"
              onPress={() => {
                clearInterval(countdownRef.current);
                startRecording();
              }}
              style={({ pressed }) => [styles.recordBtn, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Ionicons name="mic" size={30} color="#fff" />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip readback and answer now"
              onPress={beginCountdown}
              style={({ pressed }) => [styles.recordBtn, { opacity: 0.85 }, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              <Ionicons name="play-skip-forward" size={26} color="#fff" />
            </Pressable>
          )}

          <Text style={[type.bodySmall, { textAlign: 'center' }]}>
            {phase === 'recording'
              ? muted
                ? 'Mic is muted — tap the mic to resume'
                : isLast
                ? 'Tap stop to finish your final answer'
                : 'Tap stop when you finish your answer'
              : phase === 'processing'
              ? 'Hang tight — feedback is being generated'
              : phase === 'countdown'
              ? 'Or tap the mic to start right away'
              : 'Listen, or tap to skip ahead'}
          </Text>

          {phase !== 'processing' && (unlimited || answersRef.current.length > 0) && (
            <Pressable accessibilityRole="button" onPress={endInterview} style={styles.endBtn}>
              <Ionicons name="flag-outline" size={16} color={colors.danger} />
              <Text style={styles.endText}>End interview{phase === 'recording' ? ' after this answer' : ''}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  volBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volTrack: { flexDirection: 'row', gap: 3 },
  volSeg: { width: 9, height: 6, borderRadius: 2, backgroundColor: colors.border },
  volSegOn: { backgroundColor: colors.primary },
  questionCard: { marginTop: spacing.md, padding: spacing.lg },
  focusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  focusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  focusText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  questionText: { fontFamily: fonts.semibold, fontSize: 21, lineHeight: 30, color: colors.text },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  recordZone: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  countdownNum: { fontFamily: fonts.bold, fontSize: 56, color: colors.primary, lineHeight: 62 },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.recording },
  recText: { fontFamily: fonts.bold, fontSize: 14, color: colors.recording, letterSpacing: 1 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.dangerSoft,
  },
  endText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.danger },
});
