import { FFmpegKit, ReturnCode } from '@nikhil-cephei/ffmpeg-kit-react-native';
import { Directory, File, Paths } from 'expo-file-system';

const pending = new Map<string, Promise<string | null>>();

function filePath(uri: string): string {
  return decodeURI(uri.replace(/^file:\/\//, ''));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function executeFrame(sourceUri: string, destination: File, seekSeconds: number): Promise<boolean> {
  if (destination.exists) destination.delete();
  const args = [
    '-y', '-ss', String(seekSeconds), '-i', filePath(sourceUri),
    '-frames:v', '1', '-vf', 'scale=720:-2:force_original_aspect_ratio=decrease',
    '-q:v', '4', '-an', filePath(destination.uri),
  ];
  const kit = FFmpegKit as unknown as {
    executeWithArguments?: (values: string[]) => Promise<unknown>;
    execute: (command: string) => Promise<unknown>;
  };
  const session = kit.executeWithArguments
    ? await kit.executeWithArguments(args)
    : await kit.execute(args.map(shellQuote).join(' '));
  const typedSession = session as { getReturnCode: () => Promise<unknown> };
  const returnCode = await typedSession.getReturnCode();
  return ReturnCode.isSuccess(returnCode as never) && destination.exists && destination.size > 0;
}

async function generate(mediaId: string, sourceUri: string): Promise<string | null> {
  const source = new File(sourceUri);
  if (!source.exists || source.size <= 0) return null;
  const directory = new Directory(Paths.document, 'sharing-thumbnails');
  await directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${mediaId}-first-frame.jpg`);
  if (destination.exists && destination.size > 0) return destination.uri;
  if (await executeFrame(sourceUri, destination, .35)) return destination.uri;
  if (await executeFrame(sourceUri, destination, .05)) return destination.uri;
  if (destination.exists) destination.delete();
  return null;
}

export function createSharingVideoThumbnail(mediaId: string, sourceUri: string): Promise<string | null> {
  const current = pending.get(mediaId);
  if (current) return current;
  const task = generate(mediaId, sourceUri).finally(() => pending.delete(mediaId));
  pending.set(mediaId, task);
  return task;
}
