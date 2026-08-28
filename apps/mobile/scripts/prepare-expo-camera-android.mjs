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

let patched = readFileSync(cameraView, 'utf8');

if (!patched.includes('implementationMode = PreviewView.ImplementationMode.COMPATIBLE')) {
  const previewMarker = 'private var previewView = PreviewView(context).apply {\n    elevation = 0f';
  if (!patched.includes(previewMarker)) throw new Error('Expo Camera preview initialization changed; review the Android compatibility patch.');
  patched = patched.replace(
    previewMarker,
    'private var previewView = PreviewView(context).apply {\n    // TextureView composition prevents a black CameraX surface below React Native overlays on Android tablets.\n    implementationMode = PreviewView.ImplementationMode.COMPATIBLE\n    elevation = 0f',
  );
}

if (!patched.includes('KHE_PREVIEW_STREAM_READY')) {
  const eventMarker = '  private val onMountError by EventDispatcher<CameraMountErrorEvent>()';
  if (!patched.includes(eventMarker)) throw new Error('Expo Camera event initialization changed; review the stream-ready patch.');
  patched = patched.replace(
    eventMarker,
    `${eventMarker}\n\n  // KHE_PREVIEW_STREAM_READY: OPEN only means that CameraX opened the device; wait for visible frames.\n  init {\n    previewView.previewStreamState.observe(currentActivity) { state ->\n      if (state == PreviewView.StreamState.STREAMING) {\n        onCameraReady(Unit)\n      }\n    }\n  }`,
  );

  const prematureReady = '        CameraState.Type.OPEN -> {\n          onCameraReady(Unit)\n          setTorchEnabled(enableTorch)';
  if (!patched.includes(prematureReady)) throw new Error('Expo Camera OPEN-state handling changed; review the stream-ready patch.');
  patched = patched.replace(
    prematureReady,
    '        CameraState.Type.OPEN -> {\n          setTorchEnabled(enableTorch)',
  );
}

writeFileSync(cameraView, patched);
console.log(`[KHE] Expo Camera Android preview uses TextureView and reports ready only when frames are streaming at ${cameraRoot}`);
