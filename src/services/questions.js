// Parsing for user-uploaded question sets (.txt, .json, .csv, or pasted text).
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Read the picked document's text content (DocumentPicker asset)
export async function readQuestionFile(asset) {
  if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    return res.text();
  }
  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
}

// Strip list decorations like "1.", "Q3:", "-", "*", "•"
function cleanLine(line) {
  return line
    .replace(/^\s*(?:[-*•]|\d+[.)]|[Qq]\d*[.:)]?)\s*/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

// Accepts: JSON array of strings, JSON array of {question|text, focus},
// or plain text with one question per line (CSV-ish lines work too).
export function parseQuestions(raw) {
  const text = (raw || '').trim();
  if (!text) return [];

  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      return data
        .map((item) => {
          if (typeof item === 'string') return { text: item.trim(), focus: null };
          if (item && typeof item === 'object') {
            const q = (item.question || item.text || '').trim();
            return q ? { text: q, focus: item.focus || item.expectedFocus || null } : null;
          }
          return null;
        })
        .filter((q) => q && q.text.length >= 8);
    }
  } catch {
    // not JSON — fall through to line parsing
  }

  return text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((l) => l.length >= 8)
    .map((l) => ({ text: l, focus: null }));
}
