import type { StationApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { SharedMediaRecord } from '../offline/types';

export class SharingCatalogService {
  constructor(
    private readonly api: StationApi,
    private readonly store: LocalStore,
  ) {}

  async refresh(): Promise<SharedMediaRecord[]> {
    await this.store.init();
    const station = await this.store.getStation();
    if (!station) throw new Error('Station not activated');
    if (station.mode !== 'SHARING') throw new Error('Sharing catalog is only available on SHARING stations');

    const remote = await this.api.listMedia(station.stationToken);
    const now = new Date().toISOString();
    const synced = remote
      .filter((item) => item.syncState === 'SYNCED' && item.acknowledgedAt)
      .map<SharedMediaRecord>((item) => ({
        id: item.id,
        eventId: item.eventId,
        localId: item.localId,
        contentHash: item.contentHash,
        byteSize: item.byteSize,
        mimeType: item.mimeType,
        capturedAt: item.capturedAt ? new Date(item.capturedAt).toISOString() : null,
        acknowledgedAt: new Date(item.acknowledgedAt as string | Date).toISOString(),
        cachedAt: now,
      }));

    await this.store.replaceSharedMedia(station.session.eventId, synced);
    return synced;
  }

  async cached(): Promise<SharedMediaRecord[]> {
    await this.store.init();
    const station = await this.store.getStation();
    if (!station) return [];
    return this.store.listSharedMedia(station.session.eventId);
  }
}
