import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { StationMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

export type SharingConnectionStatus = 'DISCONNECTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

type ConnectionStateRow = {
  sharingConnectionStatus: SharingConnectionStatus;
  sharingRequestedAt: Date | null;
  sharingRespondedAt: Date | null;
};

@Injectable()
export class StationConnectionService {
  constructor(private readonly prisma: PrismaService) {}

  async decorate<T extends { captureSeenAt: Date | null }>(station: AuthenticatedStation, control: T) {
    const state = await this.readState(station.eventId);
    const status = state?.sharingConnectionStatus ?? 'DISCONNECTED';
    return {
      ...control,
      sharingConnectionStatus: status,
      sharingRequestedAt: state?.sharingRequestedAt ?? null,
      sharingRespondedAt: state?.sharingRespondedAt ?? null,
      captureSeenAt: station.mode === StationMode.SHARING && status !== 'ACCEPTED' ? null : control.captureSeenAt,
    };
  }

  async request(station: AuthenticatedStation) {
    this.assertSharing(station);
    await this.ensureControl(station);
    await this.prisma.$executeRaw`
      UPDATE "StationRemoteControl"
      SET "sharingConnectionStatus" = CASE
            WHEN "sharingConnectionStatus" = 'ACCEPTED' THEN 'ACCEPTED'
            ELSE 'PENDING'
          END,
          "sharingRequestedAt" = CASE
            WHEN "sharingConnectionStatus" = 'ACCEPTED' THEN "sharingRequestedAt"
            ELSE CURRENT_TIMESTAMP
          END,
          "sharingRespondedAt" = CASE
            WHEN "sharingConnectionStatus" = 'ACCEPTED' THEN "sharingRespondedAt"
            ELSE NULL
          END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "eventId" = ${station.eventId}::uuid
        AND "organizationId" = ${station.organizationId}::uuid
    `;
    return this.readDecorated(station);
  }

  async respond(station: AuthenticatedStation, accepted: unknown) {
    this.assertCapture(station);
    if (typeof accepted !== 'boolean') {
      throw new BadRequestException('accepted must be a boolean');
    }
    await this.ensureControl(station);
    const changed = await this.prisma.$executeRaw`
      UPDATE "StationRemoteControl"
      SET "sharingConnectionStatus" = ${accepted ? 'ACCEPTED' : 'REJECTED'},
          "sharingRespondedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "eventId" = ${station.eventId}::uuid
        AND "organizationId" = ${station.organizationId}::uuid
        AND "sharingConnectionStatus" = 'PENDING'
    `;
    if (!changed) throw new BadRequestException('No pending SHARING connection request');
    return this.readDecorated(station);
  }

  async disconnect(station: AuthenticatedStation) {
    this.assertSharing(station);
    await this.ensureControl(station);
    await this.prisma.$executeRaw`
      UPDATE "StationRemoteControl"
      SET "sharingConnectionStatus" = 'DISCONNECTED',
          "sharingRespondedAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "eventId" = ${station.eventId}::uuid
        AND "organizationId" = ${station.organizationId}::uuid
    `;
    return this.readDecorated(station);
  }

  private async readDecorated(station: AuthenticatedStation) {
    const control = await this.prisma.stationRemoteControl.findUnique({ where: { eventId: station.eventId } });
    if (!control) throw new BadRequestException('Station control state is not initialized');
    return this.decorate(station, control);
  }

  private async ensureControl(station: AuthenticatedStation) {
    return this.prisma.stationRemoteControl.upsert({
      where: { eventId: station.eventId },
      create: { organizationId: station.organizationId, eventId: station.eventId },
      update: {},
    });
  }

  private async readState(eventId: string): Promise<ConnectionStateRow | null> {
    const rows = await this.prisma.$queryRaw<ConnectionStateRow[]>`
      SELECT
        "sharingConnectionStatus",
        "sharingRequestedAt",
        "sharingRespondedAt"
      FROM "StationRemoteControl"
      WHERE "eventId" = ${eventId}::uuid
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  private assertCapture(station: AuthenticatedStation) {
    if (station.mode !== StationMode.CAPTURE) throw new ForbiddenException('Only a Capture station can answer a SHARING connection request');
  }

  private assertSharing(station: AuthenticatedStation) {
    if (station.mode !== StationMode.SHARING) throw new ForbiddenException('Only a Sharing station can request or close a CAPTURE connection');
  }
}
