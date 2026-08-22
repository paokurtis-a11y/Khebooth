export interface RecoverableNetworkState {
  isConnected?: boolean;
  isInternetReachable?: boolean;
}

export function shouldRecoverFromNetwork(state: RecoverableNetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export function shouldRecoverFromAppState(state: string): boolean {
  return state === 'active';
}
