import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { head, issueSignedToken, presignUrl } from '@vercel/blob';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
const UPLOAD_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_TTL_MS = 60 * 60 * 1000;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function extensionFor(contentType: string): string {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  throw new BadRequestException('Format de photo de profil non supporté');
}

@Injectable()
export class ProfileStorageService {
  constructor(private readonly prisma: PrismaService) {}

  async prepareAvatarUpload(station: AuthenticatedStation, body: Record<string, unknown>) {
    const contentType = String(body.contentType ?? '').trim().toLowerCase();
    const byteSize = Number(body.byteSize ?? 0);
    if (!ALLOWED_AVATAR_TYPES.has(contentType)) throw new BadRequestException('Format de photo de profil non supporté');
    if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > MAX_AVATAR_BYTES) throw new BadRequestException('La photo de profil doit faire moins de 8 Mo');

    const pathname = `organizations/${station.organizationId}/profile/avatar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extensionFor(contentType)}`;
    const expiresAtMs = Date.now() + UPLOAD_TTL_MS;
    try {
      const token = await issueSignedToken({ pathname, operations: ['put'], validUntil: expiresAtMs, maximumSizeInBytes: byteSize, allowedContentTypes: [contentType] });
      const { presignedUrl } = await presignUrl(token, {
        access: 'private',
        pathname,
        operation: 'put',
        validUntil: expiresAtMs,
        maximumSizeInBytes: byteSize,
        allowedContentTypes: [contentType],
        allowOverwrite: false,
      });
      return { pathname, uploadUrl: presignedUrl, expiresAt: new Date(expiresAtMs), contentType, byteSize };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Blob signing failed';
      console.error('[blob][profile] upload signing failed:', detail);
      throw new ServiceUnavailableException(`Stockage du profil indisponible: ${detail}`);
    }
  }

  async confirmAvatar(station: AuthenticatedStation, body: Record<string, unknown>) {
    const pathname = String(body.pathname ?? '').trim();
    const prefix = `organizations/${station.organizationId}/profile/`;
    if (!pathname.startsWith(prefix)) throw new BadRequestException('Photo de profil invalide');
    try {
      const blob = await head(pathname);
      if (!ALLOWED_AVATAR_TYPES.has(blob.contentType ?? '') || blob.size <= 0 || blob.size > MAX_AVATAR_BYTES) throw new BadRequestException('Photo de profil cloud invalide');
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "OrganizationProfile" ("organizationId","avatarPath","updatedAt")
        VALUES (${station.organizationId}::uuid,${pathname},CURRENT_TIMESTAMP)
        ON CONFLICT ("organizationId") DO UPDATE SET "avatarPath"=EXCLUDED."avatarPath","updatedAt"=CURRENT_TIMESTAMP
      `);
      return { pathname, confirmed: true };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const detail = error instanceof Error ? error.message : 'Blob verification failed';
      console.error('[blob][profile] confirm failed:', detail);
      throw new ServiceUnavailableException(`Stockage du profil indisponible: ${detail}`);
    }
  }

  async avatarDownload(station: AuthenticatedStation) {
    const rows = await this.prisma.$queryRaw<Array<{ avatarPath: string | null }>>(Prisma.sql`
      SELECT "avatarPath" FROM "OrganizationProfile" WHERE "organizationId"=${station.organizationId}::uuid LIMIT 1
    `);
    const pathname = rows[0]?.avatarPath;
    if (!pathname) return { pathname: null, downloadUrl: null, expiresAt: null };
    const prefix = `organizations/${station.organizationId}/profile/`;
    if (!pathname.startsWith(prefix)) throw new BadRequestException('Photo de profil invalide');
    try {
      const blob = await head(pathname);
      const expiresAtMs = Date.now() + DOWNLOAD_TTL_MS;
      const token = await issueSignedToken({ pathname, operations: ['get'], validUntil: expiresAtMs });
      const { presignedUrl } = await presignUrl(token, { access: 'private', pathname, operation: 'get', validUntil: expiresAtMs });
      return { pathname, downloadUrl: presignedUrl, expiresAt: new Date(expiresAtMs), contentType: blob.contentType, byteSize: blob.size };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Blob access failed';
      console.error('[blob][profile] download signing failed:', detail);
      throw new ServiceUnavailableException(`Stockage du profil indisponible: ${detail}`);
    }
  }
}
