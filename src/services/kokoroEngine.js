// Bridge to the hidden WebView running Kokoro-82M (kokoro-js, WASM).
// The WebView synthesizes speech on-device and plays it; this module is the
// RN-side controller. Kokoro is unavailable on web (the preview keeps
// expo-speech) and until the ~90MB model finishes its one-time download.

let webview = null;
let state = { status: 'loading', progress: 0, error: null }; // loading | ready | failed
const listeners = new Set();
const pending = new Map(); // id -> { onDone, onError }
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
    case 'done':
    case 'error': {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      if (cb) (msg.type === 'done' ? cb.onDone : cb.onError)();
      break;
    }
  }
}

// Kokoro voice ids: af_* = American female, am_* = American male
const VOICE_FOR_GENDER = { female: 'af_heart', male: 'am_michael' };

export function kokoroSpeak(text, gender, { onDone, onError, volume = 1.0 } = {}) {
  const id = idCounter++;
  let cancelled = false;
  pending.set(id, {
    onDone: () => !cancelled && onDone && onDone(),
    onError: () => !cancelled && onError && onError(),
  });
  const payload = JSON.stringify({
    id,
    text,
    voice: VOICE_FOR_GENDER[gender] || VOICE_FOR_GENDER.female,
    volume,
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
      try {
        webview?.injectJavaScript('window.stopSpeaking(); true;');
      } catch {}
    },
  };
}
