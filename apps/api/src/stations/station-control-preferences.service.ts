import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { StationMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

export type StationCaptureKind = 'PHOTO' | 'VIDEO';
export type StationCaptureAspectRatio = '9:16' | '1:1';
export type StationCountdownSeconds = 0 | 3 | 5 | 10;

export interface StationControlPreferences {
  captureKind: StationCaptureKind;
  aspectRatio: StationCaptureAspectRatio;
  countdownSeconds: StationCountdownSeconds;
  updatedAt: Date;
}

type PreferenceRow = StationControlPreferences;

type PreferencePatch = {
  captureKind?: StationCaptureKind;
  aspectRatio?: StationCaptureAspectRatio;
  countdownSeconds?: StationCountdownSeconds;
};

const CAPTURE_KINDS = new Set<StationCaptureKind>(['PHOTO', 'VIDEO']);
const ASPECT_RATIOS = new Set<StationCaptureAspectRatio>(['9:16', '1:1']);
const COUNTDOWNS = new Set<StationCountdownSeconds>([0, 3, 5, 10]);

@Injectable()
export class StationControlPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(station: AuthenticatedStation): Promise<StationControlPreferences> {
    await this.ensure(station);
    const rows = await this.prisma.$queryRaw<PreferenceRow[]>`
      SELECT "captureKind", "aspectRatio", "countdownSeconds", "updatedAt"
      FROM "StationControlPreference"
      WHERE "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) throw new BadRequestException('Capture preferences are unavailable');
    return row;
  }

  async updateFromSharing(station: AuthenticatedStation, body: Record<string, unknown>) {
    if (station.mode !== StationMode.SHARING) throw new ForbiddenException('Only SHARING can command capture preferences');
    return this.update(station, this.parsePatch(body));
  }

  async updateFromCapture(station: AuthenticatedStation, body: Record<string, unknown>) {
    if (station.mode !== StationMode.CAPTURE) throw new ForbiddenException('Only CAPTURE can publish local capture preferences');
    return this.update(station, this.parsePatch(body));
  }

  private async update(station: AuthenticatedStation, patch: PreferencePatch) {
    if (Object.keys(patch).length === 0) throw new BadRequestException('At least one capture preference is required');
    await this.ensure(station);
    if (patch.captureKind !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE "StationControlPreference"
        SET "captureKind"=${patch.captureKind}, "updatedAt"=CURRENT_TIMESTAMP
        WHERE "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid
      `;
    }
    if (patch.aspectRatio !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE "StationControlPreference"
        SET "aspectRatio"=${patch.aspectRatio}, "updatedAt"=CURRENT_TIMESTAMP
        WHERE "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid
      `;
    }
    if (patch.countdownSeconds !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE "StationControlPreference"
        SET "countdownSeconds"=${patch.countdownSeconds}, "updatedAt"=CURRENT_TIMESTAMP
        WHERE "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid
      `;
    }
    return this.get(station);
  }

  private async ensure(station: AuthenticatedStation): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "StationControlPreference" ("organizationId", "eventId")
      VALUES (${station.organizationId}::uuid, ${station.eventId}::uuid)
      ON CONFLICT ("eventId") DO NOTHING
    `;
  }

  private parsePatch(body: Record<string, unknown>): PreferencePatch {
    const patch: PreferencePatch = {};
    if (body.captureKind !== undefined) {
      if (typeof body.captureKind !== 'string' || !CAPTURE_KINDS.has(body.captureKind as StationCaptureKind)) {
        throw new BadRequestException('captureKind must be PHOTO or VIDEO');
      }
      patch.captureKind = body.captureKind as StationCaptureKind;
    }
    if (body.aspectRatio !== undefined) {
      if (typeof body.aspectRatio !== 'string' || !ASPECT_RATIOS.has(body.aspectRatio as StationCaptureAspectRatio)) {
        throw new BadRequestException('aspectRatio must be 9:16 or 1:1');
      }
      patch.aspectRatio = body.aspectRatio as StationCaptureAspectRatio;
    }
    if (body.countdownSeconds !== undefined) {
      if (typeof body.countdownSeconds !== 'number' || !COUNTDOWNS.has(body.countdownSeconds as StationCountdownSeconds)) {
        throw new BadRequestException('countdownSeconds must be 0, 3, 5 or 10');
      }
      patch.countdownSeconds = body.countdownSeconds as StationCountdownSeconds;
    }
    return patch;
  }
}
