import type { AspectRatio } from '@khe/contracts';
import type { CreativePlan, MusicAsset } from './creative-studio';

export interface RenderCommandInput {
  sourcePath: string;
  outputPath: string;
  mimeType: 'image/jpeg' | 'video/mp4';
  aspectRatio: AspectRatio;
  plan: CreativePlan;
  selectedMusic: MusicAsset | null;
  backgroundPath: string | null;
  musicPath: string | null;
  hasSourceAudio: boolean;
  videoEncoder?: string;
}

export interface RenderCommand {
  args: string[];
  width: number;
  height: number;
}

const SPEED: Record<CreativePlan['speed'], number> = {
  '0.5x': 0.5,
  '0.75x': 0.75,
  '1x': 1,
  '1.25x': 1.25,
  '1.5x': 1.5,
  '2x': 2,
};

function dimensions(aspectRatio: AspectRatio) {
  return aspectRatio === '1:1' ? { width: 1080, height: 1080 } : { width: 1080, height: 1920 };
}

function drawTextEscape(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/\n/g, ' ')
    .trim();
}

function colorFilter(effect: CreativePlan['colorEffect']) {
  if (effect === 'WARM') return 'eq=saturation=1.22:contrast=1.06:brightness=.012:gamma_r=1.07:gamma_b=.94,colorbalance=rs=.045:gs=.012:bs=-.035,vignette=PI/5';
  if (effect === 'COOL') return 'eq=saturation=1.16:contrast=1.08:brightness=.006:gamma_b=1.09:gamma_r=.95,colorbalance=rs=-.035:gs=.015:bs=.055,vignette=PI/5';
  if (effect === 'GOLD') return 'eq=saturation=1.24:contrast=1.1:brightness=.012,colorbalance=rs=.11:gs=.055:bs=-.085,vignette=PI/5';
  if (effect === 'MONO') return 'hue=s=0,eq=contrast=1.2:brightness=.012:gamma=.96,vignette=PI/5';
  if (effect === 'PARTY') return 'eq=saturation=1.52:contrast=1.12:brightness=.008,colorbalance=rs=.045:gs=-.012:bs=.065,vignette=PI/6';
  return null;
}

function frameFilter(frame: CreativePlan['frameStyle']) {
  if (frame === 'CLASSIC') return 'drawbox=x=14:y=14:w=iw-28:h=ih-28:color=white@.92:t=6,drawbox=x=27:y=27:w=iw-54:h=ih-54:color=white@.34:t=2';
  if (frame === 'GOLD') return 'drawbox=x=14:y=14:w=iw-28:h=ih-28:color=0xD2AD4F@.98:t=8,drawbox=x=30:y=30:w=iw-60:h=ih-60:color=0xFFF0B0@.58:t=3';
  if (frame === 'NEON') return 'drawbox=x=12:y=12:w=iw-24:h=ih-24:color=0x33DDFF@.98:t=8,drawbox=x=27:y=27:w=iw-54:h=ih-54:color=0xEF46FF@.82:t=4';
  if (frame === 'POLAROID') return 'drawbox=x=0:y=0:w=iw:h=ih:color=white@.98:t=30,drawbox=x=22:y=22:w=iw-44:h=ih-44:color=white@.42:t=4';
  return null;
}

function templateFilter(plan: CreativePlan, height: number) {
  const bandY = Math.round(height * .735);
  const bandHeight = Math.round(height * .16);
  const accentY = bandY - 6;
  if (plan.template === 'WEDDING') return `drawbox=x=0:y=${bandY}:w=iw:h=${bandHeight}:color=0x241814@.58:t=fill,drawbox=x=0:y=${accentY}:w=iw:h=6:color=0xEFD08A@.9:t=fill`;
  if (plan.template === 'BIRTHDAY') return `drawbox=x=0:y=${bandY}:w=iw:h=${bandHeight}:color=0x2A102D@.58:t=fill,drawbox=x=0:y=${accentY}:w=iw/2:h=6:color=0xFFCB45@.96:t=fill,drawbox=x=iw/2:y=${accentY}:w=iw/2:h=6:color=0xFF557D@.96:t=fill`;
  if (plan.template === 'GALA') return `drawbox=x=0:y=${bandY}:w=iw:h=${bandHeight}:color=black@.64:t=fill,drawbox=x=0:y=${accentY}:w=iw:h=6:color=0xD2AD4F@.92:t=fill`;
  if (plan.template === 'BABY') return `drawbox=x=0:y=${bandY}:w=iw:h=${bandHeight}:color=0x172536@.58:t=fill,drawbox=x=0:y=${accentY}:w=iw/2:h=6:color=0xB8D9FF@.96:t=fill,drawbox=x=iw/2:y=${accentY}:w=iw/2:h=6:color=0xFFD2E1@.96:t=fill`;
  return null;
}

function textFilters(plan: CreativePlan, width: number, height: number, timed: boolean) {
  const filters: string[] = [];
  const position = plan.textPosition === 'TOP' ? Math.round(height * 0.13) : plan.textPosition === 'CENTER' ? '(h-text_h)/2-35' : Math.round(height * 0.78);
  const start = Math.max(0, Number(plan.textStartSeconds) || 0);
  const end = plan.textEndSeconds === null || !Number.isFinite(plan.textEndSeconds) ? null : Math.max(start, Number(plan.textEndSeconds));
  const enable = timed ? `:enable='${end === null ? `gte(t,${start})` : `between(t,${start},${end})`}'` : '';
  if (plan.title.trim()) {
    filters.push(`drawtext=font='sans':text='${drawTextEscape(plan.title)}':fontcolor=white:fontsize=${width === height ? 60 : 66}:borderw=3:bordercolor=black@.72:shadowx=3:shadowy=3:shadowcolor=black@.72:box=1:boxcolor=black@.24:boxborderw=18:x=(w-text_w)/2:y=${position}${enable}`);
  }
  if (plan.subtitle.trim()) {
    const subtitleY = typeof position === 'number' ? position + 94 : '(h-text_h)/2+54';
    filters.push(`drawtext=font='sans':text='${drawTextEscape(plan.subtitle)}':fontcolor=0xF6E6B2:fontsize=${width === height ? 31 : 35}:borderw=2:bordercolor=black@.76:shadowx=2:shadowy=2:shadowcolor=black@.8:x=(w-text_w)/2:y=${subtitleY}${enable}`);
  }
  if (plan.showKheBranding) {
    filters.push("drawbox=x=iw-252:y=ih-77:w=224:h=48:color=black@.68:t=fill,drawbox=x=iw-252:y=ih-77:w=7:h=48:color=0xB31520@.96:t=fill,drawtext=font='sans':text='KHE BOOTH':fontcolor=0xD2AD4F:fontsize=24:borderw=1:bordercolor=black@.9:x=w-text_w-47:y=h-text_h-42");
  }
  return filters;
}

function decorations(plan: CreativePlan, width: number, height: number, timed = false) {
  return [colorFilter(plan.colorEffect), templateFilter(plan, height), frameFilter(plan.frameStyle), ...textFilters(plan, width, height, timed)].filter(Boolean) as string[];
}

function backgroundFilter(input: RenderCommandInput, width: number, height: number, inputIndex: number, outputLabel: string) {
  const cropX = Math.max(-50, Math.min(50, input.plan.background?.cropX ?? 0));
  const cropY = Math.max(-50, Math.min(50, input.plan.background?.cropY ?? 0));
  const zoom = Math.max(1, Math.min(3, input.plan.background?.zoom ?? 1));
  return `[${inputIndex}:v]scale=${Math.round(width * zoom)}:${Math.round(height * zoom)}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}:(iw-ow)/2+(${cropX}/100)*(iw-ow):(ih-oh)/2+(${cropY}/100)*(ih-oh),format=yuv420p[${outputLabel}]`;
}

function decorateVideo(label: string, input: RenderCommandInput, width: number, height: number, filters: string[]) {
  let current = label;
  if (input.backgroundPath) {
    filters.push(backgroundFilter(input, width, height, 1, 'khebg'));
    const opacity = Math.max(.15, Math.min(1, input.plan.background?.opacity ?? .55));
    filters.push(`[${current}][khebg]blend=all_mode=softlight:all_opacity=${opacity}:shortest=1[khebgmix]`);
    current = 'khebgmix';
  }

  const finalDecorations = decorations(input.plan, width, height, true);
  if (finalDecorations.length) {
    filters.push(`[${current}]${finalDecorations.join(',')}[khedecorated]`);
    current = 'khedecorated';
  }
  return current;
}

function videoGraph(input: RenderCommandInput, width: number, height: number) {
  const filters: string[] = [];
  let video = 'vbase';
  filters.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},format=yuv420p,setpts=PTS-STARTPTS,setsar=1[${video}]`);

  if (input.plan.reverse) {
    filters.push(`[${video}]reverse,setpts=PTS-STARTPTS[vrev]`);
    video = 'vrev';
  }
  if (input.plan.boomerang) {
    filters.push(`[${video}]split=2[vforward][vreversein]`);
    filters.push('[vreversein]reverse,setpts=PTS-STARTPTS[vreverse]');
    filters.push('[vforward][vreverse]concat=n=2:v=1:a=0[vboom]');
    video = 'vboom';
  }

  const speed = SPEED[input.plan.speed];
  if (speed !== 1) {
    filters.push(`[${video}]setpts=PTS/${speed}[vspeed]`);
    video = 'vspeed';
  }
  if (input.plan.freezeFrame) {
    filters.push(`[${video}]tpad=stop_mode=clone:stop_duration=1.5[vfreeze]`);
    video = 'vfreeze';
  }
  video = decorateVideo(video, input, width, height, filters);

  let audioLabel: string | null = null;
  if (input.selectedMusic && input.musicPath) {
    const musicIndex = input.backgroundPath ? 2 : 1;
    const start = Math.max(0, input.selectedMusic.startSeconds || 0);
    const volume = Math.max(0, Math.min(1, input.selectedMusic.volume / 100));
    const audioOps = [`atrim=start=${start}`];
    if (input.selectedMusic.trimMode === 'SEGMENT' && input.selectedMusic.endSeconds !== null && input.selectedMusic.endSeconds > start) {
      audioOps.push(`atrim=end=${input.selectedMusic.endSeconds}`);
    }
    audioOps.push('asetpts=PTS-STARTPTS', `volume=${volume}`);
    filters.push(`[${musicIndex}:a]${audioOps.join(',')}[khemusic]`);
    audioLabel = 'khemusic';
  } else if (input.plan.audioMode === 'MIC_ONLY' && input.hasSourceAudio) {
    filters.push('[0:a]asetpts=PTS-STARTPTS[abase]');
    let audio = 'abase';
    if (input.plan.reverse) {
      filters.push(`[${audio}]areverse,asetpts=PTS-STARTPTS[arev]`);
      audio = 'arev';
    }
    if (input.plan.boomerang) {
      filters.push(`[${audio}]asplit=2[aforward][areversein]`);
      filters.push('[areversein]areverse,asetpts=PTS-STARTPTS[areverse]');
      filters.push('[aforward][areverse]concat=n=2:v=0:a=1[aboom]');
      audio = 'aboom';
    }
    if (speed !== 1) {
      filters.push(`[${audio}]atempo=${speed}[aspeed]`);
      audio = 'aspeed';
    }
    if (input.plan.freezeFrame) {
      filters.push(`[${audio}]apad=pad_dur=1.5[afreeze]`);
      audio = 'afreeze';
    }
    audioLabel = audio;
  }
  return { filterComplex: filters.join(';'), videoLabel: video, audioLabel };
}

export function buildRenderCommand(input: RenderCommandInput): RenderCommand {
  const { width, height } = dimensions(input.aspectRatio);
  const args: string[] = ['-y', '-i', input.sourcePath];
  if (input.backgroundPath) args.push('-loop', '1', '-i', input.backgroundPath);
  if (input.selectedMusic && input.musicPath) args.push('-stream_loop', '-1', '-i', input.musicPath);

  if (input.mimeType === 'image/jpeg') {
    if (input.backgroundPath) {
      const graph: string[] = [
        `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},format=yuv420p,setsar=1[photo]`,
        backgroundFilter(input, width, height, 1, 'bg'),
        `[photo][bg]blend=all_mode=softlight:all_opacity=${Math.max(.15, Math.min(1, input.plan.background?.opacity ?? .55))}:shortest=1[composed]`,
      ];
      const finalDecorations = decorations(input.plan, width, height);
      const finalLabel = finalDecorations.length ? 'final' : 'composed';
      if (finalDecorations.length) graph.push(`[composed]${finalDecorations.join(',')}[final]`);
      args.push('-filter_complex', graph.join(';'), '-map', `[${finalLabel}]`);
    } else {
      const filters = [`scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos`, `crop=${width}:${height}`, 'format=yuv420p', 'setsar=1', ...decorations(input.plan, width, height)];
      args.push('-vf', filters.join(','));
    }
    args.push('-frames:v', '1', '-q:v', '2', input.outputPath);
    return { args, width, height };
  }

  const graph = videoGraph(input, width, height);
  args.push('-filter_complex', graph.filterComplex, '-map', `[${graph.videoLabel}]`);
  if (graph.audioLabel) args.push('-map', `[${graph.audioLabel}]`);
  else args.push('-an');
  args.push('-c:v', input.videoEncoder || 'mpeg4');
  if ((input.videoEncoder || 'mpeg4') === 'mpeg4') args.push('-q:v', '3');
  else args.push('-b:v', '8M');
  args.push('-pix_fmt', 'yuv420p');
  if (graph.audioLabel) args.push('-c:a', 'aac', '-b:a', '192k');
  args.push('-movflags', '+faststart', '-shortest', input.outputPath);
  return { args, width, height };
}
