import { StationMode } from '@prisma/client';

export interface AuthenticatedStation {
  sessionId: string;
  organizationId: string;
  eventId: string;
  deviceId: string;
  mode: StationMode;
}

export interface StationTokenPayload extends AuthenticatedStation {
  typ: 'station';
}
