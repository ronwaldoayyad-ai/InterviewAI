import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Card, PrimaryButton, TextField } from '../components/ui';
import { generateQuestions, makeIntroQuestion } from '../data/mockAI';
import { extractFromResume, extractFromUrl } from '../services/contextExtractor';
import { parseQuestions, readQuestionFile } from '../services/questions';
import { previewVoice } from '../services/voice';
import { useApp } from '../state/AppContext';
import { colors, fonts, spacing, type } from '../theme';

const SOURCES = [
  { key: 'jd', icon: 'document-text-outline', title: 'Job description', sub: 'Paste the JD — questions target its requirements' },
  { key: 'resume', icon: 'cloud-upload-outline', title: 'Resume upload', sub: 'PDF, DOCX, or TXT — questions built from its content' },
  { key: 'linkedin', icon: 'logo-linkedin', title: 'LinkedIn', sub: 'Profile URL, or paste your About/Experience text' },
  { key: 'website', icon: 'globe-outline', title: 'Website URL', sub: 'Company page or job posting — we read the page' },
  { key: 'custom', icon: 'list-outline', title: 'My question set', sub: 'Upload .txt/.json or paste your own questions' },
  { key: 'generic', icon: 'shuffle-outline', title: 'General practice', sub: 'Curated questions for your goals' },
];

const COUNT_OPTIONS = [
  { key: 3, label: '3' },
  { key: 5, label: '5' },
  { key: 10, label: '10' },
  { key: 'unlimited', label: '∞ Unlimited' },
];

export default function PracticeSetupScreen({ navigation }) {
  const { voiceGender, setVoiceGender, appVolume } = useApp();
  const [sessionType, setSessionType] = useState('behavioral');
  const [questionCount, setQuestionCount] = useState(5);
  const [source, setSource] = useState('generic');
  const [contextText, setContextText] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [startWithIntro, setStartWithIntro] = useState(true);
  const [customText, setCustomText] = useState('');
  const [customFileName, setCustomFileName] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parsedCustom = source === 'custom' ? parseQuestions(customText) : [];

  const pickQuestionFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'application/json', 'text/csv', 'text/comma-separated-values'],
    });
    if (!res.canceled && res.assets?.length) {
      try {
        const content = await readQuestionFile(res.assets[0]);
        setCustomText(content);
        setCustomFileName(res.assets[0].name);
        setError('');
      } catch {
        setError("Couldn't read that file — try a plain .txt or .json.");
      }
    }
  };

  const pickResume = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
    });
    if (!res.canceled && res.assets?.length) {
      setResumeFile(res.assets[0]);
      setError('');
    }
  };

  const start = async () => {
    const input = contextText.trim();
    if (source === 'jd' && input.length < 30)
      return setError('Paste at least a few lines of the job description.');
    if (source === 'linkedin' && !/linkedin\.com/.test(input) && input.length < 80)
      return setError('Enter your LinkedIn URL — or paste your About/Experience text.');
    if (source === 'website' && !/\w+\.\w{2,}/.test(input))
      return setError('Enter a valid website URL.');
    if (source === 'resume' && !resumeFile) return setError('Attach your resume first.');
    if (source === 'custom' && parsedCustom.length === 0)
      return setError('Upload or paste at least one question (one per line).');
    setError('');
    setLoading(true);
    try {
      // Ground the questions in the real content of the chosen source
      let ctx = input;
      if (source === 'resume') {
        ctx = await extractFromResume(resumeFile);
      } else if (source === 'website' || (source === 'linkedin' && /linkedin\.com/.test(input))) {
        ctx = await extractFromUrl(input);
      }
      // (linkedin with pasted profile text and jd use the text as-is)
      const customBank = source === 'custom' ? parsedCustom : undefined;
      const questions = await generateQuestions({
        sessionType,
        contextSource: source,
        contextText: ctx,
        customBank,
        // Unlimited sessions start with a small batch; more stream in as you answer
        count: questionCount === 'unlimited' ? 3 : questionCount,
      });
      // Icebreaker first, before the real behavioral/technical set
      if (startWithIntro) questions.unshift(makeIntroQuestion());
      navigation.navigate('HardwareCheck', {
        session: {
          sessionType,
          contextSource: source,
          contextText: ctx,
          customBank,
          questionLimit: questionCount,
          questions,
          title: sessionType === 'behavioral' ? 'Behavioral interview' : 'Technical interview',
        },
      });
    } catch (e) {
      setError(e?.message || 'Something went wrong preparing your session.');
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

        <Text style={[type.h3, styles.groupLabel]}>Interviewer voice</Text>
        <View style={styles.voiceRow}>
          <View style={[styles.segment, { flex: 1 }]}>
            {[
              { key: 'female', label: 'Female' },
              { key: 'male', label: 'Male' },
            ].map((v) => (
              <Pressable
                key={v.key}
                accessibilityRole="button"
                accessibilityState={{ selected: voiceGender === v.key }}
                onPress={() => setVoiceGender(v.key)}
                style={[styles.segmentItem, voiceGender === v.key && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, voiceGender === v.key && styles.segmentTextActive]}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Preview interviewer voice"
            onPress={() => previewVoice(voiceGender, appVolume)}
            style={styles.previewBtn}
          >
            <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
          </Pressable>
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
            label="LinkedIn profile URL — or paste your profile text"
            value={contextText}
            onChangeText={setContextText}
            placeholder={'https://linkedin.com/in/you\n…or paste your About / Experience sections here'}
            autoCapitalize="none"
            multiline
          />
        )}
        {source === 'website' && (
          <TextField
            label="Website URL"
            value={contextText}
            onChangeText={setContextText}
            placeholder="https://company.com/careers/role"
            autoCapitalize="none"
            keyboardType="url"
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
                {resumeFile ? resumeFile.name : 'Tap to attach PDF / DOCX / TXT'}
              </Text>
            </Card>
          </Pressable>
        )}

        {source === 'custom' && (
          <>
            <Pressable onPress={pickQuestionFile} accessibilityRole="button" accessibilityLabel="Upload question file">
              <Card style={styles.uploadCard}>
                <Ionicons
                  name={customFileName ? 'document-attach' : 'cloud-upload-outline'}
                  size={28}
                  color={colors.primary}
                />
                <Text style={[type.label, { marginTop: 8, color: colors.primary }]}>
                  {customFileName || 'Tap to upload .txt / .json / .csv'}
                </Text>
              </Card>
            </Pressable>
            <TextField
              label="Or paste questions (one per line)"
              value={customText}
              onChangeText={(t) => {
                setCustomText(t);
                setCustomFileName(null);
              }}
              placeholder={'Why do you want this role?\nDescribe your proudest project.'}
              multiline
            />
            {parsedCustom.length > 0 && (
              <Text style={[type.caption, { color: colors.success, marginTop: -8, marginBottom: spacing.sm }]}>
                {parsedCustom.length} question{parsedCustom.length === 1 ? '' : 's'} ready — used for your{' '}
                {sessionType} session
              </Text>
            )}
          </>
        )}

        <Card style={styles.introRow}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={type.h3}>Start with an introduction</Text>
            <Text style={type.bodySmall}>
              First question is always "Tell me about yourself" before the {sessionType} set begins.
            </Text>
          </View>
          <Switch
            value={startWithIntro}
            onValueChange={setStartWithIntro}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
            accessibilityLabel="Toggle introduction question"
          />
        </Card>

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
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  introRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.sm },
  error: { ...type.bodySmall, color: colors.danger, marginTop: 4 },
});
