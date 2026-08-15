import * as SecureStore from 'expo-secure-store';
import type { CredentialVault } from './credential-vault';

const STATION_TOKEN_KEY = 'khe.station.token.v1';
const INSTALLATION_ID_KEY = 'khe.installation.id.v1';
const DEVICE_ONLY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class SecureStoreCredentialVault implements CredentialVault {
  saveStationToken(token: string): Promise<void> {
    return SecureStore.setItemAsync(STATION_TOKEN_KEY, token, DEVICE_ONLY_OPTIONS);
  }

  getStationToken(): Promise<string | null> {
    return SecureStore.getItemAsync(STATION_TOKEN_KEY);
  }

  clearStationToken(): Promise<void> {
    return SecureStore.deleteItemAsync(STATION_TOKEN_KEY);
  }

  saveInstallationId(installationId: string): Promise<void> {
    return SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId, DEVICE_ONLY_OPTIONS);
  }

  getInstallationId(): Promise<string | null> {
    return SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  }
}
