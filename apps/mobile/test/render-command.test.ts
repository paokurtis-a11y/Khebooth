import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreativePlan, MusicAsset } from '../src/studio/creative-studio';
import { buildRenderCommand } from '../src/studio/render-command';

const BASE_PLAN: CreativePlan = {
  template: 'NONE', title: '', subtitle: '', frameStyle: 'NONE', textPosition: 'BOTTOM', textStartSeconds: 0, textEndSeconds: null, speed: '1x', boomerang: false, reverse: false, freezeFrame: false,
  colorEffect: 'NONE', audioMode: 'MIC_ONLY', musicRotationEvery: 3, music: [], background: null, showKheBranding: true, customLogo: null,
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

test('photo background is composited before frame, text and KHE branding', () => {
  const creative = plan({ title: 'Mariage', frameStyle: 'GOLD', showKheBranding: true, background: { localUri: 'file:///bg.jpg', cloudPath: 'cloud/bg.jpg', mimeType: 'image/jpeg', byteSize: 10, cropX: 0, cropY: 0, zoom: 1, opacity: 0.55, fit: 'CONTAIN', rotation: 0, flipX: false, flipY: false, brightness: 0, contrast: 1, saturation: 1, enhance: false } });
  const command = buildRenderCommand({ sourcePath: '/raw.jpg', outputPath: '/final.jpg', mimeType: 'image/jpeg', aspectRatio: '1:1', plan: creative, selectedMusic: null, backgroundPath: '/bg.jpg', musicPath: null, hasSourceAudio: false });
  const graph = command.args[command.args.indexOf('-filter_complex') + 1];
  const overlayAt = graph.indexOf('[photo][bg]overlay');const drawTextAt = graph.indexOf('drawtext');
  assert.ok(overlayAt >= 0);assert.ok(drawTextAt > overlayAt);assert.match(graph, /KHE BOOTH/);assert.match(graph,/force_original_aspect_ratio=decrease/);assert.match(graph,/eq=brightness=0:contrast=1:saturation=1/);
});

test('custom client logo is composited into the final video without replacing KHE entitlement branding',()=>{
  const customLogo={localUri:'file:///logo.png',cloudPath:'cloud/logo.png',mimeType:'image/png',byteSize:100};
  const command=buildRenderCommand({sourcePath:'/raw.mp4',outputPath:'/final.mp4',mimeType:'video/mp4',aspectRatio:'9:16',plan:plan({customLogo}),selectedMusic:null,backgroundPath:null,customLogoPath:'/logo.png',musicPath:null,hasSourceAudio:true,videoEncoder:'h264_mediacodec'});
  const graph=command.args[command.args.indexOf('-filter_complex')+1];
  assert.match(graph,/\[1:v\]scale=194:-1/);assert.match(graph,/overlay=W-w-30:30/);assert.match(graph,/KHE BOOTH/);
});
