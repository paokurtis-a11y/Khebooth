import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { EventManifestContract } from '@khe/contracts';

const TOKEN_KEY = 'khe.capture.station-token';
const AES_KEY = 'khe.capture.manifest-aes-key';
const MANIFEST_FILENAME = 'khe-capture-manifest.enc';

function manifestFile() {
  return new File(Paths.document, MANIFEST_FILENAME);
}

async function getOrCreateEncryptionKey() {
  const stored = await SecureStore.getItemAsync(AES_KEY);
  if (stored) return AESEncryptionKey.import(stored, 'hex');

  const key = await AESEncryptionKey.generate();
  await SecureStore.setItemAsync(AES_KEY, await key.encoded('hex'));
  return key;
}

export async function saveStationSession(stationToken: string, manifest: EventManifestContract) {
  const key = await getOrCreateEncryptionKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(manifest));
  const sealed = await aesEncryptAsync(plaintext, key);
  const encrypted = await sealed.combined();
  const file = manifestFile();
  file.create({ overwrite: true, intermediates: true });
  file.write(encrypted);
  await SecureStore.setItemAsync(TOKEN_KEY, stationToken);
}

export async function loadStationToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function loadCachedManifest(): Promise<EventManifestContract | null> {
  const keyHex = await SecureStore.getItemAsync(AES_KEY);
  const file = manifestFile();
  if (!keyHex || !file.exists) return null;

  const key = await AESEncryptionKey.import(keyHex, 'hex');
  const encrypted = await file.bytes();
  const sealed = AESSealedData.fromCombined(encrypted);
  const plaintext = await aesDecryptAsync(sealed, key);
  return JSON.parse(new TextDecoder().decode(plaintext)) as EventManifestContract;
}

export async function clearStationSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(AES_KEY);
  const file = manifestFile();
  if (file.exists) file.delete();
}
