// Bridge to the hidden WebView running Kokoro-82M (kokoro-js, WASM).
// The WebView only synthesizes (posts WAV audio back as base64); playback
// happens here through expo-audio so it uses the loudspeaker, ignores the
// iOS silent switch, and follows the in-app volume control.
//
// Latency strategy:
//  - sentence pipeline: play sentence 1 while later sentences synthesize
//  - prefetch cache: screens pre-synthesize upcoming questions so playback
//    starts the moment the text appears
//  - first-audio timeout: if nothing is ready within budget (slow devices),
//    reject so voice.js falls back to the system voice instead of silence
import { createAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { setPlaybackMode } from './audioSession';

const FIRST_AUDIO_TIMEOUT_MS = 12000;
const SYNTH_TIMEOUT_MS = 45000;
const CACHE_MAX = 16;
const SAMPLE_RATE = 24000; // Kokoro output

let webview = null;
let state = { status: 'loading', progress: 0, error: null }; // loading | ready | failed
const listeners = new Set();
let idCounter = 1;

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

// ——— synthesis plumbing (one request at a time through the WebView) ———

const synthWaiters = new Map(); // id -> { resolve, reject, timer }

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
    case 'error': {
      const w = synthWaiters.get(msg.id);
      if (!w) return;
      synthWaiters.delete(msg.id);
      clearTimeout(w.timer);
      if (msg.type === 'audio') w.resolve(msg.b64);
      else w.reject(new Error(msg.message || 'synthesis failed'));
      break;
    }
  }
}

function requestSynthesis(text, voice) {
  return new Promise((resolve, reject) => {
    if (!webview) return reject(new Error('kokoro not mounted'));
    const id = idCounter++;
    const timer = setTimeout(() => {
      synthWaiters.delete(id);
      reject(new Error('synthesis timed out'));
    }, SYNTH_TIMEOUT_MS);
    synthWaiters.set(id, { resolve, reject, timer });
    try {
      webview.injectJavaScript(`window.speakText(${JSON.stringify({ id, text, voice })}); true;`);
    } catch (e) {
      clearTimeout(timer);
      synthWaiters.delete(id);
      reject(e);
    }
  });
}

// Serialize synth requests; cache results so repeats are instant
let synthChain = Promise.resolve();
const audioCache = new Map(); // `${voice}|${sentence}` -> b64

function cachePut(key, value) {
  if (audioCache.has(key)) audioCache.delete(key);
  audioCache.set(key, value);
  while (audioCache.size > CACHE_MAX) audioCache.delete(audioCache.keys().next().value);
}

function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]*/g) || [text]).map((s) => s.trim()).filter(Boolean);
}

function getAudio(voice, sentence) {
  const key = `${voice}|${sentence}`;
  if (audioCache.has(key)) return Promise.resolve(audioCache.get(key));
  const run = () => requestSynthesis(sentence, voice);
  const job = synthChain.then(run, run);
  synthChain = job.then(
    () => {},
    () => {}
  );
  return job.then((b64) => {
    cachePut(key, b64);
    return b64;
  });
}

const VOICE_FOR_GENDER = { female: 'af_heart', male: 'am_michael' };

// Warm the cache for text that's about to be spoken (fire-and-forget)
export function kokoroPrefetch(text, gender) {
  if (!kokoroIsReady() || !text) return;
  const voice = VOICE_FOR_GENDER[gender] || VOICE_FOR_GENDER.female;
  splitSentences(text).forEach((s) => getAudio(voice, s).catch(() => {}));
}

// ——— native playback ———

let currentPlayer = null;

function stopPlayback() {
  const p = currentPlayer;
  currentPlayer = null;
  if (p) {
    try {
      p.sub?.remove();
    } catch {}
    try {
      p.player.remove();
    } catch {}
  }
}

function playB64(b64, volume) {
  return new Promise((resolve, reject) => {
    (async () => {
      const uri = `${FileSystem.cacheDirectory}kokoro-${idCounter++}.wav`;
      try {
        await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
        await setPlaybackMode(); // loudspeaker + plays in silent mode
        stopPlayback();
        const player = createAudioPlayer({ uri });
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          stopPlayback();
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
          ok ? resolve() : reject(new Error('playback failed'));
        };
        // Guard in case didJustFinish never fires: wav duration + 3s
        const durationMs = Math.max(1200, (((b64.length * 3) / 4 - 44) / 2 / SAMPLE_RATE) * 1000);
        const guard = setTimeout(() => finish(true), durationMs + 3000);
        const sub = player.addListener('playbackStatusUpdate', (st) => {
          if (st.didJustFinish) finish(true);
        });
        currentPlayer = { player, sub };
        player.volume = Math.max(0, Math.min(1, volume ?? 1));
        player.play();
      } catch (e) {
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        reject(e);
      }
    })();
  });
}

export function kokoroSpeak(text, gender, { onDone, onError, volume = 1.0 } = {}) {
  const voice = VOICE_FOR_GENDER[gender] || VOICE_FOR_GENDER.female;
  let aborted = false;

  (async () => {
    try {
      const sentences = splitSentences(text);
      // Queue every sentence now — later ones synthesize while earlier ones play
      const jobs = sentences.map((s) => getAudio(voice, s));
      // If the first chunk isn't ready in time, hand off to the system voice
      const first = await Promise.race([
        jobs[0],
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('first-audio timeout')), FIRST_AUDIO_TIMEOUT_MS)
        ),
      ]);
      if (aborted) return;
      await playB64(first, volume);
      for (let i = 1; i < sentences.length; i++) {
        if (aborted) return;
        const b64 = await jobs[i];
        if (aborted) return;
        await playB64(b64, volume);
      }
      if (!aborted) onDone && onDone();
    } catch {
      if (!aborted) {
        stopPlayback();
        onError && onError();
      }
    }
  })();

  return {
    cancel: () => {
      aborted = true;
      stopPlayback();
    },
  };
}
