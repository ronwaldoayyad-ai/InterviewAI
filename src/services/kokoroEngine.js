// Bridge to the hidden WebView running Kokoro-82M (kokoro-js, WASM).
// The WebView only synthesizes (posts WAV audio back as base64); playback
// happens here through expo-audio so it uses the loudspeaker, ignores the
// iOS silent switch, and follows the in-app volume control. Kokoro is
// unavailable on web (the preview keeps expo-speech) and until the ~90MB
// model finishes its one-time download.
import { createAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { setPlaybackMode } from './audioSession';

let webview = null;
let state = { status: 'loading', progress: 0, error: null }; // loading | ready | failed
const listeners = new Set();
const pending = new Map(); // id -> { onDone, onError, volume }
let idCounter = 1;
let currentPlayer = null;
let currentSub = null;

function stopPlayback() {
  try {
    currentSub?.remove();
  } catch {}
  try {
    currentPlayer?.remove();
  } catch {}
  currentSub = null;
  currentPlayer = null;
}

function settle(id, outcome) {
  const cb = pending.get(id);
  pending.delete(id);
  if (!cb) return;
  (outcome === 'done' ? cb.onDone : cb.onError)();
}

// WAV from the WebView → cache file → native player
async function playSynthesizedAudio(id, b64) {
  const cb = pending.get(id);
  if (!cb) return; // cancelled while synthesizing
  try {
    const uri = `${FileSystem.cacheDirectory}kokoro-${id}.wav`;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
    if (!pending.has(id)) return; // cancelled while writing
    await setPlaybackMode(); // loudspeaker + plays in silent mode
    stopPlayback();
    const player = createAudioPlayer({ uri });
    currentPlayer = player;
    player.volume = Math.max(0, Math.min(1, cb.volume ?? 1));
    currentSub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        stopPlayback();
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        settle(id, 'done');
      }
    });
    player.play();
  } catch {
    settle(id, 'error');
  }
}

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function subscribeKokoro(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getKokoroState() {
  return state;
}

export function kokoroIsReady() {
  return state.status === 'ready' && !!webview;
}

export function registerKokoroWebView(ref) {
  webview = ref;
}

export function handleKokoroMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  switch (msg.type) {
    case 'progress':
      setState({ status: 'loading', progress: msg.progress || 0 });
      break;
    case 'ready':
      setState({ status: 'ready', progress: 100 });
      break;
    case 'init_error':
      setState({ status: 'failed', error: msg.message });
      break;
    case 'audio':
      playSynthesizedAudio(msg.id, msg.b64);
      break;
    case 'error':
      settle(msg.id, 'error');
      break;
  }
}

// Kokoro voice ids: af_* = American female, am_* = American male
const VOICE_FOR_GENDER = { female: 'af_heart', male: 'am_michael' };

export function kokoroSpeak(text, gender, { onDone, onError, volume = 1.0 } = {}) {
  const id = idCounter++;
  let cancelled = false;
  pending.set(id, {
    volume,
    onDone: () => !cancelled && onDone && onDone(),
    onError: () => !cancelled && onError && onError(),
  });
  const payload = JSON.stringify({
    id,
    text,
    voice: VOICE_FOR_GENDER[gender] || VOICE_FOR_GENDER.female,
  });
  try {
    webview.injectJavaScript(`window.speakText(${payload}); true;`);
  } catch {
    pending.delete(id);
    onError && onError();
  }
  return {
    cancel: () => {
      cancelled = true;
      pending.delete(id);
      stopPlayback();
      try {
        webview?.injectJavaScript('window.stopSpeaking(); true;');
      } catch {}
    },
  };
}
