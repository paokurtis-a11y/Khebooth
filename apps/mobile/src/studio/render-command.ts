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
  customLogoPath?: string | null;
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
  if (effect === 'WARM') return 'eq=saturation=1.12:gamma_r=1.06:gamma_b=0.96';
  if (effect === 'COOL') return 'eq=saturation=1.08:gamma_b=1.08:gamma_r=0.96';
  if (effect === 'GOLD') return 'colorbalance=rs=.08:gs=.04:bs=-.08';
  if (effect === 'MONO') return 'hue=s=0';
  if (effect === 'PARTY') return 'eq=saturation=1.35:contrast=1.06';
  return null;
}

function frameFilter(frame: CreativePlan['frameStyle']) {
  if (frame === 'CLASSIC') return 'drawbox=x=0:y=0:w=iw:h=ih:color=white@0.94:t=10';
  if (frame === 'GOLD') return 'drawbox=x=0:y=0:w=iw:h=ih:color=0xD2AD4F@0.98:t=12';
  if (frame === 'NEON') return 'drawbox=x=0:y=0:w=iw:h=ih:color=0x33DDFF@0.98:t=12';
  if (frame === 'POLAROID') return 'drawbox=x=0:y=0:w=iw:h=ih:color=white@0.98:t=28';
  return null;
}

function textFilters(plan: CreativePlan, width: number, height: number, timed: boolean) {
  const filters: string[] = [];
  const position = plan.textPosition === 'TOP' ? Math.round(height * 0.13) : plan.textPosition === 'CENTER' ? '(h-text_h)/2-35' : Math.round(height * 0.78);
  const start = Math.max(0, Number(plan.textStartSeconds) || 0);
  const end = plan.textEndSeconds === null || !Number.isFinite(plan.textEndSeconds) ? null : Math.max(start, Number(plan.textEndSeconds));
  const enable = timed ? `:enable='${end === null ? `gte(t,${start})` : `between(t,${start},${end})`}'` : '';
  if (plan.title.trim()) {
    filters.push(`drawtext=font='sans':text='${drawTextEscape(plan.title)}':fontcolor=white:fontsize=${width === height ? 54 : 58}:borderw=4:bordercolor=black@0.72:x=(w-text_w)/2:y=${position}${enable}`);
  }
  if (plan.subtitle.trim()) {
    const subtitleY = typeof position === 'number' ? position + 76 : '(h-text_h)/2+42';
    filters.push(`drawtext=font='sans':text='${drawTextEscape(plan.subtitle)}':fontcolor=white:fontsize=${width === height ? 28 : 31}:borderw=3:bordercolor=black@0.7:x=(w-text_w)/2:y=${subtitleY}${enable}`);
  }
  if (plan.showKheBranding) {
    filters.push("drawtext=font='sans':text='KHE BOOTH':fontcolor=0xD2AD4F:fontsize=23:borderw=2:bordercolor=black@0.9:box=1:boxcolor=black@0.58:boxborderw=11:x=w-text_w-28:y=h-text_h-28");
  }
  return filters;
}

function decorations(plan: CreativePlan, width: number, height: number, timed = false) {
  return [colorFilter(plan.colorEffect), frameFilter(plan.frameStyle), ...textFilters(plan, width, height, timed)].filter(Boolean) as string[];
}

function backgroundFilter(input: RenderCommandInput, width: number, height: number, inputIndex: number, outputLabel: string) {
  const cropX = Math.max(-50, Math.min(50, input.plan.background?.cropX ?? 0));
  const cropY = Math.max(-50, Math.min(50, input.plan.background?.cropY ?? 0));
  const zoom = Math.max(1, Math.min(3, input.plan.background?.zoom ?? 1));
  const opacity = Math.max(0.15, Math.min(1, input.plan.background?.opacity ?? 0.55));
  const background=input.plan.background;
  const rotation=background?.rotation===90?'transpose=1,':background?.rotation===180?'hflip,vflip,':background?.rotation===270?'transpose=2,':'';
  const flips=`${background?.flipX?'hflip,':''}${background?.flipY?'vflip,':''}`;
  const brightness=Math.max(-1,Math.min(1,background?.brightness??0));const contrast=Math.max(.5,Math.min(2,background?.contrast??1));const saturation=Math.max(0,Math.min(2,background?.saturation??1));
  const enhance=background?.enhance?',hqdn3d=1.2:1.0:2.2:1.8,unsharp=5:5:0.45:5:5:0':'';
  const fit=background?.fit==='CONTAIN'
    ? `scale=${Math.round(width*zoom)}:${Math.round(height*zoom)}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2+((${cropX}/100)*(ow-iw)):(oh-ih)/2+((${cropY}/100)*(oh-ih)):color=black@0`
    : `scale=${Math.round(width*zoom)}:${Math.round(height*zoom)}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-ow)/2+(${cropX}/100)*(iw-ow):(ih-oh)/2+(${cropY}/100)*(ih-oh)`;
  return `[${inputIndex}:v]${rotation}${flips}${fit},eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}${enhance},format=rgba,colorchannelmixer=aa=${opacity}[${outputLabel}]`;
}

function customLogoFilter(inputIndex:number,width:number,outputLabel:string){return`[${inputIndex}:v]scale=${Math.round(width*.18)}:-1:force_original_aspect_ratio=decrease,format=rgba[${outputLabel}]`;}

function decorateVideo(label: string, input: RenderCommandInput, width: number, height: number, filters: string[]) {
  let current = label;
  if (input.backgroundPath) {
    filters.push(backgroundFilter(input, width, height, 1, 'khebg'));
    filters.push(`[${current}][khebg]overlay=0:0[khebgmix]`);
    current = 'khebgmix';
  }
  if(input.customLogoPath){const index=1+(input.backgroundPath?1:0);filters.push(customLogoFilter(index,width,'khelogo'));filters.push(`[${current}][khelogo]overlay=W-w-30:30[khelogomix]`);current='khelogomix';}

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
  // A light spatial/temporal denoise removes low-light sensor grain without
  // smearing faces, then a restrained unsharp pass restores edge definition.
  filters.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},hqdn3d=1.6:1.2:3.0:2.4,unsharp=5:5:0.32:5:5:0,setsar=1[${video}]`);

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
    const musicIndex = 1 + (input.backgroundPath ? 1 : 0) + (input.customLogoPath ? 1 : 0);
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
    let audio = '0:a';
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
  if (input.customLogoPath) args.push('-loop', '1', '-i', input.customLogoPath);
  if (input.selectedMusic && input.musicPath) args.push('-stream_loop', '-1', '-i', input.musicPath);

  if (input.mimeType === 'image/jpeg') {
    if (input.backgroundPath) {
      const graph: string[] = [
        `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[photo]`,
        backgroundFilter(input, width, height, 1, 'bg'),
        '[photo][bg]overlay=0:0[composed]',
      ];
      let composed='composed';
      if(input.customLogoPath){const logoIndex=2;graph.push(customLogoFilter(logoIndex,width,'logo'));graph.push('[composed][logo]overlay=W-w-30:30[withlogo]');composed='withlogo';}
      const finalDecorations = decorations(input.plan, width, height);
      const finalLabel = finalDecorations.length ? 'final' : composed;
      if (finalDecorations.length) graph.push(`[${composed}]${finalDecorations.join(',')}[final]`);
      args.push('-filter_complex', graph.join(';'), '-map', `[${finalLabel}]`);
    } else if(input.customLogoPath){
      const graph:string[]=[`[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[photo]`,customLogoFilter(1,width,'logo'),'[photo][logo]overlay=W-w-30:30[withlogo]'];
      const finalDecorations=decorations(input.plan,width,height);const finalLabel=finalDecorations.length?'final':'withlogo';if(finalDecorations.length)graph.push(`[withlogo]${finalDecorations.join(',')}[final]`);args.push('-filter_complex',graph.join(';'),'-map',`[${finalLabel}]`);
    } else {
      const filters = [`scale=${width}:${height}:force_original_aspect_ratio=increase`, `crop=${width}:${height}`, 'setsar=1', ...decorations(input.plan, width, height)];
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
  else args.push('-b:v', '12M', '-maxrate', '16M', '-bufsize', '24M');
  args.push('-pix_fmt', 'yuv420p');
  if (graph.audioLabel) args.push('-c:a', 'aac', '-b:a', '192k');
  args.push('-movflags', '+faststart', '-shortest', input.outputPath);
  return { args, width, height };
}
