import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Card, PrimaryButton, TextField } from '../components/ui';
import { generateQuestions } from '../data/mockAI';
import { colors, fonts, spacing, type } from '../theme';

const SOURCES = [
  { key: 'jd', icon: 'document-text-outline', title: 'Job description', sub: 'Paste the JD for targeted questions' },
  { key: 'resume', icon: 'cloud-upload-outline', title: 'Resume upload', sub: 'PDF or DOCX' },
  { key: 'linkedin', icon: 'logo-linkedin', title: 'LinkedIn URL', sub: 'We read your profile highlights' },
  { key: 'generic', icon: 'shuffle-outline', title: 'General practice', sub: 'Curated questions for your goals' },
];

const COUNT_OPTIONS = [
  { key: 3, label: '3' },
  { key: 5, label: '5' },
  { key: 10, label: '10' },
  { key: 'unlimited', label: '∞ Unlimited' },
];

export default function PracticeSetupScreen({ navigation }) {
  const [sessionType, setSessionType] = useState('behavioral');
  const [questionCount, setQuestionCount] = useState(5);
  const [source, setSource] = useState('generic');
  const [contextText, setContextText] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pickResume = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    });
    if (!res.canceled && res.assets?.length) {
      setResumeFile(res.assets[0]);
      setError('');
    }
  };

  const start = async () => {
    if (source === 'jd' && contextText.trim().length < 30)
      return setError('Paste at least a few lines of the job description.');
    if (source === 'linkedin' && !/linkedin\.com/.test(contextText))
      return setError('Enter a valid LinkedIn profile URL.');
    if (source === 'resume' && !resumeFile) return setError('Attach your resume first.');
    setError('');
    setLoading(true);
    try {
      // AI question generation — must stay under the 5s latency budget (PRD §5)
      const ctx = source === 'resume' ? resumeFile?.name || '' : contextText;
      const questions = await generateQuestions({
        sessionType,
        contextSource: source,
        contextText: ctx,
        // Unlimited sessions start with a small batch; more stream in as you answer
        count: questionCount === 'unlimited' ? 3 : questionCount,
      });
      navigation.navigate('HardwareCheck', {
        session: {
          sessionType,
          contextSource: source,
          contextText: ctx,
          questionLimit: questionCount,
          questions,
          title: sessionType === 'behavioral' ? 'Behavioral interview' : 'Technical interview',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={type.h1}>New practice session</Text>
        <Text style={[type.bodySmall, { marginTop: 6 }]}>
          Tell the AI what you're interviewing for and it will build a question set.
        </Text>

        <Text style={[type.h3, styles.groupLabel]}>Interview track</Text>
        <View style={styles.segment}>
          {['behavioral', 'technical'].map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityState={{ selected: sessionType === t }}
              onPress={() => setSessionType(t)}
              style={[styles.segmentItem, sessionType === t && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, sessionType === t && styles.segmentTextActive]}>
                {t === 'behavioral' ? 'Behavioral' : 'Technical'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[type.h3, styles.groupLabel]}>Questions per session</Text>
        <View style={styles.segment}>
          {COUNT_OPTIONS.map((c) => (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityState={{ selected: questionCount === c.key }}
              onPress={() => setQuestionCount(c.key)}
              style={[styles.segmentItem, questionCount === c.key && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, questionCount === c.key && styles.segmentTextActive]}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {questionCount === 'unlimited' && (
          <Text style={[type.caption, { marginTop: 6 }]}>
            Questions keep coming until you tap "End interview" during the session.
          </Text>
        )}

        <Text style={[type.h3, styles.groupLabel]}>Context source</Text>
        {SOURCES.map((s) => (
          <Pressable key={s.key} onPress={() => { setSource(s.key); setError(''); }} accessibilityRole="button">
            <Card style={[styles.sourceCard, source === s.key && styles.sourceActive]}>
              <View style={[styles.sourceIcon, source === s.key && { backgroundColor: colors.primary }]}>
                <Ionicons name={s.icon} size={20} color={source === s.key ? '#fff' : colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={type.h3}>{s.title}</Text>
                <Text style={type.bodySmall}>{s.sub}</Text>
              </View>
              <Ionicons
                name={source === s.key ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={source === s.key ? colors.primary : colors.textMuted}
              />
            </Card>
          </Pressable>
        ))}

        {source === 'jd' && (
          <TextField
            label="Job description"
            value={contextText}
            onChangeText={setContextText}
            placeholder="Paste the job description here…"
            multiline
          />
        )}
        {source === 'linkedin' && (
          <TextField
            label="LinkedIn profile URL"
            value={contextText}
            onChangeText={setContextText}
            placeholder="https://linkedin.com/in/you"
            autoCapitalize="none"
          />
        )}
        {source === 'resume' && (
          <Pressable onPress={pickResume} accessibilityRole="button" accessibilityLabel="Attach resume">
            <Card style={styles.uploadCard}>
              <Ionicons
                name={resumeFile ? 'document-attach' : 'cloud-upload-outline'}
                size={28}
                color={colors.primary}
              />
              <Text style={[type.label, { marginTop: 8, color: colors.primary }]}>
                {resumeFile ? resumeFile.name : 'Tap to attach PDF / DOCX'}
              </Text>
            </Card>
          </Pressable>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          title={loading ? 'Generating questions…' : 'Generate my interview'}
          icon={loading ? undefined : 'sparkles'}
          onPress={start}
          loading={loading}
          style={{ marginTop: spacing.md }}
        />
        <Text style={[type.caption, { textAlign: 'center', marginTop: spacing.sm }]}>
          Powered by AI · usually ready in under 5 seconds
        </Text>
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingTop: spacing.md },
  groupLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
  segmentTextActive: { color: colors.primary, fontFamily: fonts.semibold },
  sourceCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sourceActive: { borderColor: colors.primary, borderWidth: 1.5 },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    marginBottom: spacing.md,
  },
  error: { ...type.bodySmall, color: colors.danger, marginTop: 4 },
});
