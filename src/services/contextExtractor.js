// Extracts real text content from resumes (PDF/DOCX/TXT) and web pages so
// question generation can be grounded in the actual context.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import pako from 'pako';

const MAX_CHARS = 6000;

function cleanText(t) {
  return (t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
}

function base64ToBytes(b64) {
  const bin = typeof atob === 'function' ? atob(b64) : manualAtob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function manualAtob(b64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (chars.indexOf(clean[i]) << 18) |
      (chars.indexOf(clean[i + 1]) << 12) |
      ((chars.indexOf(clean[i + 2]) & 63) << 6) |
      (chars.indexOf(clean[i + 3]) & 63);
    out += String.fromCharCode((n >> 16) & 255);
    if (clean[i + 2] !== undefined) out += String.fromCharCode((n >> 8) & 255);
    if (clean[i + 3] !== undefined) out += String.fromCharCode(n & 255);
  }
  return out;
}

async function readAsBytes(asset) {
  if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    return new Uint8Array(await res.arrayBuffer());
  }
  const b64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(b64);
}

async function readAsText(asset) {
  if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    return res.text();
  }
  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
}

// PDF: inflate FlateDecode streams (pako) and pull strings out of Tj/TJ
// text-showing operators. Best-effort — works for typical text-based resumes.
function extractPdfText(bytes) {
  const raw = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  const chunks = [raw];
  const streamRe = /stream\r?\n/g;
  let m;
  while ((m = streamRe.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      const slice = bytes.subarray(start, end);
      chunks.push(pako.inflate(slice, { to: 'string' }));
    } catch {
      // stream not deflate-compressed or corrupt — skip
    }
  }
  const out = [];
  const textOp = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")|\[((?:[^\]\\]|\\.)*)\]\s*TJ/g;
  for (const chunk of chunks) {
    let t;
    while ((t = textOp.exec(chunk))) {
      const body = t[1] !== undefined ? t[1] : (t[2].match(/\(((?:[^()\\]|\\.)*)\)/g) || []).map((s) => s.slice(1, -1)).join('');
      const decoded = body
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\n/g, ' ')
        .replace(/\\\d{3}/g, ' ');
      if (/[a-zA-Z]/.test(decoded)) out.push(decoded);
    }
  }
  return out.join(' ');
}

// DOCX: it's a zip — the text lives in word/document.xml
async function extractDocxText(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('missing document.xml');
  const xml = await doc.async('string');
  return xml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;|&\w+;/g, ' ');
}

export async function extractFromResume(asset) {
  const name = (asset.name || '').toLowerCase();
  let text = '';
  try {
    if (name.endsWith('.txt') || asset.mimeType === 'text/plain') {
      text = await readAsText(asset);
    } else if (name.endsWith('.docx')) {
      text = await extractDocxText(await readAsBytes(asset));
    } else if (name.endsWith('.pdf') || asset.mimeType === 'application/pdf') {
      text = extractPdfText(await readAsBytes(asset));
    } else {
      text = await readAsText(asset);
    }
  } catch {
    text = '';
  }
  const cleaned = cleanText(text);
  // Needs enough real words to ground questions in
  if (cleaned.replace(/[^a-zA-Z]/g, '').length < 120) {
    throw new Error(
      "Couldn't read text from that file. Scanned/image PDFs aren't supported — try a text-based PDF, DOCX, or TXT export."
    );
  }
  return cleaned;
}

export async function extractFromUrl(rawUrl) {
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl.trim()}`;
  let html = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1' },
    });
    html = await res.text();
  } catch {
    throw new Error("Couldn't reach that page. Check the URL and your connection.");
  }
  if (/linkedin/i.test(url) && /authwall|join linkedin|sign in/i.test(html.slice(0, 4000))) {
    throw new Error(
      'LinkedIn blocks automated reading of profiles. Paste your profile "About" and "Experience" text into the field instead.'
    );
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;|&\w+;/g, ' ');
  const cleaned = cleanText(text);
  if (cleaned.length < 200) {
    throw new Error("That page didn't have enough readable content to build questions from.");
  }
  return cleaned;
}
