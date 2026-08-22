import type * as Network from 'expo-network';
import type { AppSettings } from './app-settings';

export type SyncNetworkDecision = 'ALLOW' | 'PROMPT_CELLULAR' | 'WAIT_FOR_WIFI' | 'OFFLINE';

export interface NetworkPolicyState {
  type: Network.NetworkStateType | null | undefined;
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}

export function evaluateSyncNetwork(
  settings: Pick<AppSettings, 'wifiPreferred' | 'askBeforeMobileData'>,
  state: NetworkPolicyState,
  cellularApproved: boolean,
): SyncNetworkDecision {
  if (state.isConnected === false || state.isInternetReachable === false || state.type === null || state.type === undefined) return 'OFFLINE';
  if (state.type !== ('CELLULAR' as Network.NetworkStateType)) return 'ALLOW';
  if (cellularApproved) return 'ALLOW';
  if (settings.askBeforeMobileData) return 'PROMPT_CELLULAR';
  if (settings.wifiPreferred) return 'WAIT_FOR_WIFI';
  return 'ALLOW';
}

export function shouldImmediateReconnect(autoReconnectStations: boolean, becameUsable: boolean): boolean {
  return autoReconnectStations && becameUsable;
}
