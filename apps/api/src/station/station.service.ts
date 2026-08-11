import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StationJwtPayload } from './station.types';

@Injectable()
export class StationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly events: EventsService,
  ) {}

  async activate(code: string) {
    const now = new Date();
    const candidates = await this.prisma.eventActivation.findMany({
      where: {
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let matched = null as (typeof candidates)[number] | null;
    for (const candidate of candidates) {
      if (await argon2.verify(candidate.codeHash, code)) {
        matched = candidate;
        break;
      }
    }

    if (!matched) throw new UnauthorizedException('Invalid or expired activation code');

    const claimed = await this.prisma.eventActivation.updateMany({
      where: {
        id: matched.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new UnauthorizedException('Activation code already used');

    const tokenLifetime = Number(process.env.STATION_TOKEN_EXPIRES_IN_SECONDS ?? 604800);
    if (!Number.isFinite(tokenLifetime) || tokenLifetime <= 0) {
      throw new Error('STATION_TOKEN_EXPIRES_IN_SECONDS must be a positive number');
    }

    const payload: StationJwtPayload = {
      sub: matched.eventId,
      type: 'station',
      organizationId: matched.organizationId,
      eventId: matched.eventId,
      scope: 'CAPTURE',
    };

    const manifest = await this.events.manifest(matched.organizationId, matched.eventId);
    return {
      stationToken: this.jwt.sign(payload, { expiresIn: tokenLifetime }),
      manifest,
      activatedAt: new Date(),
    };
  }

  manifest(payload: StationJwtPayload) {
    return this.events.manifest(payload.organizationId, payload.eventId);
  }
}
