// Persists the user's Anthropic API key on-device.
// Native: iOS Keychain / Android Keystore via expo-secure-store.
// Web preview: localStorage (dev convenience only).
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'anthropic_api_key';

export async function loadApiKey() {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    }
    return await SecureStore.getItemAsync(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function saveApiKey(value) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, value);
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, value);
  } catch {
    // storage unavailable — key stays in memory for this session only
  }
}

export async function clearApiKey() {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch {}
}
