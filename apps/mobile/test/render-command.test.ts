import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CREATIVE_PLAN, type CreativePlan, type MusicAsset } from '../src/studio/creative-studio';
import { buildRenderCommand } from '../src/studio/render-command';

function plan(patch: Partial<CreativePlan> = {}): CreativePlan {
  return { ...DEFAULT_CREATIVE_PLAN, ...patch };
}

const music: MusicAsset = {
  id: 'music-1',
  name: 'Entrée',
  uri: 'file:///music.mp3',
  cloudPath: 'organizations/o/events/e/design/music.mp3',
  byteSize: 1234,
  mimeType: 'audio/mpeg',
  trimMode: 'SEGMENT',
  startSeconds: 4,
  endSeconds: 12,
  volume: 75,
};

test('portrait Studio render produces 1080x1920 decorated final video', () => {
  const command = buildRenderCommand({
    sourcePath: '/raw.mp4', outputPath: '/final.mp4', mimeType: 'video/mp4', aspectRatio: '9:16',
    plan: plan({ title: 'Sandrine & Heinz', subtitle: '01.08.2026', frameStyle: 'GOLD', colorEffect: 'WARM', showKheBranding: true }),
    selectedMusic: null, backgroundPath: null, musicPath: null, hasSourceAudio: true, videoEncoder: 'h264_mediacodec',
  });
  assert.equal(command.width, 1080);
  assert.equal(command.height, 1920);
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /scale=1080:1920/);
  assert.match(graph, /Sandrine & Heinz/);
  assert.match(graph, /KHE BOOTH/);
  assert.match(graph, /0xD2AD4F/);
  assert.equal(command.args[command.args.indexOf('-c:v') + 1], 'h264_mediacodec');
});

test('video graph applies reverse, boomerang, speed and freeze frame before decorations', () => {
  const command = buildRenderCommand({
    sourcePath: '/raw.mp4', outputPath: '/final.mp4', mimeType: 'video/mp4', aspectRatio: '1:1',
    plan: plan({ reverse: true, boomerang: true, freezeFrame: true, speed: '2x' }),
    selectedMusic: null, backgroundPath: null, musicPath: null, hasSourceAudio: true, videoEncoder: 'mpeg4',
  });
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /reverse/);
  assert.match(graph, /concat=n=2:v=1:a=0/);
  assert.match(graph, /setpts=PTS\/2/);
  assert.match(graph, /tpad=stop_mode=clone:stop_duration=1.5/);
  assert.match(graph, /areverse/);
  assert.match(graph, /atempo=2/);
  assert.equal(command.width, 1080);
  assert.equal(command.height, 1080);
});

test('Studio music replaces microphone audio with selected trimmed playlist track', () => {
  const command = buildRenderCommand({
    sourcePath: '/raw.mp4', outputPath: '/final.mp4', mimeType: 'video/mp4', aspectRatio: '9:16',
    plan: plan({ audioMode: 'MUSIC_ONLY', music: [music] }), selectedMusic: music,
    backgroundPath: null, musicPath: '/music.mp3', hasSourceAudio: false, videoEncoder: 'mpeg4',
  });
  assert.deepEqual(command.args.slice(4, 7), ['-stream_loop', '-1', '-i']);
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  assert.match(graph, /atrim=start=4,atrim=end=12/);
  assert.match(graph, /volume=0.75/);
  assert.equal(command.args.includes('[khemusic]'), true);
});

test('photo background is composited before frame, text and KHE branding', () => {
  const creative = plan({
    title: 'Mariage', frameStyle: 'GOLD', showKheBranding: true,
    background: { localUri: 'file:///bg.jpg', cloudPath: 'cloud/bg.jpg', mimeType: 'image/jpeg', byteSize: 10, cropX: 0, cropY: 0, zoom: 1, opacity: 0.55 },
  });
  const command = buildRenderCommand({
    sourcePath: '/raw.jpg', outputPath: '/final.jpg', mimeType: 'image/jpeg', aspectRatio: '1:1', plan: creative,
    selectedMusic: null, backgroundPath: '/bg.jpg', musicPath: null, hasSourceAudio: false,
  });
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  const overlayAt = graph.indexOf('[photo][bg]overlay');
  const drawTextAt = graph.indexOf('drawtext');
  assert.ok(overlayAt >= 0);
  assert.ok(drawTextAt > overlayAt);
  assert.match(graph, /KHE BOOTH/);
});
