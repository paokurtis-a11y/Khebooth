import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { shouldMountSharingVideoPlayer } from '../src/sharing/sharing-video-playback-policy';

test('SHARING mounts a native video player only for the explicitly active Moment', () => {
  const videos = ['video-1', 'video-2', 'video-3', 'video-4'];
  const activeId = 'video-3';
  const mounted = videos.filter((id) => shouldMountSharingVideoPlayer(id === activeId, `file:///${id}.mp4`));
  assert.deepEqual(mounted, ['video-3']);
});

test('SHARING never mounts a player while a video is still downloading', () => {
  assert.equal(shouldMountSharingVideoPlayer(true, null), false);
  assert.equal(shouldMountSharingVideoPlayer(false, 'file:///video.mp4'), false);
});

test('SHARING leaves native player disposal to Expo and uses a vector volume control', () => {
  const sourcePath = [join(process.cwd(), 'src/sharing/sharing-media-preview.tsx'), join(process.cwd(), 'apps/mobile/src/sharing/sharing-media-preview.tsx')].find(existsSync);
  assert.ok(sourcePath);
  const source = readFileSync(sourcePath, 'utf8');
  assert.doesNotMatch(source, /player\.pause\(\)/);
  assert.match(source, /react-native-svg/);
  assert.doesNotMatch(source, /🔇|🔊/);
  assert.match(source, /accessibilityLabel=\{muted \? 'Activer le son de la vidéo' : 'Couper le son de la vidéo'\}/);
});
