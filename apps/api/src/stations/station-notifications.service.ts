import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

export type StationNotificationMailboxState = 'ACTIVE' | 'ARCHIVED' | 'TRASHED';
export type StationNotificationMailboxAction = 'READ' | 'KEEP' | 'ARCHIVE' | 'TRASH' | 'RESTORE';

type StationNotificationMailboxRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  actionUrl: string | null;
  publishedAt: Date;
  mailboxState: StationNotificationMailboxState;
  readAt: Date | null;
  archivedAt: Date | null;
  trashedAt: Date | null;
  purgeAt: Date | null;
};

const VALID_ACTIONS = new Set<StationNotificationMailboxAction>(['READ', 'KEEP', 'ARCHIVE', 'TRASH', 'RESTORE']);

@Injectable()
export class StationNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async purgeExpiredTrash(organizationId: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM "AppNotification" notification
      USING "StationNotificationMailbox" mailbox
      WHERE mailbox."notificationId" = notification.id
        AND mailbox."organizationId" = ${organizationId}::uuid
        AND notification."organizationId" = ${organizationId}::uuid
        AND mailbox.state = 'TRASHED'
        AND mailbox."trashedAt" IS NOT NULL
        AND mailbox."trashedAt" <= CURRENT_TIMESTAMP - INTERVAL '30 days'
    `);
  }

  async list(station: AuthenticatedStation): Promise<StationNotificationMailboxRow[]> {
    await this.purgeExpiredTrash(station.organizationId);
    return this.prisma.$queryRaw<StationNotificationMailboxRow[]>(Prisma.sql`
      SELECT
        notification.id,
        notification.kind::text AS kind,
        notification.title,
        notification.body,
        notification."actionUrl",
        notification."publishedAt",
        COALESCE(mailbox.state, 'ACTIVE')::text AS "mailboxState",
        mailbox."readAt",
        mailbox."archivedAt",
        mailbox."trashedAt",
        CASE
          WHEN mailbox.state = 'TRASHED' AND mailbox."trashedAt" IS NOT NULL
          THEN mailbox."trashedAt" + INTERVAL '30 days'
          ELSE NULL
        END AS "purgeAt"
      FROM "AppNotification" notification
      LEFT JOIN "StationNotificationMailbox" mailbox
        ON mailbox."notificationId" = notification.id
       AND mailbox."organizationId" = notification."organizationId"
      WHERE notification."organizationId" = ${station.organizationId}::uuid
      ORDER BY notification."publishedAt" DESC, notification."createdAt" DESC
      LIMIT 100
    `);
  }

  async update(station: AuthenticatedStation, notificationId: string, actionValue: unknown): Promise<StationNotificationMailboxRow> {
    await this.purgeExpiredTrash(station.organizationId);
    const action = String(actionValue ?? '').trim().toUpperCase() as StationNotificationMailboxAction;
    if (!VALID_ACTIONS.has(action)) throw new BadRequestException('Action de notification invalide');

    const owned = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM "AppNotification"
      WHERE id = ${notificationId}::uuid
        AND "organizationId" = ${station.organizationId}::uuid
      LIMIT 1
    `);
    if (!owned[0]) throw new NotFoundException('Notification introuvable');

    if (action === 'READ') {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "StationNotificationMailbox" ("organizationId", "notificationId", state, "readAt", "updatedAt")
        VALUES (${station.organizationId}::uuid, ${notificationId}::uuid, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("organizationId", "notificationId") DO UPDATE
        SET "readAt" = COALESCE("StationNotificationMailbox"."readAt", CURRENT_TIMESTAMP),
            "updatedAt" = CURRENT_TIMESTAMP
      `);
    } else if (action === 'ARCHIVE') {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "StationNotificationMailbox" ("organizationId", "notificationId", state, "readAt", "archivedAt", "trashedAt", "updatedAt")
        VALUES (${station.organizationId}::uuid, ${notificationId}::uuid, 'ARCHIVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT ("organizationId", "notificationId") DO UPDATE
        SET state = 'ARCHIVED',
            "readAt" = COALESCE("StationNotificationMailbox"."readAt", CURRENT_TIMESTAMP),
            "archivedAt" = CURRENT_TIMESTAMP,
            "trashedAt" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
      `);
    } else if (action === 'TRASH') {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "StationNotificationMailbox" ("organizationId", "notificationId", state, "readAt", "archivedAt", "trashedAt", "updatedAt")
        VALUES (${station.organizationId}::uuid, ${notificationId}::uuid, 'TRASHED', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("organizationId", "notificationId") DO UPDATE
        SET state = 'TRASHED',
            "readAt" = COALESCE("StationNotificationMailbox"."readAt", CURRENT_TIMESTAMP),
            "archivedAt" = NULL,
            "trashedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
      `);
    } else {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "StationNotificationMailbox" ("organizationId", "notificationId", state, "readAt", "archivedAt", "trashedAt", "updatedAt")
        VALUES (${station.organizationId}::uuid, ${notificationId}::uuid, 'ACTIVE', CURRENT_TIMESTAMP, NULL, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT ("organizationId", "notificationId") DO UPDATE
        SET state = 'ACTIVE',
            "readAt" = COALESCE("StationNotificationMailbox"."readAt", CURRENT_TIMESTAMP),
            "archivedAt" = NULL,
            "trashedAt" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
      `);
    }

    const rows = await this.prisma.$queryRaw<StationNotificationMailboxRow[]>(Prisma.sql`
      SELECT
        notification.id,
        notification.kind::text AS kind,
        notification.title,
        notification.body,
        notification."actionUrl",
        notification."publishedAt",
        mailbox.state::text AS "mailboxState",
        mailbox."readAt",
        mailbox."archivedAt",
        mailbox."trashedAt",
        CASE
          WHEN mailbox.state = 'TRASHED' AND mailbox."trashedAt" IS NOT NULL
          THEN mailbox."trashedAt" + INTERVAL '30 days'
          ELSE NULL
        END AS "purgeAt"
      FROM "AppNotification" notification
      JOIN "StationNotificationMailbox" mailbox
        ON mailbox."notificationId" = notification.id
       AND mailbox."organizationId" = notification."organizationId"
      WHERE notification.id = ${notificationId}::uuid
        AND notification."organizationId" = ${station.organizationId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('Notification introuvable');
    return rows[0];
  }
}
