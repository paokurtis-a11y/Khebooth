import type { StationControlContract, StationControlPreferencesContract } from '@khe/contracts';

export const CAPTURE_COMMAND_POLL_MS = 400;
export const SHARING_STATUS_POLL_MS = 500;
export const REMOTE_CONTROL_RETRY_MS = 2_000;
export const CAPTURE_HEARTBEAT_MS = 1_000;

export function preferencesFromControl(
  control: StationControlContract,
  fallback: StationControlPreferencesContract,
): StationControlPreferencesContract {
  return control.preferences ?? fallback;
}

export function hasPendingCommand(control: StationControlContract): boolean {
  return control.commandVersion > control.acknowledgedVersion;
}
