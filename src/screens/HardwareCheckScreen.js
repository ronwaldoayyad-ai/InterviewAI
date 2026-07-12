import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Card, PrimaryButton } from '../components/ui';
import Waveform from '../components/Waveform';
import { colors, fonts, radii, spacing, type } from '../theme';

function StatusPill({ status }) {
  const map = {
    checking: { label: 'Checking…', color: colors.warning, bg: colors.warningSoft, icon: 'time-outline' },
    ok: { label: 'Ready', color: colors.success, bg: colors.successSoft, icon: 'checkmark-circle' },
    off: { label: 'Off', color: colors.textMuted, bg: colors.background, icon: 'remove-circle-outline' },
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
// with mic mute + input selection and camera on/off + facing (enhancement #2)
export default function HardwareCheckScreen({ navigation, route }) {
  const { session } = route.params;
  const [network, setNetwork] = useState('checking');
  const [latencyMs, setLatencyMs] = useState(null);
  const [mic, setMic] = useState('checking');
  const [micMuted, setMicMuted] = useState(false);
  const [micInputs, setMicInputs] = useState([]);
  const [micInputUid, setMicInputUid] = useState(null);
  const [camera, setCamera] = useState('checking');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [facing, setFacing] = useState('front');
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const probeRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

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

    // Microphone permission + audio mode + available input sources
    (async () => {
      if (Platform.OS === 'web') {
        setMic('ok');
        return;
      }
      try {
        const res = await AudioModule.requestRecordingPermissionsAsync();
        if (!res.granted) {
          setMic('fail');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        setMic('ok');
        try {
          const inputs = await probeRecorder.getAvailableInputs();
          setMicInputs(inputs || []);
          const current = await probeRecorder.getCurrentInput();
          if (current?.uid) setMicInputUid(current.uid);
        } catch {
          // input enumeration not supported on this device — mic still works
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

  const selectInput = async (uid) => {
    Haptics.selectionAsync();
    setMicInputUid(uid);
    try {
      await probeRecorder.setInput(uid);
    } catch {
      // keep the selection; the session recorder applies it again
    }
  };

  // Camera turned off counts as ready — the interview is audio-first
  const cameraReady = camera === 'ok' || !cameraEnabled;
  const allReady = network === 'ok' && mic === 'ok' && cameraReady;

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
            <StatusPill status={mic === 'ok' && micMuted ? 'off' : mic} />
          </View>
          <Waveform active={mic === 'ok' && !micMuted} height={36} />
          <Text style={[type.bodySmall, { textAlign: 'center', marginBottom: spacing.sm }]}>
            {mic === 'fail'
              ? 'Microphone access denied. Enable it in Settings.'
              : mic === 'checking'
              ? 'Requesting microphone access…'
              : micMuted
              ? 'Microphone muted.'
              : 'Say something — your mic is live.'}
          </Text>
          {mic === 'ok' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={micMuted ? 'Unmute microphone' : 'Mute microphone'}
              onPress={() => {
                Haptics.selectionAsync();
                setMicMuted((m) => !m);
              }}
              style={[styles.toggleBtn, micMuted && styles.toggleBtnOff]}
            >
              <Ionicons name={micMuted ? 'mic-off' : 'mic'} size={18} color={micMuted ? colors.textSecondary : colors.primary} />
              <Text style={[styles.toggleText, micMuted && { color: colors.textSecondary }]}>
                {micMuted ? 'Unmute' : 'Mute'}
              </Text>
            </Pressable>
          )}
          {micInputs.length > 1 && (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={[type.caption, { marginBottom: 6 }]}>INPUT SOURCE</Text>
              {micInputs.map((input) => (
                <Pressable
                  key={input.uid}
                  accessibilityRole="button"
                  accessibilityState={{ selected: micInputUid === input.uid }}
                  onPress={() => selectInput(input.uid)}
                  style={styles.sourceRow}
                >
                  <Ionicons
                    name={micInputUid === input.uid ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={micInputUid === input.uid ? colors.primary : colors.textMuted}
                  />
                  <Text style={[type.bodySmall, { marginLeft: 8, flex: 1 }]}>{input.name || input.type || input.uid}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </Card>

        <Card style={styles.checkCard}>
          <View style={styles.checkHead}>
            <View style={styles.rowCenter}>
              <Ionicons name="videocam" size={20} color={colors.primary} />
              <Text style={[type.h3, { marginLeft: 10 }]}>Camera</Text>
            </View>
            <StatusPill status={cameraEnabled ? camera : 'off'} />
          </View>
          <View style={[styles.rowCenter, { justifyContent: 'space-between', marginBottom: spacing.sm }]}>
            <Text style={type.bodySmall}>Use camera</Text>
            <Switch
              value={cameraEnabled}
              onValueChange={(v) => {
                Haptics.selectionAsync();
                setCameraEnabled(v);
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
              accessibilityLabel="Toggle camera"
            />
          </View>
          {cameraEnabled && camera === 'ok' && Platform.OS !== 'web' ? (
            <CameraView style={styles.cameraPreview} facing={facing} />
          ) : (
            <View style={[styles.cameraPreview, styles.cameraPlaceholder]}>
              <Ionicons
                name={cameraEnabled ? 'person-circle-outline' : 'videocam-off-outline'}
                size={48}
                color={colors.textMuted}
              />
              {!cameraEnabled && <Text style={[type.caption, { marginTop: 4 }]}>Camera off</Text>}
            </View>
          )}
          {cameraEnabled && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch camera source"
              onPress={() => {
                Haptics.selectionAsync();
                setFacing((f) => (f === 'front' ? 'back' : 'front'));
              }}
              style={[styles.toggleBtn, { marginTop: spacing.sm }]}
            >
              <Ionicons name="camera-reverse-outline" size={18} color={colors.primary} />
              <Text style={styles.toggleText}>
                {facing === 'front' ? 'Front camera' : 'Back camera'} — tap to switch
              </Text>
            </Pressable>
          )}
        </Card>

        <PrimaryButton
          title={allReady ? 'Start interview' : 'Waiting for checks…'}
          icon="play"
          disabled={!allReady}
          onPress={() =>
            navigation.replace('Session', {
              session: { ...session, micInputUid, cameraEnabled, cameraFacing: facing },
            })
          }
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
  pillText: { fontSize: 12, fontFamily: fonts.semibold },
  cameraPreview: { height: 180, borderRadius: radii.md, overflow: 'hidden', marginTop: 4 },
  cameraPlaceholder: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    alignSelf: 'stretch',
  },
  toggleBtnOff: { borderColor: colors.border, backgroundColor: colors.background },
  toggleText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  sourceRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
});
