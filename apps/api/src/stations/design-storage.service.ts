import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { head, issueSignedToken, presignUrl } from '@vercel/blob';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

const MAX_BACKGROUND_BYTES = 12 * 1024 * 1024;
const MAX_MUSIC_BYTES = 80 * 1024 * 1024;
const UPLOAD_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_TTL_MS = 60 * 60 * 1000;
const ALLOWED_BACKGROUND_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_MUSIC_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/x-m4a']);

function assetKind(contentType: string): 'background' | 'music' {
  if (ALLOWED_BACKGROUND_TYPES.has(contentType)) return 'background';
  if (ALLOWED_MUSIC_TYPES.has(contentType)) return 'music';
  throw new BadRequestException('Format de ressource Studio non supporté');
}

function extensionFor(contentType: string): string {
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'audio/mpeg') return 'mp3';
  if (contentType === 'audio/mp4' || contentType === 'audio/x-m4a') return 'm4a';
  if (contentType === 'audio/wav' || contentType === 'audio/x-wav') return 'wav';
  if (contentType === 'audio/aac') return 'aac';
  throw new BadRequestException('Format de ressource Studio non supporté');
}

@Injectable()
export class DesignStorageService {
  constructor(private readonly prisma: PrismaService) {}

  async prepareBackgroundUpload(
    station: AuthenticatedStation,
    eventId: string,
    body: Record<string, unknown>,
  ) {
    const contentType = String(body.contentType ?? '').trim().toLowerCase();
    const byteSize = Number(body.byteSize ?? 0);
    const kind = assetKind(contentType);
    const maxBytes = kind === 'background' ? MAX_BACKGROUND_BYTES : MAX_MUSIC_BYTES;
    if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > maxBytes) {
      throw new BadRequestException(kind === 'background' ? 'L’image de fond doit faire moins de 12 Mo' : 'La musique doit faire moins de 80 Mo');
    }

    await this.assertEventBelongsToStationClient(station, eventId);
    const extension = extensionFor(contentType);
    const pathname = `organizations/${station.organizationId}/events/${eventId}/design/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    const expiresAtMs = Date.now() + UPLOAD_TTL_MS;

    try {
      const token = await issueSignedToken({
        pathname,
        operations: ['put'],
        validUntil: expiresAtMs,
        maximumSizeInBytes: byteSize,
        allowedContentTypes: [contentType],
      });
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
      console.error('[blob][design] upload signing failed:', detail);
      throw new ServiceUnavailableException(`Stockage design indisponible: ${detail}`);
    }
  }

  async backgroundDownload(station: AuthenticatedStation, body: Record<string, unknown>) {
    const pathname = String(body.pathname ?? '').trim();
    const prefix = `organizations/${station.organizationId}/events/${station.eventId}/design/`;
    if (!pathname || !pathname.startsWith(prefix)) throw new ForbiddenException('Ressource Studio non autorisée pour cet événement');

    try {
      const blob = await head(pathname);
      const contentType = blob.contentType ?? '';
      assetKind(contentType);
      const expiresAtMs = Date.now() + DOWNLOAD_TTL_MS;
      const token = await issueSignedToken({ pathname, operations: ['get'], validUntil: expiresAtMs });
      const { presignedUrl } = await presignUrl(token, {
        access: 'private',
        pathname,
        operation: 'get',
        validUntil: expiresAtMs,
      });
      return { pathname, downloadUrl: presignedUrl, expiresAt: new Date(expiresAtMs), contentType, byteSize: blob.size };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) throw error;
      const detail = error instanceof Error ? error.message : 'Blob access failed';
      console.error('[blob][design] download signing failed:', detail);
      throw new ServiceUnavailableException(`Stockage design indisponible: ${detail}`);
    }
  }

  private async assertEventBelongsToStationClient(station: AuthenticatedStation, eventId: string) {
    const source = await this.prisma.event.findFirst({ where: { id: station.eventId, organizationId: station.organizationId }, select: { clientId: true } });
    if (!source?.clientId) throw new ForbiddenException('Cette station n’est pas liée à un client KHE');
    const target = await this.prisma.event.findFirst({ where: { id: eventId, organizationId: station.organizationId, clientId: source.clientId }, select: { id: true } });
    if (!target) throw new NotFoundException('Événement client introuvable');
    return target;
  }
}
