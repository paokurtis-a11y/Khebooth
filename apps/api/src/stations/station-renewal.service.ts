import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StationMode } from '@prisma/client';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import type { StationTokenPayload } from './station-auth.types';

const RENEWED_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const RENEWAL_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class StationRenewalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly events: EventsService,
  ) {}

  async renew(authorization?: string) {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Station token required');

    let payload: StationTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<StationTokenPayload>(token, { ignoreExpiration: true });
    } catch {
      throw new UnauthorizedException('Invalid station token');
    }

    if (
      payload.typ !== 'station' ||
      !payload.sessionId ||
      !payload.organizationId ||
      !payload.eventId ||
      !payload.deviceId ||
      !payload.mode
    ) {
      throw new UnauthorizedException('Invalid station token');
    }

    const session = await this.prisma.stationSession.findFirst({
      where: {
        id: payload.sessionId,
        organizationId: payload.organizationId,
        eventId: payload.eventId,
        deviceId: payload.deviceId,
        mode: payload.mode as StationMode,
        revokedAt: null,
        device: { revokedAt: null },
      },
    });

    if (!session || session.expiresAt.getTime() < Date.now() - RENEWAL_GRACE_MS) {
      throw new UnauthorizedException('Station session expired or revoked');
    }

    const expiresAt = new Date(Date.now() + RENEWED_SESSION_TTL_SECONDS * 1000);
    const renewed = await this.prisma.stationSession.update({
      where: { id: session.id },
      data: { expiresAt },
    });

    // Rebuild the station claims instead of re-signing the verified JWT payload.
    // verifyAsync preserves registered claims such as exp/iat/sub, while signAsync
    // also receives a fresh expiresIn/subject below. Re-signing the full payload
    // therefore makes jsonwebtoken reject the token because exp is already present.
    const stationClaims: StationTokenPayload = {
      typ: 'station',
      sessionId: renewed.id,
      organizationId: renewed.organizationId,
      eventId: renewed.eventId,
      deviceId: renewed.deviceId,
      mode: renewed.mode,
    };

    const stationToken = await this.jwt.signAsync(stationClaims, {
      subject: renewed.id,
      expiresIn: RENEWED_SESSION_TTL_SECONDS,
    });
    const manifest = await this.events.manifest(renewed.organizationId, renewed.eventId);

    await this.prisma.auditLog.create({
      data: {
        organizationId: renewed.organizationId,
        action: 'STATION_RENEWED',
        entityType: 'StationSession',
        entityId: renewed.id,
        metadata: { eventId: renewed.eventId, deviceId: renewed.deviceId, mode: renewed.mode },
      },
    });

    return {
      stationToken,
      session: {
        id: renewed.id,
        organizationId: renewed.organizationId,
        eventId: renewed.eventId,
        deviceId: renewed.deviceId,
        mode: renewed.mode,
        expiresAt: renewed.expiresAt,
      },
      manifest,
    };
  }
}
