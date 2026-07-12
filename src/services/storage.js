// Local persistence & export of session transcripts + audio (enhancement #5).
// Android: user picks any folder via Storage Access Framework.
// iOS: exports go through the share sheet (user picks a location in Files).
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const RECORDINGS_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}recordings/`
  : null;

// Copy a finished recording out of the tmp cache so it survives and can be exported
export async function persistRecording(uri, filename) {
  if (!uri || !RECORDINGS_DIR || Platform.OS === 'web') return uri;
  try {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
    const dest = `${RECORDINGS_DIR}${filename}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

// Android only: let the user pick the folder where sessions get saved
export async function pickStorageDirectory() {
  if (Platform.OS !== 'android') return null;
  const res = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  return res.granted ? res.directoryUri : null;
}

export function describeStorageDir(dirUri) {
  if (!dirUri) return null;
  // SAF URIs end with an encoded path like primary%3ADownload%2FInterviewAI
  try {
    const tail = dirUri.split('/').pop() || '';
    return decodeURIComponent(tail).replace(/^primary:/, '');
  } catch {
    return dirUri;
  }
}

function sessionToJson(session) {
  return JSON.stringify(
    {
      title: session.title,
      sessionType: session.sessionType,
      completedAt: session.completedAt,
      summary: session.summary,
      answers: session.answers.map((a, i) => ({
        question: a.question.questionText,
        expectedFocus: a.question.expectedFocus,
        durationSec: a.durationSec,
        audioFile: a.audioUri ? `answer-${i + 1}.m4a` : null,
        transcript: a.analysis.transcript,
        strengths: a.analysis.strengths,
        improvements: a.analysis.improvements,
        tips: a.analysis.tips,
        pacingScore: a.analysis.pacingScore,
        starScores: a.analysis.starScores,
      })),
    },
    null,
    2
  );
}

function stamp(session) {
  return (session.completedAt || new Date().toISOString()).slice(0, 19).replace(/[:T]/g, '-');
}

// Saves transcript JSON + audio files. Returns a human-readable result message.
export async function exportSession(session, dirUri) {
  const json = sessionToJson(session);
  const base = `InterviewAI-${stamp(session)}`;

  if (Platform.OS === 'android' && dirUri) {
    const SAF = FileSystem.StorageAccessFramework;
    const jsonFile = await SAF.createFileAsync(dirUri, `${base}.json`, 'application/json');
    await FileSystem.writeAsStringAsync(jsonFile, json, { encoding: FileSystem.EncodingType.UTF8 });
    let audioCount = 0;
    for (let i = 0; i < session.answers.length; i++) {
      const a = session.answers[i];
      if (!a.audioUri) continue;
      try {
        const b64 = await FileSystem.readAsStringAsync(a.audioUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const audioFile = await SAF.createFileAsync(dirUri, `${base}-answer-${i + 1}.m4a`, 'audio/mp4');
        await FileSystem.writeAsStringAsync(audioFile, b64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        audioCount++;
      } catch {
        // skip unreadable audio, keep exporting the rest
      }
    }
    return `Saved transcript + ${audioCount} audio file${audioCount === 1 ? '' : 's'}`;
  }

  if (Platform.OS === 'web') {
    // Web preview: download the JSON transcript
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${base}.json`;
    a.click();
    return 'Transcript downloaded';
  }

  // iOS (and Android without a folder set): share sheet
  const fileUri = `${FileSystem.cacheDirectory}${base}.json`;
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Save session transcript' });
    return 'Shared — audio recordings stay in the app library';
  }
  return 'Sharing unavailable on this device';
}
