import type { StationRedeemRequestContract, StationRedeemResponseContract } from '@khe/contracts';
import type { StationApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { PersistedStationContext } from '../offline/types';

export class StationBootstrapService {
  constructor(
    private readonly api: StationApi,
    private readonly store: LocalStore,
  ) {}

  async redeem(request: StationRedeemRequestContract): Promise<StationRedeemResponseContract> {
    await this.store.init();
    const response = await this.api.redeem(request);

    const persisted: PersistedStationContext = {
      stationToken: response.stationToken,
      session: response.session,
      installationId: request.installationId,
      mode: request.mode,
      savedAt: new Date().toISOString(),
    };

    await this.store.saveStation(persisted);
    await this.store.saveManifest(response.session.eventId, response.manifest);
    return response;
  }

  async refreshManifest(): Promise<void> {
    const station = await this.store.getStation();
    if (!station) throw new Error('Station not activated');
    const manifest = await this.api.manifest(station.stationToken);
    await this.store.saveManifest(station.session.eventId, manifest);
  }

  async getCachedContext(): Promise<PersistedStationContext | null> {
    await this.store.init();
    return this.store.getStation();
  }
}
