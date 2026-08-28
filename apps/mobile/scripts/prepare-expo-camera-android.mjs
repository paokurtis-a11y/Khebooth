import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function findCameraRoot() {
  const candidates = [
    path.join(process.cwd(), 'node_modules', 'expo-camera'),
    path.join(process.cwd(), '..', '..', 'node_modules', 'expo-camera'),
  ];
  return candidates.find((candidate) => existsSync(path.join(candidate, 'package.json'))) ?? null;
}

const cameraRoot = findCameraRoot();
if (!cameraRoot) throw new Error('expo-camera is installed but its package root could not be resolved.');

const cameraView = path.join(cameraRoot, 'android', 'src', 'main', 'java', 'expo', 'modules', 'camera', 'ExpoCameraView.kt');
if (!existsSync(cameraView)) throw new Error(`Expo Camera Android source is missing: ${cameraView}`);

const source = readFileSync(cameraView, 'utf8');
if (source.includes('implementationMode = PreviewView.ImplementationMode.COMPATIBLE')) {
  console.log('[KHE] Expo Camera Android preview compatibility already prepared.');
  process.exit(0);
}

const marker = 'private var previewView = PreviewView(context).apply {\n    elevation = 0f';
if (!source.includes(marker)) throw new Error('Expo Camera preview initialization changed; review the Android compatibility patch.');

const patched = source.replace(
  marker,
  'private var previewView = PreviewView(context).apply {\n    // TextureView composition prevents a black CameraX surface below React Native overlays on Android tablets.\n    implementationMode = PreviewView.ImplementationMode.COMPATIBLE\n    elevation = 0f',
);
writeFileSync(cameraView, patched);
console.log(`[KHE] Expo Camera Android preview configured for overlay-compatible TextureView at ${cameraRoot}`);
