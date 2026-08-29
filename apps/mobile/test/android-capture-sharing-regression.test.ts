import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

async function source(path: string): Promise<string> {
  return readFile(resolve(process.cwd(), path), 'utf8');
}

test('CAPTURE keeps one stock CameraX surface with high-quality recording and event live', async () => {
  const [capture, mobilePackage, appConfig] = await Promise.all([
    source('src/capture/camera-capture.tsx'),
    source('package.json'),
    source('app.json'),
  ]);

  assert.match(capture, /useState<CameraType>\('back'\)/);
  assert.match(capture, /camera:\{flex:1\}/);
  assert.match(capture, /ratio=\{format==='1:1'\?'1:1':'16:9'\}/);
  assert.match(capture, /videoQuality="1080p"/);
  assert.match(capture, /videoBitrate=\{16_000_000\}/);
  assert.match(capture, /APERÇU ORIGINAL • STUDIO APRÈS CAPTURE/);
  assert.match(capture, /CaptureLivePublisher/);
  assert.doesNotMatch(capture, /camera:\{\.\.\.StyleSheet\.absoluteFillObject\}/);
  assert.doesNotMatch(capture, /flash=|enableTorch=|zoom=|mute=|Relancer caméra/);
  assert.doesNotMatch(capture, /styles\.designLayer|styles\.effectOverlay/);
  assert.match(mobilePackage, /livekit-client/);
  assert.match(appConfig, /MEDIA_PROJECTION/);
});

test('CAPTURE secures the original before the persistent Studio render queue', async () => {
  const [pipeline, capture, main, sqlite] = await Promise.all([
    source('src/capture/finalize-capture.ts'),
    source('src/capture/camera-capture.tsx'),
    source('src/main.tsx'),
    source('src/offline/sqlite-store.ts'),
  ]);

  assert.ok(pipeline.indexOf('source.copy(raw)') < pipeline.indexOf('upsertRenderJob(job)'));
  assert.match(pipeline, /class CaptureRenderQueue/);
  assert.doesNotMatch(pipeline, /raw\.size <= 0 \|\| !raw\.md5/);
  assert.match(pipeline, /state: 'FAILED'[\s\S]+nextAttemptAt/);
  assert.match(capture, /await stageCapture\(/);
  assert.doesNotMatch(capture, /await finalizeCapture\(/);
  assert.match(main, /useCaptureRenderQueue\(/);
  assert.match(sqlite, /CREATE TABLE IF NOT EXISTS render_jobs/);
});

test('SHARING renders a bounded media grid and opens one detailed video player', async () => {
  const gallery = await source('src/sharing/sharing-media-gallery.tsx');

  assert.match(gallery, /const columns = width >= 600 \? 4 : width >= 340 \? 2 : 1/);
  assert.match(gallery, /kind==='PHOTO'[\s\S]+: <View style=\{styles\.videoTile\}>/);
  assert.match(gallery, /<Modal visible=\{Boolean\(focusedItem\)\}/);
  assert.equal((gallery.match(/<SharingMediaPreview/g) ?? []).length, 2);
});

test('KHE LINK keeps its synchronization heading on one adaptive line', async () => {
  const health = await source('src/station/station-link-health.tsx');

  assert.match(health, /Liaison & synchronisation<\/Text>/);
  assert.match(health, /numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0\.62\}/);
});

test('SHARING receives the authorized screen live without opening a second lens', async () => {
  const remoteControl = await source('src/sharing/remote-control-panel.tsx');

  assert.match(remoteControl, /SharingLivePreview|APERÇU LIVE CAPTURE/);
  assert.match(remoteControl, /Une seule validation initiale/);
  assert.doesNotMatch(remoteControl, /CameraView|expo-camera/);
});

test('every SQLite store operation goes through native-handle recovery', async () => {
  const sqliteStore = await source('src/offline/sqlite-store.ts');
  const directDatabaseCalls = sqliteStore.match(/await this\.database\(\)/g) ?? [];

  assert.equal(directDatabaseCalls.length, 2, 'database() must only be called by withNativeRecovery');
  assert.match(sqliteStore, /private recoveryPromise: Promise<void> \| null = null/);
});
