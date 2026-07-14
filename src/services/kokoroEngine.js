// Bridge to the hidden WebView running Kokoro-82M (kokoro-js).
// The WebView only synthesizes (posts WAV audio back as base64); playback
// happens here through expo-audio so it uses the loudspeaker, ignores the
// iOS silent switch, and follows the in-app volume control.
//
// Latency strategy — phone-grade synthesis is slow, so the rule is simple:
// Kokoro NEVER makes the user wait. kokoroHasAudio() tells voice.js whether
// every chunk of a text is already synthesized (memory or disk cache); if
// not, the system voice speaks instantly while prefetch warms the cache.
// Screens prefetch all upcoming questions, chunks are clause-sized so they
// synthesize fast, and results persist to disk across app restarts.
import { createAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { setPlaybackMode } from './audioSession';

const SYNTH_TIMEOUT_MS = 120000; // background prefetch can take its time
const MEM_CACHE_MAX = 24;
const DISK_CACHE_MAX = 60;
const CHUNK_MAX_CHARS = 90;
const SAMPLE_RATE = 24000; // Kokoro output

const DISK_DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}tts-cache/` : null;

let webview = null;
let state = { status: 'loading', progress: 0, backend: null, error: null }; // loading | ready | failed
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

// ——— caching (memory + disk) ———

const memCache = new Map(); // `${voice}|${chunk}` -> b64
const diskIndex = new Set(); // hashed filenames present on disk

function hashKey(key) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return `k${h.toString(36)}.wav`;
}

function memPut(key, value) {
  if (memCache.has(key)) memCache.delete(key);
  memCache.set(key, value);
  while (memCache.size > MEM_CACHE_MAX) memCache.delete(memCache.keys().next().value);
}

async function initDiskCache() {
  if (!DISK_DIR) return;
  try {
    await FileSystem.makeDirectoryAsync(DISK_DIR, { intermediates: true });
    const files = await FileSystem.readDirectoryAsync(DISK_DIR);
    files.forEach((f) => diskIndex.add(f));
    // Light cleanup so the cache doesn't grow unbounded
    if (files.length > DISK_CACHE_MAX) {
      files.slice(0, files.length - DISK_CACHE_MAX).forEach((f) => {
        diskIndex.delete(f);
        FileSystem.deleteAsync(DISK_DIR + f, { idempotent: true }).catch(() => {});
      });
    }
  } catch {}
}

function diskPut(key, b64) {
  if (!DISK_DIR) return;
  const file = hashKey(key);
  FileSystem.writeAsStringAsync(DISK_DIR + file, b64, { encoding: FileSystem.EncodingType.Base64 })
    .then(() => diskIndex.add(file))
    .catch(() => {});
}

async function diskGet(key) {
  const file = hashKey(key);
  if (!DISK_DIR || !diskIndex.has(file)) return null;
  try {
    return await FileSystem.readAsStringAsync(DISK_DIR + file, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    diskIndex.delete(file);
    return null;
  }
}

// ——— text chunking: sentences, long ones split at clause boundaries ———

function splitForSynthesis(text) {
  const sentences = ((text || '').match(/[^.!?]+[.!?]*/g) || [text]).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  for (const sentence of sentences) {
    if (sentence.length <= CHUNK_MAX_CHARS) {
      chunks.push(sentence);
      continue;
    }
    let current = '';
    for (const part of sentence.split(/,\s+/)) {
      const candidate = current ? `${current}, ${part}` : part;
      if (candidate.length > CHUNK_MAX_CHARS && current) {
        chunks.push(`${current},`);
        current = part;
      } else {
        current = candidate;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks.filter((c) => c.length > 1);
}

const VOICE_FOR_GENDER = { female: 'af_heart', male: 'am_michael' };
const voiceFor = (gender) => VOICE_FOR_GENDER[gender] || VOICE_FOR_GENDER.female;

// True only when EVERY chunk is already synthesized — the gate that keeps
// Kokoro from ever adding latency
export function kokoroHasAudio(text, gender) {
  if (!kokoroIsReady()) return false;
  const voice = voiceFor(gender);
  return splitForSynthesis(text).every((chunk) => {
    const key = `${voice}|${chunk}`;
    return memCache.has(key) || diskIndex.has(hashKey(key));
  });
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
      initDiskCache().finally(() => setState({ status: 'ready', progress: 100, backend: msg.backend || 'wasm' }));
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

// Rolling synthesis-speed stats power the "time left" estimate
let synthMsTotal = 0;
let synthCharsTotal = 0;

function estimateSynthMs(chars) {
  if (!synthCharsTotal || chars <= 0) return null;
  return (synthMsTotal / synthCharsTotal) * chars;
}

function requestSynthesis(text, voice) {
  return new Promise((resolve, reject) => {
    if (!webview) return reject(new Error('kokoro not mounted'));
    const id = idCounter++;
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      synthWaiters.delete(id);
      reject(new Error('synthesis timed out'));
    }, SYNTH_TIMEOUT_MS);
    synthWaiters.set(id, {
      resolve: (b64) => {
        synthMsTotal += Date.now() - startedAt;
        synthCharsTotal += text.length;
        resolve(b64);
      },
      reject,
      timer,
    });
    try {
      webview.injectJavaScript(`window.speakText(${JSON.stringify({ id, text, voice })}); true;`);
    } catch (e) {
      clearTimeout(timer);
      synthWaiters.delete(id);
      reject(e);
    }
  });
}

// Serialize synth requests; dedupe in-flight chunks
let synthChain = Promise.resolve();
const inFlight = new Map(); // key -> Promise<b64>

function getAudio(voice, chunk) {
  const key = `${voice}|${chunk}`;
  if (memCache.has(key)) return Promise.resolve(memCache.get(key));
  if (inFlight.has(key)) return inFlight.get(key);
  const job = (async () => {
    const fromDisk = await diskGet(key);
    if (fromDisk) {
      memPut(key, fromDisk);
      return fromDisk;
    }
    const run = () => requestSynthesis(chunk, voice);
    const chained = synthChain.then(run, run);
    synthChain = chained.then(
      () => {},
      () => {}
    );
    const b64 = await chained;
    memPut(key, b64);
    diskPut(key, b64);
    return b64;
  })();
  inFlight.set(key, job);
  job.finally(() => inFlight.delete(key));
  return job;
}

// Warm the cache for text that will be spoken soon (fire-and-forget)
export function kokoroPrefetch(text, gender) {
  if (!kokoroIsReady() || !text) return;
  const voice = voiceFor(gender);
  splitForSynthesis(text).forEach((chunk) => getAudio(voice, chunk).catch(() => {}));
}

// Synthesize a set of texts with progress + ETA reporting — used by the
// pre-session gate so the whole interview is neural-voice-ready up front.
// onProgress({ done, total, etaMs, complete }); etaMs null until measured.
export function kokoroPrepare(texts, gender, onProgress) {
  const voice = voiceFor(gender);
  const chunks = [];
  const seen = new Set();
  (texts || []).forEach((t) =>
    splitForSynthesis(t).forEach((c) => {
      const key = `${voice}|${c}`;
      if (!seen.has(key)) {
        seen.add(key);
        chunks.push(c);
      }
    })
  );
  const total = chunks.length;
  let cancelled = false;
  let done = 0;
  let remainingChars = 0;

  const report = (complete) => {
    if (!cancelled && onProgress) {
      onProgress({ done, total, etaMs: complete ? 0 : estimateSynthMs(remainingChars), complete: !!complete });
    }
  };

  (async () => {
    const toDo = [];
    for (const c of chunks) {
      const key = `${voice}|${c}`;
      if (memCache.has(key) || diskIndex.has(hashKey(key))) done++;
      else {
        toDo.push(c);
        remainingChars += c.length;
      }
    }
    if (toDo.length === 0) {
      report(true);
      return;
    }
    report(false);
    const settle = (c) => {
      done++;
      remainingChars -= c.length;
      report(done >= total);
    };
    await Promise.all(toDo.map((c) => getAudio(voice, c).then(() => settle(c), () => settle(c))));
  })();

  return {
    cancel: () => {
      cancelled = true;
    },
  };
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
      const uri = `${FileSystem.cacheDirectory}kokoro-play-${idCounter++}.wav`;
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

// Callers must check kokoroHasAudio() first — every chunk plays from cache
export function kokoroSpeak(text, gender, { onDone, onError, volume = 1.0 } = {}) {
  const voice = voiceFor(gender);
  let aborted = false;

  (async () => {
    try {
      const chunks = splitForSynthesis(text);
      for (let i = 0; i < chunks.length; i++) {
        if (aborted) return;
        const b64 = await getAudio(voice, chunks[i]);
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
