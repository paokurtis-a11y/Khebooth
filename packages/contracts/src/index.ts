export const USER_ROLES = ['OWNER', 'ADMIN', 'OPERATOR', 'SHARE_HOST'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EVENT_STATUSES = ['DRAFT', 'READY', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const ASPECT_RATIOS = ['9:16', '1:1'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export interface AuthUserContract {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
}

export interface LoginResponseContract {
  accessToken: string;
  user: AuthUserContract;
}

export interface EventManifestContract {
  version: 1;
  event: {
    id: string;
    name: string;
    startsAt: string | Date;
    endsAt: string | Date | null;
    venueName: string | null;
    venueAddress: string | null;
    status: EventStatus;
  };
  preset: {
    id: string;
    name: string;
    aspectRatio: 'PORTRAIT_9_16' | 'SQUARE_1_1';
    configuration: unknown;
  } | null;
  organization: {
    id: string;
    name: string;
  } | null;
  capabilities: {
    capture: true;
    sharing: true;
    formats: AspectRatio[];
  };
}

export interface CaptureStationActivationRequestContract {
  code: string;
}

export interface CaptureStationActivationResponseContract {
  stationToken: string;
  manifest: EventManifestContract;
  activatedAt: string | Date;
}
