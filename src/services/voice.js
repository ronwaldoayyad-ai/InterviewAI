// Interviewer voice: picks the most natural-sounding male/female TTS voice
// the device offers, and speaks sentence-by-sentence with human-like pauses.
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { setPlaybackMode } from './audioSession';
import { kokoroIsReady, kokoroPrefetch, kokoroSpeak } from './kokoroEngine';

// Pre-synthesize upcoming text so playback starts instantly when shown
export function prefetchSpeech(text, gender) {
  if (kokoroIsReady()) kokoroPrefetch(text, gender);
}

// Known first names of platform voices (iOS/macOS + common web voices)
const FEMALE_NAMES = [
  'samantha', 'ava', 'allison', 'susan', 'zoe', 'zoey', 'nicky', 'karen', 'moira',
  'tessa', 'martha', 'kate', 'serena', 'fiona', 'veena', 'joanna', 'salli', 'kendra',
  'kimberly', 'ivy', 'emma', 'amy', 'olivia', 'aria', 'jenny', 'michelle', 'sonia', 'natasha',
];
const MALE_NAMES = [
  'alex', 'aaron', 'fred', 'tom', 'daniel', 'oliver', 'gordon', 'rishi', 'evan',
  'nathan', 'reed', 'matthew', 'joey', 'justin', 'brian', 'russell', 'guy', 'ryan',
  'william', 'james', 'eric', 'christopher',
];
// Google TTS variant codes embedded in Android voice identifiers
const FEMALE_CODES = ['tpf', 'sfg', 'iob', 'tpc', 'aua', 'aue'];
const MALE_CODES = ['tpd', 'iol', 'iom', 'sfb', 'aud', 'auc'];

function classifyGender(v) {
  const id = (v.identifier || '').toLowerCase();
  const name = (v.name || '').toLowerCase();
  const hay = `${id} ${name}`;
  if (hay.includes('female')) return 'female';
  if (/(^|[^e])male/.test(hay)) return 'male';
  if (FEMALE_NAMES.some((n) => name.startsWith(n) || id.includes(`.${n}`))) return 'female';
  if (MALE_NAMES.some((n) => name.startsWith(n) || id.includes(`.${n}`))) return 'male';
  if (FEMALE_CODES.some((c) => id.includes(`-${c}-`) || id.includes(`-${c}#`) || id.endsWith(`-${c}`))) return 'female';
  if (MALE_CODES.some((c) => id.includes(`-${c}-`) || id.includes(`-${c}#`) || id.endsWith(`-${c}`))) return 'male';
  return null;
}

// Higher = more natural. Platform "Enhanced"/"Premium" voices beat default ones.
function naturalness(v) {
  const id = (v.identifier || '').toLowerCase();
  const name = (v.name || '').toLowerCase();
  let score = 0;
  if (v.quality === Speech.VoiceQuality.Enhanced) score += 100;
  if (/premium|enhanced|natural|neural/.test(`${id} ${name}`)) score += 50;
  if ((v.language || '').toLowerCase() === 'en-us') score += 10;
  if (id.includes('siri')) score += 25;
  if (id.includes('eloquence')) score -= 60; // iOS robotic legacy voices
  if (/compact/.test(id)) score -= 30;
  return score;
}

let catalogPromise = null;

async function getCatalog() {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      let voices = [];
      try {
        voices = (await Speech.getAvailableVoicesAsync()) || [];
      } catch {
        voices = [];
      }
      const english = voices.filter((v) => (v.language || '').toLowerCase().startsWith('en'));
      const byGender = { female: [], male: [] };
      english.forEach((v) => {
        const g = classifyGender(v);
        if (g) byGender[g].push(v);
      });
      byGender.female.sort((a, b) => naturalness(b) - naturalness(a));
      byGender.male.sort((a, b) => naturalness(b) - naturalness(a));
      return byGender;
    })();
  }
  return catalogPromise;
}

// Resolve voice + prosody for a gender. When no matching voice exists on the
// device, fall back to the default voice with a pitch shift approximation.
async function resolveVoice(gender) {
  const catalog = await getCatalog();
  const voice = catalog[gender]?.[0];
  if (voice) {
    return { voice: voice.identifier, pitch: 1.0, rate: 0.96 };
  }
  return { voice: undefined, pitch: gender === 'male' ? 0.78 : 1.06, rate: 0.94 };
}

function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]*/g) || [text]).map((s) => s.trim()).filter(Boolean);
}

const canSpeak = () =>
  Platform.OS !== 'web' || (typeof window !== 'undefined' && !!window.speechSynthesis);

// Speaks text sentence-by-sentence with short pauses between sentences, which
// sounds far less robotic than one monotone run. Returns a cancellable handle.
export function speakText(text, gender, { onDone, onError, volume = 1.0 } = {}) {
  // Prefer the Kokoro-82M neural voice when its model is loaded (native only);
  // if synthesis fails mid-flight, retry the same text with the system voice.
  if (kokoroIsReady()) {
    let fallbackHandle = null;
    const kokoroHandle = kokoroSpeak(text, gender, {
      volume,
      onDone,
      onError: () => {
        fallbackHandle = speakWithSystemVoice(text, gender, { onDone, onError, volume });
      },
    });
    return {
      cancel: () => {
        kokoroHandle.cancel();
        fallbackHandle?.cancel();
      },
    };
  }
  return speakWithSystemVoice(text, gender, { onDone, onError, volume });
}

// Platform TTS (expo-speech) — fallback engine and the web-preview path
function speakWithSystemVoice(text, gender, { onDone, onError, volume = 1.0 } = {}) {
  let cancelled = false;
  const handle = {
    cancel: () => {
      cancelled = true;
      try {
        Speech.stop();
      } catch {}
    },
  };

  (async () => {
    if (!canSpeak()) {
      setTimeout(() => !cancelled && onDone && onDone(), 1000);
      return;
    }
    // Route through the loudspeaker (fixes quiet earpiece playback on iOS)
    await setPlaybackMode();
    const { voice, pitch, rate } = await resolveVoice(gender);
    if (cancelled) return;
    const sentences = splitSentences(text);
    let i = 0;
    const next = () => {
      if (cancelled) return;
      if (i >= sentences.length) {
        onDone && onDone();
        return;
      }
      const sentence = sentences[i++];
      // Slightly longer breath before the final sentence lands more naturally
      const gap = i === sentences.length ? 350 : 250;
      try {
        Speech.speak(sentence, {
          voice,
          pitch,
          rate,
          volume, // applies on web; native follows system volume
          onDone: () => setTimeout(next, gap),
          onError: () => {
            onError && onError();
            onDone && onDone();
          },
        });
      } catch {
        onDone && onDone();
      }
    };
    next();
  })();

  return handle;
}

export function previewVoice(gender, volume = 1.0) {
  return speakText(
    "Hi, I'm your interviewer today. Take a breath, and let's begin when you're ready.",
    gender,
    { volume }
  );
}
