import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { StationJwtPayload } from './station.types';

@Injectable()
export class StationJwtStrategy extends PassportStrategy(Strategy, 'station-jwt') {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: StationJwtPayload): Promise<StationJwtPayload> {
    if (payload.type !== 'station' || payload.scope !== 'CAPTURE') {
      throw new UnauthorizedException();
    }

    const event = await this.prisma.event.findFirst({
      where: { id: payload.eventId, organizationId: payload.organizationId },
      select: { id: true },
    });
    if (!event) throw new UnauthorizedException();

    return payload;
  }
}
