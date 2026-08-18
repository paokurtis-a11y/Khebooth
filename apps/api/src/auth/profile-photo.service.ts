import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { head, issueSignedToken, presignUrl } from '@vercel/blob';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from './auth.types';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ProfilePhotoService {
  constructor(private readonly prisma: PrismaService) {}

  private pathname(user: AuthenticatedUser): string { return `organizations/${user.organizationId}/users/${user.id}/profile/avatar`; }

  async prepare(user: AuthenticatedUser, body: Record<string, unknown>) {
    const contentType = String(body.contentType ?? '').trim().toLowerCase();
    const byteSize = Number(body.byteSize ?? 0);
    if (!ALLOWED.has(contentType)) throw new BadRequestException('Format photo non supporté');
    if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > MAX_AVATAR_BYTES) throw new BadRequestException('La photo doit faire moins de 5 Mo');
    const pathname = this.pathname(user);
    const expiresAtMs = Date.now() + 15 * 60 * 1000;
    try {
      const token = await issueSignedToken({ pathname, operations: ['put'], validUntil: expiresAtMs, maximumSizeInBytes: byteSize, allowedContentTypes: [contentType] });
      const { presignedUrl } = await presignUrl(token, { access: 'private', pathname, operation: 'put', validUntil: expiresAtMs, maximumSizeInBytes: byteSize, allowedContentTypes: [contentType], allowOverwrite: true });
      return { uploadUrl: presignedUrl, pathname, expiresAt: new Date(expiresAtMs), contentType, byteSize };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'erreur Blob';
      console.error('[blob][profile] signing failed:', detail);
      throw new ServiceUnavailableException(`Stockage photo indisponible: ${detail}`);
    }
  }

  async finalize(user: AuthenticatedUser) {
    const pathname = this.pathname(user);
    try {
      const blob = await head(pathname);
      if (!ALLOWED.has(blob.contentType ?? '') || blob.size <= 0 || blob.size > MAX_AVATAR_BYTES) throw new BadRequestException('Photo de profil invalide');
      await this.prisma.$executeRaw`UPDATE "User" SET "avatarPath" = ${pathname}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${user.id}::uuid AND "organizationId" = ${user.organizationId}::uuid`;
      return this.download(pathname);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      console.error('[blob][profile] finalize HEAD failed:', error instanceof Error ? error.message : 'Blob HEAD failed');
      throw new BadRequestException('La photo envoyée n’est pas disponible');
    }
  }

  async download(pathname: string | null | undefined): Promise<{ avatarUrl: string | null; expiresAt: Date | null }> {
    if (!pathname) return { avatarUrl: null, expiresAt: null };
    const expiresAtMs = Date.now() + 10 * 60 * 1000;
    try {
      await head(pathname);
      const token = await issueSignedToken({ pathname, operations: ['get'], validUntil: expiresAtMs });
      const { presignedUrl } = await presignUrl(token, { access: 'private', pathname, operation: 'get', validUntil: expiresAtMs });
      return { avatarUrl: presignedUrl, expiresAt: new Date(expiresAtMs) };
    } catch (error) {
      console.error('[blob][profile] download signing failed:', error instanceof Error ? error.message : 'Blob access failed');
      return { avatarUrl: null, expiresAt: null };
    }
  }
}
