import type { CredentialVault } from './credential-vault';

export class MemoryCredentialVault implements CredentialVault {
  private token: string | null = null;

  async saveStationToken(token: string): Promise<void> {
    this.token = token;
  }

  async getStationToken(): Promise<string | null> {
    return this.token;
  }

  async clearStationToken(): Promise<void> {
    this.token = null;
  }
}
