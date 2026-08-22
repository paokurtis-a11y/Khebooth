import type { AspectRatio } from '@khe/contracts';
import { FFmpegKit, FFmpegKitConfig, ReturnCode } from '@nikhil-cephei/ffmpeg-kit-react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { CreativePlan, MusicAsset } from './creative-studio';
import { buildRenderCommand } from './render-command';

export interface FinalMediaRenderInput {
  eventId: string;
  localId: string;
  sourceUri: string;
  mimeType: 'image/jpeg' | 'video/mp4';
  aspectRatio: AspectRatio;
  plan: CreativePlan;
  selectedMusic: MusicAsset | null;
}

export interface FinalMediaRenderResult {
  outputUri: string;
  byteSize: number;
  contentHash: string;
  encoder: string;
}

let fontsConfigured = false;

function filePath(uri: string) {
  return decodeURI(uri.replace(/^file:\/\//, ''));
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function executeArguments(args: string[]) {
  const kit = FFmpegKit as unknown as {
    executeWithArguments?: (args: string[]) => Promise<unknown>;
    execute: (command: string) => Promise<unknown>;
  };
  const session = kit.executeWithArguments
    ? await kit.executeWithArguments(args)
    : await kit.execute(args.map(shellQuote).join(' '));
  const typed = session as {
    getReturnCode: () => Promise<unknown>;
    getOutput?: () => Promise<string>;
    getFailStackTrace?: () => Promise<string>;
  };
  const returnCode = await typed.getReturnCode();
  if (ReturnCode.isSuccess(returnCode as never)) return;
  const output = typed.getOutput ? await typed.getOutput() : '';
  const stack = typed.getFailStackTrace ? await typed.getFailStackTrace() : '';
  throw new Error(`Rendu média impossible${output ? ` : ${output.slice(-900)}` : stack ? ` : ${stack.slice(-900)}` : ''}`);
}

function ensureFonts() {
  if (fontsConfigured) return;
  const config = FFmpegKitConfig as unknown as { setFontDirectoryList?: (paths: string[]) => void };
  config.setFontDirectoryList?.(['/system/fonts', '/System/Library/Fonts', '/Library/Fonts']);
  fontsConfigured = true;
}

function preferredVideoEncoder() {
  if (Platform.OS === 'android') return 'h264_mediacodec';
  if (Platform.OS === 'ios') return 'h264_videotoolbox';
  return 'mpeg4';
}

function renderDirectory(eventId: string) {
  const directory = new Directory(Paths.document, 'renders', eventId);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

async function renderAttempt(input: FinalMediaRenderInput, output: File, encoder: string, hasSourceAudio: boolean) {
  if (output.exists) output.delete();
  const command = buildRenderCommand({
    sourcePath: filePath(input.sourceUri),
    outputPath: filePath(output.uri),
    mimeType: input.mimeType,
    aspectRatio: input.aspectRatio,
    plan: input.plan,
    selectedMusic: input.selectedMusic,
    backgroundPath: input.plan.background?.localUri ? filePath(input.plan.background.localUri) : null,
    musicPath: input.selectedMusic?.uri ? filePath(input.selectedMusic.uri) : null,
    hasSourceAudio,
    videoEncoder: input.mimeType === 'video/mp4' ? encoder : undefined,
  });
  await executeArguments(command.args);
  if (!output.exists || output.size <= 0 || !output.md5) throw new Error('Le moteur de rendu n’a pas produit de média final vérifiable.');
}

export async function renderFinalMedia(input: FinalMediaRenderInput): Promise<FinalMediaRenderResult> {
  const source = new File(input.sourceUri);
  if (!source.exists || source.size <= 0) throw new Error('Le média brut à rendre est introuvable.');
  if (input.plan.background?.cloudPath && !input.plan.background.localUri) throw new Error('Le fond Studio n’est pas encore disponible localement sur CAPTURE.');
  if (input.selectedMusic?.cloudPath && !input.selectedMusic.uri) throw new Error('La musique Studio n’est pas encore disponible localement sur CAPTURE.');

  ensureFonts();
  const directory = renderDirectory(input.eventId);
  const extension = input.mimeType === 'image/jpeg' ? 'jpg' : 'mp4';
  const output = new File(directory, `${input.localId}-final.${extension}`);
  const preferred = input.mimeType === 'video/mp4' ? preferredVideoEncoder() : 'mjpeg';
  const encoders = input.mimeType === 'video/mp4' && preferred !== 'mpeg4' ? [preferred, 'mpeg4'] : [preferred];
  const sourceAudioOptions = input.mimeType === 'video/mp4' && input.plan.audioMode === 'MIC_ONLY' ? [true, false] : [false];
  let lastError: unknown = null;

  for (const encoder of encoders) {
    for (const hasSourceAudio of sourceAudioOptions) {
      try {
        await renderAttempt(input, output, encoder, hasSourceAudio);
        return { outputUri: output.uri, byteSize: output.size, contentHash: output.md5!, encoder };
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (output.exists) output.delete();
  throw lastError instanceof Error ? lastError : new Error('Le rendu final KHE a échoué. Le média brut reste conservé sur la tablette.');
}
