import React, { useRef } from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { handleKokoroMessage, registerKokoroWebView } from '../services/kokoroEngine';

// Hidden WebView hosting Kokoro-82M via kokoro-js (github.com/hexgrad/kokoro).
// The model (~90MB, q8 ONNX) downloads once from the Hugging Face CDN and is
// cached by the WebView; synthesis + playback happen inside the page.
const PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script type="module">
  const post = (m) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  let tts = null;
  let audio = null;
  let currentId = null;

  // Float32 PCM -> WAV, so playback works regardless of kokoro-js version APIs
  function toWav(samples, sampleRate) {
    const buf = new ArrayBuffer(44 + samples.length * 2);
    const v = new DataView(buf);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); ws(8, 'WAVE');
    ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  window.stopSpeaking = () => {
    currentId = null;
    if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
  };

  window.speakText = async ({ id, text, voice, volume }) => {
    if (!tts) { post({ type: 'error', id, message: 'not ready' }); return; }
    window.stopSpeaking();
    currentId = id;
    try {
      const out = await tts.generate(text, { voice });
      if (currentId !== id) return; // cancelled while synthesizing
      const blob = typeof out.toBlob === 'function' ? out.toBlob() : toWav(out.audio, out.sampling_rate);
      const url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, volume ?? 1));
      audio.onended = () => { URL.revokeObjectURL(url); if (currentId === id) post({ type: 'done', id }); };
      audio.onerror = () => { URL.revokeObjectURL(url); if (currentId === id) post({ type: 'error', id, message: 'playback' }); };
      await audio.play();
    } catch (e) {
      if (currentId === id) post({ type: 'error', id, message: String(e && e.message || e) });
    }
  };

  try {
    const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm');
    let lastPct = -1;
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p) => {
        if (p.status === 'progress' && p.total) {
          const pct = Math.round((p.loaded / p.total) * 100);
          if (pct !== lastPct) { lastPct = pct; post({ type: 'progress', progress: pct }); }
        }
      },
    });
    post({ type: 'ready' });
  } catch (e) {
    post({ type: 'init_error', message: String(e && e.message || e) });
  }
</script></body></html>`;

export default function KokoroTTS() {
  const ref = useRef(null);
  if (Platform.OS === 'web') return null; // web preview keeps expo-speech

  return (
    <View style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }} pointerEvents="none">
      <WebView
        ref={(r) => {
          ref.current = r;
          registerKokoroWebView(r);
        }}
        source={{ html: PAGE, baseUrl: 'https://kokoro-tts.local' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        onMessage={(e) => handleKokoroMessage(e.nativeEvent.data)}
      />
    </View>
  );
}
