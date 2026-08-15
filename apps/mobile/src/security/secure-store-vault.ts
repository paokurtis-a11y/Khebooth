import * as SecureStore from 'expo-secure-store';
import type { CredentialVault } from './credential-vault';

const STATION_TOKEN_KEY = 'khe.station.token.v1';

export class SecureStoreCredentialVault implements CredentialVault {
  saveStationToken(token: string): Promise<void> {
    return SecureStore.setItemAsync(STATION_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  }

  getStationToken(): Promise<string | null> {
    return SecureStore.getItemAsync(STATION_TOKEN_KEY);
  }

  clearStationToken(): Promise<void> {
    return SecureStore.deleteItemAsync(STATION_TOKEN_KEY);
  }
}
