import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

@Injectable()
export class StationNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(station: AuthenticatedStation) {
    return this.prisma.appNotification.findMany({
      where: { organizationId: station.organizationId },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        actionUrl: true,
        publishedAt: true,
      },
    });
  }
}
