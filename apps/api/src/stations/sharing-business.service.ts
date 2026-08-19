import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MediaSyncState, StationMode } from '@prisma/client';
import { del, head, issueSignedToken, presignUrl } from '@vercel/blob';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

const SOCIAL_PROVIDERS = ['WHATSAPP', 'TIKTOK', 'FACEBOOK', 'INSTAGRAM', 'X', 'TELEGRAM', 'YOUTUBE'] as const;
type SocialProvider = typeof SOCIAL_PROVIDERS[number];
type GalleryLayout = 'MASONRY' | 'GRID' | 'COMPACT';
type MediaFit = 'COVER' | 'CONTAIN';

const DEFAULT_SOCIAL_BASE_URL = 'https://khebooth.vercel.app';
const DOWNLOAD_TICKET_TTL_MS = 10 * 60 * 1000;

interface SettingsRow {
  socialLinks: Record<string, string>;
  galleryLayout: GalleryLayout;
  portraitColumns: number;
  landscapeColumns: number;
  videoAutoplay: boolean;
  mediaFit: MediaFit;
  updatedAt: Date;
}

interface SocialSessionRow {
  id: string;
  provider: SocialProvider;
  status: string;
  organizationId: string;
  eventId: string;
  mediaAssetId: string;
  mimeType: string;
  byteSize: number;
  capturedAt: Date | null;
  eventName: string;
  socialLinks: Record<string, string> | null;
  deliveryConsentAt: Date | null;
  publishConsentAt: Date | null;
  marketingConsentAt: Date | null;
  followVerificationStatus: string;
  mediaDeliveredAt: Date | null;
  publishedAt: Date | null;
  likePromptDueAt: Date | null;
  commentPromptDueAt: Date | null;
  revokedAt: Date | null;
}

@Injectable()
export class SharingBusinessService {
  constructor(private readonly prisma: PrismaService) {}

  async settings(station: AuthenticatedStation) {
    this.assertSharing(station);
    const rows = await this.prisma.$queryRaw<SettingsRow[]>`
      INSERT INTO "SharingBusinessSettings" ("organizationId", "eventId")
      VALUES (${station.organizationId}::uuid, ${station.eventId}::uuid)
      ON CONFLICT ("eventId") DO UPDATE SET "eventId" = EXCLUDED."eventId"
      RETURNING "socialLinks", "galleryLayout", "portraitColumns", "landscapeColumns", "videoAutoplay", "mediaFit", "updatedAt"
    `;
    return this.decorateSettings(rows[0]);
  }

  async updateSettings(station: AuthenticatedStation, body: Record<string, unknown>) {
    this.assertSharing(station);
    const current = await this.settings(station);
    const socialLinks = this.normalizeSocialLinks(body.socialLinks ?? current.socialLinks);
    const galleryLayout = this.galleryLayout(body.galleryLayout ?? current.galleryLayout);
    const portraitColumns = this.integerBetween(body.portraitColumns ?? current.portraitColumns, 1, 4, 'portraitColumns');
    const landscapeColumns = this.integerBetween(body.landscapeColumns ?? current.landscapeColumns, 1, 6, 'landscapeColumns');
    const videoAutoplay = typeof body.videoAutoplay === 'boolean' ? body.videoAutoplay : current.videoAutoplay;
    const mediaFit = this.mediaFit(body.mediaFit ?? current.mediaFit);

    const rows = await this.prisma.$queryRaw<SettingsRow[]>`
      INSERT INTO "SharingBusinessSettings" (
        "organizationId", "eventId", "socialLinks", "galleryLayout", "portraitColumns", "landscapeColumns", "videoAutoplay", "mediaFit", "updatedAt"
      ) VALUES (
        ${station.organizationId}::uuid, ${station.eventId}::uuid, ${JSON.stringify(socialLinks)}::jsonb,
        ${galleryLayout}, ${portraitColumns}, ${landscapeColumns}, ${videoAutoplay}, ${mediaFit}, CURRENT_TIMESTAMP
      )
      ON CONFLICT ("eventId") DO UPDATE SET
        "socialLinks" = EXCLUDED."socialLinks",
        "galleryLayout" = EXCLUDED."galleryLayout",
        "portraitColumns" = EXCLUDED."portraitColumns",
        "landscapeColumns" = EXCLUDED."landscapeColumns",
        "videoAutoplay" = EXCLUDED."videoAutoplay",
        "mediaFit" = EXCLUDED."mediaFit",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "socialLinks", "galleryLayout", "portraitColumns", "landscapeColumns", "videoAutoplay", "mediaFit", "updatedAt"
    `;
    return this.decorateSettings(rows[0]);
  }

  async createSocialShare(station: AuthenticatedStation, mediaId: string, providerValue: unknown) {
    this.assertSharing(station);
    const provider = this.provider(providerValue);
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, organizationId: station.organizationId, eventId: station.eventId },
    });
    if (!media) throw new NotFoundException('Media asset not found');
    if (media.syncState !== MediaSyncState.SYNCED || !media.acknowledgedAt) {
      throw new BadRequestException('Only synchronized media can be shared');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; createdAt: Date }>>`
      INSERT INTO "SocialDeliverySession" (
        "organizationId", "eventId", "mediaAssetId", "provider", "tokenHash"
      ) VALUES (
        ${station.organizationId}::uuid, ${station.eventId}::uuid, ${media.id}::uuid, ${provider}, ${tokenHash}
      )
      RETURNING "id", "createdAt"
    `;
    const created = rows[0];
    if (!created) throw new ServiceUnavailableException('Unable to create social delivery session');
    const baseUrl = (process.env.PUBLIC_SOCIAL_BASE_URL?.trim() || DEFAULT_SOCIAL_BASE_URL).replace(/\/$/, '');
    return {
      id: created.id,
      mediaId: media.id,
      provider,
      shareUrl: `${baseUrl}/social/${token}`,
      createdAt: created.createdAt,
      capability: this.capability(provider),
    };
  }

  async resolvePublicSocial(token: string) {
    const session = await this.socialSession(token);
    await this.prisma.$executeRaw`
      UPDATE "SocialDeliverySession"
      SET "status" = CASE WHEN "status" = 'CREATED' THEN 'OPENED' ELSE "status" END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${session.id}::uuid
    `;
    const socialLinks = session.socialLinks ?? {};
    return {
      id: session.id,
      provider: session.provider,
      eventName: session.eventName,
      mimeType: session.mimeType,
      capturedAt: session.capturedAt,
      accountUrl: socialLinks[session.provider] ?? '',
      capability: this.capability(session.provider),
      consent: {
        delivery: Boolean(session.deliveryConsentAt),
        publication: Boolean(session.publishConsentAt),
        marketing: Boolean(session.marketingConsentAt),
      },
      followVerificationStatus: session.followVerificationStatus,
    };
  }

  async updatePublicConsent(token: string, body: Record<string, unknown>) {
    const session = await this.socialSession(token);
    const delivery = body.delivery === true;
    const publication = body.publication === true;
    const marketing = body.marketing === true;
    if (!delivery) throw new BadRequestException('Media delivery consent is required');

    const now = new Date();
    const likeDueAt = publication ? new Date(now.getTime() + 30 * 60 * 1000) : null;
    const commentDueAt = publication ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : null;
    await this.prisma.$executeRaw`
      UPDATE "SocialDeliverySession"
      SET "deliveryConsentAt" = COALESCE("deliveryConsentAt", ${now}),
          "publishConsentAt" = CASE WHEN ${publication} THEN COALESCE("publishConsentAt", ${now}) ELSE NULL END,
          "marketingConsentAt" = CASE WHEN ${marketing} THEN COALESCE("marketingConsentAt", ${now}) ELSE NULL END,
          "likePromptDueAt" = CASE WHEN ${publication} THEN COALESCE("likePromptDueAt", ${likeDueAt}) ELSE NULL END,
          "commentPromptDueAt" = CASE WHEN ${publication} THEN COALESCE("commentPromptDueAt", ${commentDueAt}) ELSE NULL END,
          "status" = 'DELIVERY_REQUESTED',
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${session.id}::uuid AND "revokedAt" IS NULL
    `;

    const download = await this.publicDownloadTicket(session);
    return {
      ...download,
      provider: session.provider,
      accountUrl: (session.socialLinks ?? {})[session.provider] ?? '',
      capability: this.capability(session.provider),
      consent: { delivery: true, publication, marketing },
      reminders: { likeDueAt, commentDueAt },
    };
  }

  async deleteMedia(station: AuthenticatedStation, mediaId: string) {
    this.assertSharing(station);
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, organizationId: station.organizationId, eventId: station.eventId },
    });
    if (!media) throw new NotFoundException('Media asset not found');
    const pathname = this.pathnameFor(media);
    try {
      await del(pathname);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Blob deletion failed';
      console.error('[blob][sharing-delete] failed:', detail);
      throw new ServiceUnavailableException(`Media deletion unavailable: ${detail}`);
    }
    await this.prisma.mediaAsset.delete({ where: { id: media.id } });
    return { id: media.id, deleted: true };
  }

  private async socialSession(token: string): Promise<SocialSessionRow> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new NotFoundException('Social share not found');
    const tokenHash = this.hashToken(token);
    const rows = await this.prisma.$queryRaw<SocialSessionRow[]>`
      SELECT
        s."id", s."provider", s."status", s."organizationId", s."eventId", s."mediaAssetId",
        s."deliveryConsentAt", s."publishConsentAt", s."marketingConsentAt", s."followVerificationStatus",
        s."mediaDeliveredAt", s."publishedAt", s."likePromptDueAt", s."commentPromptDueAt", s."revokedAt",
        m."mimeType", m."byteSize", m."capturedAt", e."name" AS "eventName",
        COALESCE(b."socialLinks", '{}'::jsonb) AS "socialLinks"
      FROM "SocialDeliverySession" s
      INNER JOIN "MediaAsset" m ON m."id" = s."mediaAssetId"
      INNER JOIN "Event" e ON e."id" = s."eventId"
      LEFT JOIN "SharingBusinessSettings" b ON b."eventId" = s."eventId"
      WHERE s."tokenHash" = ${tokenHash}
        AND s."revokedAt" IS NULL
        AND m."syncState" = 'SYNCED'
        AND m."acknowledgedAt" IS NOT NULL
      LIMIT 1
    `;
    const session = rows[0];
    if (!session) throw new NotFoundException('Social share not found');
    return session;
  }

  private async publicDownloadTicket(session: SocialSessionRow) {
    const pathname = this.pathnameFor({
      organizationId: session.organizationId,
      eventId: session.eventId,
      id: session.mediaAssetId,
      mimeType: session.mimeType,
    });
    try {
      const blob = await head(pathname);
      if (blob.size !== session.byteSize || blob.contentType !== session.mimeType) {
        throw new BadRequestException('Stored media verification failed');
      }
      const expiresAtMs = Date.now() + DOWNLOAD_TICKET_TTL_MS;
      const signedToken = await issueSignedToken({ pathname, operations: ['get'], validUntil: expiresAtMs });
      const { presignedUrl } = await presignUrl(signedToken, {
        access: 'private', pathname, operation: 'get', validUntil: expiresAtMs,
      });
      return { mediaId: session.mediaAssetId, downloadUrl: presignedUrl, expiresAt: new Date(expiresAtMs) };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const detail = error instanceof Error ? error.message : 'Blob access failed';
      throw new ServiceUnavailableException(`Media storage unavailable: ${detail}`);
    }
  }

  private capability(provider: SocialProvider) {
    const messageDelivery = provider === 'WHATSAPP' || provider === 'TELEGRAM' || provider === 'X' || provider === 'FACEBOOK' || provider === 'INSTAGRAM';
    const directPublishing = provider !== 'WHATSAPP' && provider !== 'TELEGRAM';
    const followVerification = provider === 'TELEGRAM' ? 'SUPPORTED_WHEN_BOT_IS_ADMIN' : 'PROVIDER_DEPENDENT';
    return { messageDelivery, directPublishing, followVerification };
  }

  private decorateSettings(row: SettingsRow | undefined) {
    return {
      socialLinks: row?.socialLinks ?? {},
      galleryLayout: row?.galleryLayout ?? 'MASONRY',
      portraitColumns: row?.portraitColumns ?? 2,
      landscapeColumns: row?.landscapeColumns ?? 3,
      videoAutoplay: row?.videoAutoplay ?? true,
      mediaFit: row?.mediaFit ?? 'COVER',
      updatedAt: row?.updatedAt ?? new Date(),
    };
  }

  private normalizeSocialLinks(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('socialLinks must be an object');
    const source = value as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const provider of SOCIAL_PROVIDERS) {
      const raw = source[provider];
      if (raw === undefined || raw === null || raw === '') continue;
      if (typeof raw !== 'string' || raw.length > 500) throw new BadRequestException(`Invalid social link for ${provider}`);
      let parsed: URL;
      try { parsed = new URL(raw); } catch { throw new BadRequestException(`Invalid social URL for ${provider}`); }
      if (parsed.protocol !== 'https:') throw new BadRequestException(`Social URL for ${provider} must use HTTPS`);
      result[provider] = parsed.toString();
    }
    return result;
  }

  private provider(value: unknown): SocialProvider {
    if (typeof value !== 'string' || !SOCIAL_PROVIDERS.includes(value as SocialProvider)) {
      throw new BadRequestException('Unsupported social provider');
    }
    return value as SocialProvider;
  }

  private galleryLayout(value: unknown): GalleryLayout {
    if (value === 'MASONRY' || value === 'GRID' || value === 'COMPACT') return value;
    throw new BadRequestException('Unsupported gallery layout');
  }

  private mediaFit(value: unknown): MediaFit {
    if (value === 'COVER' || value === 'CONTAIN') return value;
    throw new BadRequestException('Unsupported media fit');
  }

  private integerBetween(value: unknown, min: number, max: number, label: string): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(numeric) || numeric < min || numeric > max) throw new BadRequestException(`Invalid ${label}`);
    return numeric;
  }

  private assertSharing(station: AuthenticatedStation): void {
    if (station.mode !== StationMode.SHARING) throw new ForbiddenException('Only a Sharing station can manage Business sharing');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private pathnameFor(media: { organizationId: string; eventId: string; id: string; mimeType: string }): string {
    return `organizations/${media.organizationId}/events/${media.eventId}/media/${media.id}.${this.extensionForMimeType(media.mimeType)}`;
  }

  private extensionForMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      case 'video/mp4': return 'mp4';
      case 'video/quicktime': return 'mov';
      default: throw new BadRequestException(`Unsupported media type: ${mimeType}`);
    }
  }
}
