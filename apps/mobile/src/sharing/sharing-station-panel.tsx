import type { StationApi } from '../api/station-api';
import { RemoteControlPanel } from './remote-control-panel';
import { SharingMediaGallery } from './sharing-media-gallery';

interface SharingStationPanelProps {
  eventName: string;
  api: StationApi;
  stationToken: string;
}

export function SharingStationPanel({ eventName, api, stationToken }: SharingStationPanelProps) {
  return (
    <>
      <RemoteControlPanel eventName={eventName} api={api} stationToken={stationToken} />
      <SharingMediaGallery eventName={eventName} api={api} stationToken={stationToken} />
    </>
  );
}
