import type { StationRedeemRequestContract, StationRedeemResponseContract } from '@khe/contracts';
import type { StationApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { PersistedStationContext } from '../offline/types';
import type { CredentialVault } from '../security/credential-vault';

export class StationBootstrapService {
  constructor(
    private readonly api: StationApi,
    private readonly store: LocalStore,
    private readonly vault: CredentialVault,
  ) {}

  async redeem(request: StationRedeemRequestContract): Promise<StationRedeemResponseContract> {
    await this.store.init();
    const response = await this.api.redeem(request);

    const persisted: PersistedStationContext = {
      session: response.session,
      installationId: request.installationId,
      mode: request.mode,
      savedAt: new Date().toISOString(),
    };

    // Save the credential in the platform secure store before exposing the session as active.
    await this.vault.saveStationToken(response.stationToken);
    await this.store.saveStation(persisted);
    await this.store.saveManifest(response.session.eventId, response.manifest);
    return response;
  }

  async refreshManifest(): Promise<void> {
    const station = await this.store.getStation();
    if (!station) throw new Error('Station not activated');
    const stationToken = await this.vault.getStationToken();
    if (!stationToken) throw new Error('Station credential unavailable');
    const manifest = await this.api.manifest(stationToken);
    await this.store.saveManifest(station.session.eventId, manifest);
  }

  async getCachedContext(): Promise<PersistedStationContext | null> {
    await this.store.init();
    return this.store.getStation();
  }
}
