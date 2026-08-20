import { strict as assert } from 'node:assert';
import { selectMusicForCapture, renderSummary, type CaptureRenderJob } from './render-plan';
import type { CreativePlan } from './creative-studio';

const basePlan: CreativePlan = {
  template: 'CUSTOM',
  title: 'Heureux mariage',
  subtitle: 'KHE Booth',
  textPosition: 'BOTTOM',
  frameStyle: 'GOLD',
  colorEffect: 'GOLD',
  speed: '1x',
  boomerang: false,
  reverse: false,
  freezeFrame: false,
  audioMode: 'MUSIC_ONLY',
  musicRotationEvery: 3,
  background: null,
  showKheBranding: true,
  music: [
    { id: 'a', name: 'A.mp3', uri: 'file:///a.mp3', mimeType: 'audio/mpeg', trimMode: 'SEGMENT', startSeconds: 12, endSeconds: 24, volume: 75 },
    { id: 'b', name: 'B.wav', uri: 'file:///b.wav', mimeType: 'audio/wav', trimMode: 'FULL', startSeconds: 0, endSeconds: null, volume: 100 },
    { id: 'c', name: 'C.mp4', uri: 'file:///c.mp4', mimeType: 'audio/mp4', trimMode: 'FULL', startSeconds: 0, endSeconds: null, volume: 50 },
  ],
};

assert.equal(selectMusicForCapture(basePlan, 1)?.id, 'a');
assert.equal(selectMusicForCapture(basePlan, 3)?.id, 'a');
assert.equal(selectMusicForCapture(basePlan, 4)?.id, 'b');
assert.equal(selectMusicForCapture(basePlan, 6)?.id, 'b');
assert.equal(selectMusicForCapture(basePlan, 7)?.id, 'c');
assert.equal(selectMusicForCapture(basePlan, 9)?.id, 'c');
assert.equal(selectMusicForCapture(basePlan, 10)?.id, 'a');

const microphonePlan: CreativePlan = { ...basePlan, audioMode: 'MIC_ONLY' };
assert.equal(selectMusicForCapture(microphonePlan, 1), null);

const job: CaptureRenderJob = {
  version: 1,
  captureIndex: 1,
  createdAt: new Date(0).toISOString(),
  sourceUri: 'file:///source.mp4',
  outputUri: null,
  state: 'PLANNED',
  plan: basePlan,
  selectedMusic: basePlan.music[0] ?? null,
  error: null,
};
const summary = renderSummary(job);
assert.match(summary, /Cadre GOLD/);
assert.match(summary, /Texte/);
assert.match(summary, /Musique: A\.mp3/);
assert.equal(job.plan.showKheBranding, true);
assert.equal(job.selectedMusic?.startSeconds, 12);
assert.equal(job.selectedMusic?.endSeconds, 24);
assert.equal(job.selectedMusic?.volume, 75);

console.log('creative render plan tests: ok');