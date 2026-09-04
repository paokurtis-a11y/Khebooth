import assert from 'node:assert/strict';
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
