import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation, StationTokenPayload } from './station-auth.types';

interface StationRequest extends Request {
  station?: AuthenticatedStation;
}

@Injectable()
export class StationAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StationRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Station token required');

    let payload: StationTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<StationTokenPayload>(token);
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
        mode: payload.mode,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        device: { revokedAt: null },
      },
      select: { id: true },
    });
    if (!session) throw new UnauthorizedException('Station session expired or revoked');

    request.station = {
      sessionId: payload.sessionId,
      organizationId: payload.organizationId,
      eventId: payload.eventId,
      deviceId: payload.deviceId,
      mode: payload.mode,
    };
    return true;
  }
}
