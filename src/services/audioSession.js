// iOS routes audio to the quiet earpiece whenever the session allows
// recording (PlayAndRecord category). Keeping the app in playback mode except
// while actually recording makes TTS play through the loudspeaker at full
// system volume — this is the fix for "iOS is too soft".
import { setAudioModeAsync } from 'expo-audio';

export async function setPlaybackMode() {
  try {
    await setAudioModeAsync({
      allowsRecording: false, // iOS: Playback category → loudspeaker
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false, // Android: never use the earpiece
    });
  } catch {
    // web / unsupported — playback works regardless
  }
}

export async function setRecordingMode() {
  try {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
  } catch {}
}
