import * as SecureStore from 'expo-secure-store';
import type { CredentialVault } from './credential-vault';

const STATION_TOKEN_KEY = 'khe.station.token.v1';
const INSTALLATION_ID_KEY = 'khe.installation.id.v1';
const EVENT_LOCK_PASSWORD_KEY = 'khe.event.lock.password.v1';
const STANDBY_LOCKED_KEY = 'khe.event.standby.locked.v1';
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

  saveEventLockPassword(password: string): Promise<void> {
    return SecureStore.setItemAsync(EVENT_LOCK_PASSWORD_KEY, password, DEVICE_ONLY_OPTIONS);
  }

  getEventLockPassword(): Promise<string | null> {
    return SecureStore.getItemAsync(EVENT_LOCK_PASSWORD_KEY);
  }

  clearEventLockPassword(): Promise<void> {
    return SecureStore.deleteItemAsync(EVENT_LOCK_PASSWORD_KEY);
  }

  saveStandbyLocked(locked: boolean): Promise<void> {
    return SecureStore.setItemAsync(STANDBY_LOCKED_KEY, locked ? '1' : '0', DEVICE_ONLY_OPTIONS);
  }

  async getStandbyLocked(): Promise<boolean> {
    return (await SecureStore.getItemAsync(STANDBY_LOCKED_KEY)) === '1';
  }
}
