export type CaptureStartSource = 'LOCAL_BUTTON' | 'REMOTE_COMMAND';

export function canStartCapture(source: CaptureStartSource): boolean {
  return source === 'LOCAL_BUTTON';
}
