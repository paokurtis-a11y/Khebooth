import type { LivePreviewState } from './live-preview';

export function shouldHideCaptureControls(enabled: boolean, state: LivePreviewState): boolean {
  return enabled && state !== 'OFF' && state !== 'UNAVAILABLE' && state !== 'ERROR';
}
