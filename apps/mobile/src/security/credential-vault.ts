export interface CredentialVault {
  saveStationToken(token: string): Promise<void>;
  getStationToken(): Promise<string | null>;
  clearStationToken(): Promise<void>;
}
