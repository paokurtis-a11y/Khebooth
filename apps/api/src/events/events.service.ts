import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as argon2 from 'argon2';
import { EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  list(organizationId: string) {
    return this.prisma.event.findMany({
      where: { organizationId },
      include: { client: true, preset: true },
      orderBy: { startsAt: 'desc' },
    });
  }

  async get(organizationId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, organizationId },
      include: { client: true, preset: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async create(organizationId: string, userId: string, dto: CreateEventDto) {
    await this.assertRelations(organizationId, dto.clientId, dto.presetId);
    if (dto.endsAt && new Date(dto.endsAt) < new Date(dto.startsAt)) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    const event = await this.prisma.event.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        clientId: dto.clientId,
        presetId: dto.presetId,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        venueName: dto.venueName,
        venueAddress: dto.venueAddress,
        status: dto.status ?? EventStatus.DRAFT,
      },
    });
    await this.audit(organizationId, userId, 'EVENT_CREATED', event.id);
    return event;
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateEventDto) {
    const current = await this.get(organizationId, id);
    await this.assertRelations(organizationId, dto.clientId, dto.presetId);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    if (endsAt && endsAt < startsAt) throw new BadRequestException('endsAt must be after startsAt');

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
    await this.audit(organizationId, userId, 'EVENT_UPDATED', id);
    return event;
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.get(organizationId, id);
    await this.prisma.event.delete({ where: { id } });
    await this.audit(organizationId, userId, 'EVENT_DELETED', id);
    return { deleted: true };
  }

  async activate(organizationId: string, userId: string, id: string) {
    const event = await this.get(organizationId, id);
    const access = await this.entitlements.forEvent(organizationId, id);
    if (access.clientId && access.maxActiveEvents !== null && event.status !== EventStatus.ACTIVE) {
      const activeCount = await this.prisma.event.count({
        where: {
          organizationId,
          clientId: access.clientId,
          status: EventStatus.ACTIVE,
          id: { not: id },
        },
      });
      if (activeCount >= access.maxActiveEvents) {
        throw new ForbiddenException(
          `Le forfait ${access.plan} autorise au maximum ${access.maxActiveEvents} événement(s) actif(s). Passez au forfait supérieur pour en activer davantage.`,
        );
      }
    }

    const rawCode = `KHE-${randomInt(100000, 1000000)}`;
    const codeHash = await argon2.hash(rawCode);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.eventActivation.updateMany({
        where: { organizationId, eventId: id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      }),
      this.prisma.eventActivation.create({
        data: { organizationId, eventId: id, codeHash, expiresAt },
      }),
      this.prisma.event.update({ where: { id }, data: { status: EventStatus.ACTIVE } }),
      this.prisma.auditLog.create({
        data: { organizationId, userId, action: 'EVENT_ACTIVATED', entityType: 'Event', entityId: id },
      }),
    ]);

    return { code: rawCode, expiresAt };
  }

  async manifest(organizationId: string, id: string) {
    const event = await this.get(organizationId, id);
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    return {
      version: 1 as const,
      generatedAt: new Date(),
      organization,
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        status: event.status,
      },
      client: event.client
        ? {
            id: event.client.id,
            name: event.client.name,
            companyName: event.client.companyName,
          }
        : null,
      preset: event.preset
        ? {
            id: event.preset.id,
            name: event.preset.name,
            aspectRatio: event.preset.aspectRatio,
            configuration: event.preset.configuration,
          }
        : null,
      capabilities: {
        capture: true as const,
        sharing: true as const,
        separateStations: true as const,
        formats: ['9:16', '1:1'] as const,
      },
      mediaPolicy: {
        offlineFirst: true as const,
        preserveUnsyncedMedia: true as const,
        idempotentUploads: true as const,
        resumableUploads: true as const,
        export: {
          container: 'MP4' as const,
          videoCodec: 'H.264' as const,
          audioCodec: 'AAC' as const,
        },
      },
    };
  }

  private async assertRelations(organizationId: string, clientId?: string, presetId?: string) {
    if (clientId) {
      const client = await this.prisma.client.findFirst({ where: { id: clientId, organizationId }, select: { id: true } });
      if (!client) throw new BadRequestException('Invalid clientId');
    }
    if (presetId) {
      const preset = await this.prisma.preset.findFirst({ where: { id: presetId, organizationId }, select: { id: true } });
      if (!preset) throw new BadRequestException('Invalid presetId');
    }
  }

  private audit(organizationId: string, userId: string, action: string, entityId: string) {
    return this.prisma.auditLog.create({
      data: { organizationId, userId, action, entityType: 'Event', entityId },
    });
  }
}
