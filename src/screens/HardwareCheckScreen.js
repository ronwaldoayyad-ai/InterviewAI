import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AudioModule, setAudioModeAsync } from 'expo-audio';
import { Card, PrimaryButton } from '../components/ui';
import Waveform from '../components/Waveform';
import { colors, radii, spacing, type } from '../theme';

function StatusPill({ status }) {
  const map = {
    checking: { label: 'Checking…', color: colors.warning, bg: colors.warningSoft, icon: 'time-outline' },
    ok: { label: 'Ready', color: colors.success, bg: colors.successSoft, icon: 'checkmark-circle' },
    fail: { label: 'Needs attention', color: colors.danger, bg: colors.dangerSoft, icon: 'alert-circle' },
  };
  const s = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon} size={14} color={s.color} />
      <Text style={[styles.pillText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

// Pre-session network / camera / microphone check (PRD §4.1, TDD §4.1)
export default function HardwareCheckScreen({ navigation, route }) {
  const { session } = route.params;
  const [network, setNetwork] = useState('checking');
  const [latencyMs, setLatencyMs] = useState(null);
  const [mic, setMic] = useState('checking');
  const [camera, setCamera] = useState('checking');
  const [camPermission, requestCamPermission] = useCameraPermissions();

  useEffect(() => {
    // Network: lightweight ping to measure latency ('no-cors' so the web preview works too)
    (async () => {
      try {
        const t0 = Date.now();
        await fetch('https://www.google.com/generate_204', { cache: 'no-store', mode: 'no-cors' });
        setLatencyMs(Date.now() - t0);
        setNetwork('ok');
      } catch {
        setNetwork('fail');
      }
    })();

    // Microphone permission + audio mode (native pipeline is skipped in web preview)
    (async () => {
      if (Platform.OS === 'web') {
        setMic('ok');
        return;
      }
      try {
        const res = await AudioModule.requestRecordingPermissionsAsync();
        if (res.granted) {
          await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
          setMic('ok');
        } else {
          setMic('fail');
        }
      } catch {
        setMic('fail');
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        setCamera('ok'); // web preview: skip native camera pipeline
        return;
      }
      if (!camPermission) return;
      if (camPermission.granted) {
        setCamera('ok');
      } else if (camPermission.canAskAgain) {
        const res = await requestCamPermission();
        setCamera(res.granted ? 'ok' : 'fail');
      } else {
        setCamera('fail');
      }
    })();
  }, [camPermission]);

  const allReady = network === 'ok' && mic === 'ok' && camera === 'ok';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={type.h1}>Setup check</Text>
        <Text style={[type.bodySmall, { marginTop: 6, marginBottom: spacing.lg }]}>
          Let's make sure everything works before your {session.title.toLowerCase()} starts.
        </Text>

        <Card style={styles.checkCard}>
          <View style={styles.checkHead}>
            <View style={styles.rowCenter}>
              <Ionicons name="wifi" size={20} color={colors.primary} />
              <Text style={[type.h3, { marginLeft: 10 }]}>Network</Text>
            </View>
            <StatusPill status={network} />
          </View>
          <Text style={type.bodySmall}>
            {network === 'ok'
              ? `Connection looks good — ${latencyMs} ms latency.`
              : network === 'fail'
              ? 'No connection detected. Check Wi-Fi or cellular data.'
              : 'Measuring latency…'}
          </Text>
        </Card>

        <Card style={styles.checkCard}>
          <View style={styles.checkHead}>
            <View style={styles.rowCenter}>
              <Ionicons name="mic" size={20} color={colors.primary} />
              <Text style={[type.h3, { marginLeft: 10 }]}>Microphone</Text>
            </View>
            <StatusPill status={mic} />
          </View>
          <Waveform active={mic === 'ok'} height={36} />
          <Text style={[type.bodySmall, { textAlign: 'center' }]}>
            {mic === 'ok'
              ? 'Say something — your mic is live.'
              : mic === 'fail'
              ? 'Microphone access denied. Enable it in Settings.'
              : 'Requesting microphone access…'}
          </Text>
        </Card>

        <Card style={styles.checkCard}>
          <View style={styles.checkHead}>
            <View style={styles.rowCenter}>
              <Ionicons name="videocam" size={20} color={colors.primary} />
              <Text style={[type.h3, { marginLeft: 10 }]}>Camera</Text>
            </View>
            <StatusPill status={camera} />
          </View>
          {camera === 'ok' && Platform.OS !== 'web' ? (
            <CameraView style={styles.cameraPreview} facing="front" />
          ) : (
            <View style={[styles.cameraPreview, styles.cameraPlaceholder]}>
              <Ionicons name="person-circle-outline" size={48} color={colors.textMuted} />
            </View>
          )}
        </Card>

        <PrimaryButton
          title={allReady ? 'Start interview' : 'Waiting for checks…'}
          icon="play"
          disabled={!allReady}
          onPress={() => navigation.replace('Session', { session })}
          style={{ marginTop: spacing.sm }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  checkCard: { marginBottom: spacing.md },
  checkHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  cameraPreview: { height: 180, borderRadius: radii.md, overflow: 'hidden', marginTop: 4 },
  cameraPlaceholder: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
