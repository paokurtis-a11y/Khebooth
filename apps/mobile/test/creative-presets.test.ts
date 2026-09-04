import assert from 'node:assert/strict';
import test from 'node:test';

import { applyCreativePreset, CREATIVE_PRESETS } from '../src/studio/creative-presets';
import type { CreativePlan } from '../src/studio/creative-studio';

const BASE_PLAN: CreativePlan = {
  presetId: null,
  template: 'CUSTOM', title: 'Mon titre', subtitle: 'Mon sous-titre', frameStyle: 'NONE', textPosition: 'BOTTOM', textStartSeconds: 0, textEndSeconds: null,
  speed: '1x', boomerang: false, reverse: false, freezeFrame: false, colorEffect: 'NONE', audioMode: 'MUSIC_ONLY', musicRotationEvery: 3,
  music: [{ id: 'music-1', name: 'KHE Track', uri: 'file:///track.mp3', trimMode: 'FULL', startSeconds: 0, endSeconds: null, volume: 80 }],
  background: { localUri: 'file:///background.jpg', cloudPath: null, mimeType: 'image/jpeg', byteSize: 10, cropX: 0, cropY: 0, zoom: 1, opacity: .7 },
  showKheBranding: false,
};

test('the KHE library exposes twelve unique ready-to-use presets', () => {
  assert.equal(CREATIVE_PRESETS.length, 12);
  assert.equal(new Set(CREATIVE_PRESETS.map((preset) => preset.id)).size, 12);
  for (const preset of CREATIVE_PRESETS) {
    assert.ok(preset.effects.length >= 3);
    assert.ok(preset.name.length > 3);
    assert.ok(preset.description.length > 12);
  }
});

test('applying a preset keeps event assets, music and branding choices', () => {
  const preset = CREATIVE_PRESETS.find((item) => item.id === 'wedding-sparkle');
  assert.ok(preset);
  const result = applyCreativePreset(BASE_PLAN, preset);
  assert.equal(result.presetId, 'wedding-sparkle');
  assert.equal(result.template, 'WEDDING');
  assert.equal(result.frameStyle, 'GOLD');
  assert.equal(result.background, BASE_PLAN.background);
  assert.equal(result.music, BASE_PLAN.music);
  assert.equal(result.audioMode, 'MUSIC_ONLY');
  assert.equal(result.showKheBranding, false);
});
