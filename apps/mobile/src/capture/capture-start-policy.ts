export type CaptureStartSource = 'LOCAL_BUTTON' | 'REMOTE_COMMAND';

export function canStartCapture(source: CaptureStartSource): boolean {
  return source === 'LOCAL_BUTTON' || source === 'REMOTE_COMMAND';
}

export function isPendingRemoteCommand(
  commandVersion: number,
  acknowledgedVersion: number,
  handledVersion: number,
): boolean {
  return commandVersion > Math.max(acknowledgedVersion, handledVersion);
}
