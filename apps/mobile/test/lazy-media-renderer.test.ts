import assert from 'node:assert/strict';
import test from 'node:test';
import { createLazyFinalMediaRenderer, type RendererLoader } from '../src/studio/lazy-media-renderer';
import type { FinalMediaRenderInput } from '../src/studio/media-renderer';

const INPUT = {
  eventId: 'event-sharing-isolation',
  localId: 'capture-001',
  sourceUri: 'file:///raw.mp4',
  mimeType: 'video/mp4',
  aspectRatio: '9:16',
  plan: {},
  selectedMusic: null,
} as FinalMediaRenderInput;

test('the native renderer is not loaded until CAPTURE actually processes media', async () => {
  let loads = 0;
  const loadRenderer = (async () => {
    loads += 1;
    return {
      renderFinalMedia: async () => ({
        outputUri: 'file:///final.mp4',
        byteSize: 100,
        contentHash: 'final-hash',
        encoder: 'test',
      }),
    };
  }) as RendererLoader;
  const render = createLazyFinalMediaRenderer(loadRenderer);

  assert.equal(loads, 0, 'creating the SHARING/CAPTURE runtime must not initialize FFmpeg');
  assert.equal((await render(INPUT)).outputUri, 'file:///final.mp4');
  assert.equal(loads, 1);
  await render(INPUT);
  assert.equal(loads, 1, 'the renderer module is reused after its first CAPTURE job');
});
