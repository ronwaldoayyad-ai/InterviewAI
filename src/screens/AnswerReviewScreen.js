import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Card, ScoreBar } from '../components/ui';
import { useApp } from '../state/AppContext';
import { colors, fonts, radii, spacing, type } from '../theme';

function FeedbackList({ icon, tint, bg, title, items }) {
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={styles.feedHead}>
        <View style={[styles.feedIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
        <Text style={type.h3}>{title}</Text>
      </View>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <View style={[styles.bullet, { backgroundColor: tint }]} />
          <Text style={[type.bodySmall, { flex: 1 }]}>{item}</Text>
        </View>
      ))}
    </Card>
  );
}

const STAR_LABELS = [
  ['situation', 'Situation'],
  ['task', 'Task'],
  ['action', 'Action'],
  ['result', 'Result'],
];

// Granular per-answer review: playback + AI feedback + STAR assessment (PRD §4.4)
export default function AnswerReviewScreen({ navigation, route }) {
  const { sessions } = useApp();
  const session = sessions.find((s) => s.id === route.params.sessionId);
  const answerIndex = route.params.answerIndex ?? 0;
  const answer = session?.answers[answerIndex];

  const player = useAudioPlayer(answer?.audioUri || null);
  const status = useAudioPlayerStatus(player);

  if (!session || !answer) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={type.body}>Answer not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { analysis } = answer;
  const hasNext = answerIndex < session.answers.length - 1;

  const togglePlay = () => {
    if (!answer.audioUri) return;
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || status.currentTime >= status.duration - 0.1) player.seekTo(0);
      player.play();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={type.caption}>
          QUESTION {answerIndex + 1} OF {session.answers.length}
        </Text>
        <Text style={[type.h2, { marginTop: 6 }]}>{answer.question.questionText}</Text>

        <Card style={styles.playerCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.playing ? 'Pause your answer' : 'Play your answer'}
            onPress={togglePlay}
            style={[styles.playBtn, !answer.audioUri && { opacity: 0.4 }]}
          >
            <Ionicons name={status.playing ? 'pause' : 'play'} size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={type.h3}>Your recorded answer</Text>
            <Text style={type.bodySmall}>
              {answer.audioUri
                ? `${Math.max(1, answer.durationSec)}s recording`
                : 'Audio unavailable in this environment'}
            </Text>
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[type.caption, { marginBottom: 6 }]}>AI TRANSCRIPT</Text>
          <Text style={[type.bodySmall, { fontStyle: 'italic' }]}>{analysis.transcript}</Text>
        </Card>

        <FeedbackList
          icon="thumbs-up"
          tint={colors.success}
          bg={colors.successSoft}
          title="Strengths"
          items={analysis.strengths}
        />
        <FeedbackList
          icon="trending-up"
          tint={colors.warning}
          bg={colors.warningSoft}
          title="Areas for improvement"
          items={analysis.improvements}
        />
        <FeedbackList
          icon="bulb"
          tint={colors.primary}
          bg={colors.primaryLight}
          title="Coach tips"
          items={analysis.tips}
        />

        <Card style={{ marginBottom: spacing.md }}>
          <View style={styles.feedHead}>
            <View style={[styles.feedIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="speedometer" size={16} color={colors.accent} />
            </View>
            <Text style={type.h3}>Pacing & speed</Text>
          </View>
          <ScoreBar label={analysis.pacingLabel} score={analysis.pacingScore} tint={colors.accent} />
        </Card>

        <Card>
          <View style={styles.feedHead}>
            <View style={[styles.feedIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="star" size={16} color={colors.primary} />
            </View>
            <Text style={type.h3}>STAR method breakdown</Text>
          </View>
          {STAR_LABELS.map(([key, label]) => (
            <ScoreBar key={key} label={label} score={analysis.starScores[key]} />
          ))}
        </Card>

        {hasNext && (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.push('AnswerReview', {
                sessionId: session.id,
                answerIndex: answerIndex + 1,
              })
            }
            style={styles.nextBtn}
          >
            <Text style={styles.nextText}>Next answer</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primary} />
          </Pressable>
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playerCard: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  feedIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    marginTop: spacing.md,
  },
  nextText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary },
});
