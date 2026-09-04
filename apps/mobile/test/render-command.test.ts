import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreativePlan, MusicAsset } from '../src/studio/creative-studio';
import { buildRenderCommand } from '../src/studio/render-command';

const BASE_PLAN: CreativePlan = {
  template: 'NONE', title: '', subtitle: '', frameStyle: 'NONE', textPosition: 'BOTTOM', textStartSeconds: 0, textEndSeconds: null, speed: '1x', boomerang: false, reverse: false, freezeFrame: false,
  colorEffect: 'NONE', audioMode: 'MIC_ONLY', musicRotationEvery: 3, music: [], background: null, showKheBranding: true,
};

function plan(patch: Partial<CreativePlan> = {}): CreativePlan {
  return { ...BASE_PLAN, ...patch };
}

const music: MusicAsset = {
  id: 'music-1', name: 'Entrée', uri: 'file:///music.mp3', cloudPath: 'organizations/o/events/e/design/music.mp3', byteSize: 1234,
  mimeType: 'audio/mpeg', trimMode: 'SEGMENT', startSeconds: 4, endSeconds: 12, volume: 75,
};

test('portrait Studio render produces 1080x1920 decorated final video', () => {
  const command = buildRenderCommand({ sourcePath: '/raw.mp4', outputPath: '/final.mp4', mimeType: 'video/mp4', aspectRatio: '9:16', plan: plan({ title: 'Sandrine & Heinz', subtitle: '01.08.2026', frameStyle: 'GOLD', colorEffect: 'WARM', showKheBranding: true }), selectedMusic: null, backgroundPath: null, musicPath: null, hasSourceAudio: true, videoEncoder: 'h264_mediacodec' });
  assert.equal(command.width, 1080);assert.equal(command.height, 1920);
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /scale=1080:1920/);assert.match(graph, /Sandrine & Heinz/);assert.match(graph, /KHE BOOTH/);assert.match(graph, /0xD2AD4F/);
  assert.equal(command.args[command.args.indexOf('-c:v') + 1], 'h264_mediacodec');
});

test('video graph applies reverse, boomerang, speed and freeze frame before decorations', () => {
  const command = buildRenderCommand({ sourcePath: '/raw.mp4', outputPath: '/final.mp4', mimeType: 'video/mp4', aspectRatio: '1:1', plan: plan({ reverse: true, boomerang: true, freezeFrame: true, speed: '2x' }), selectedMusic: null, backgroundPath: null, musicPath: null, hasSourceAudio: true, videoEncoder: 'mpeg4' });
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /reverse/);assert.match(graph, /concat=n=2:v=1:a=0/);assert.match(graph, /setpts=PTS\/2/);assert.match(graph, /tpad=stop_mode=clone:stop_duration=1.5/);assert.match(graph, /areverse/);assert.match(graph, /atempo=2/);
  assert.equal(command.width, 1080);assert.equal(command.height, 1080);
});

test('video text respects appearance and disappearance settings', () => {
  const command = buildRenderCommand({ sourcePath: '/raw.mp4', outputPath: '/final.mp4', mimeType: 'video/mp4', aspectRatio: '9:16', plan: plan({ title: 'KHE', subtitle: 'Moment', textStartSeconds: 2, textEndSeconds: 7 }), selectedMusic: null, backgroundPath: null, musicPath: null, hasSourceAudio: true, videoEncoder: 'mpeg4' });
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /enable='between\(t,2,7\)'/);
});

test('Studio music replaces microphone audio with selected trimmed playlist track', () => {
  const command = buildRenderCommand({ sourcePath: '/raw.mp4', outputPath: '/final.mp4', mimeType: 'video/mp4', aspectRatio: '9:16', plan: plan({ audioMode: 'MUSIC_ONLY', music: [music] }), selectedMusic: music, backgroundPath: null, musicPath: '/music.mp3', hasSourceAudio: false, videoEncoder: 'mpeg4' });
  const loopAt = command.args.indexOf('-stream_loop');
  assert.ok(loopAt >= 0);
  assert.deepEqual(command.args.slice(loopAt, loopAt + 4), ['-stream_loop', '-1', '-i', '/music.mp3']);
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /atrim=start=4,atrim=end=12/);assert.match(graph, /volume=0.75/);assert.equal(command.args.includes('[khemusic]'), true);
});

test('photo background enriches the capture without masking it, before frame and text', () => {
  const creative = plan({ title: 'Mariage', frameStyle: 'GOLD', showKheBranding: true, background: { localUri: 'file:///bg.jpg', cloudPath: 'cloud/bg.jpg', mimeType: 'image/jpeg', byteSize: 10, cropX: 0, cropY: 0, zoom: 1, opacity: 0.55 } });
  const command = buildRenderCommand({ sourcePath: '/raw.jpg', outputPath: '/final.jpg', mimeType: 'image/jpeg', aspectRatio: '1:1', plan: creative, selectedMusic: null, backgroundPath: '/bg.jpg', musicPath: null, hasSourceAudio: false });
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  const blendAt = graph.indexOf('[photo][bg]blend=all_mode=softlight');const drawTextAt = graph.indexOf('drawtext');
  assert.ok(blendAt >= 0);assert.ok(drawTextAt > blendAt);assert.match(graph, /KHE BOOTH/);assert.doesNotMatch(graph, /\[photo\]\[bg\]overlay/);
});

test('Studio templates and effects produce a visible premium composition', () => {
  const command = buildRenderCommand({ sourcePath: '/raw.mp4', outputPath: '/final.mp4', mimeType: 'video/mp4', aspectRatio: '9:16', plan: plan({ template: 'WEDDING', title: 'Notre mariage', subtitle: 'Paris · 2026', colorEffect: 'GOLD', frameStyle: 'GOLD' }), selectedMusic: null, backgroundPath: null, musicPath: null, hasSourceAudio: true, videoEncoder: 'mpeg4' });
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /colorbalance=rs=.11/);
  assert.match(graph, /vignette=PI\/5/);
  assert.match(graph, /color=0x241814@.58/);
  assert.match(graph, /color=0xEFD08A@.9/);
  assert.match(graph, /boxcolor=black@.24/);
  assert.match(graph, /drawbox=x=iw-252:y=ih-77/);
});

test('microphone audio timestamps are normalized before Studio transformations', () => {
  const command = buildRenderCommand({ sourcePath: '/raw.mp4', outputPath: '/final.mp4', mimeType: 'video/mp4', aspectRatio: '9:16', plan: plan(), selectedMusic: null, backgroundPath: null, musicPath: null, hasSourceAudio: true, videoEncoder: 'mpeg4' });
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /\[0:a\]asetpts=PTS-STARTPTS\[abase\]/);
  assert.equal(command.args.includes('[abase]'), true);
});
