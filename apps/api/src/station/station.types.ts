export type StationScope = 'CAPTURE' | 'SHARING';

export interface StationJwtPayload {
  sub: string;
  type: 'station';
  organizationId: string;
  eventId: string;
  scope: StationScope;
}
