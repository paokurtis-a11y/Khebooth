import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MediaSyncState, StationMode, UploadState } from '@prisma/client';
import { head, issueSignedToken, presignUrl } from '@vercel/blob';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

const UPLOAD_TICKET_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_TICKET_TTL_MS = 10 * 60 * 1000;
const MAX_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg': return 'jpg';
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'video/mp4': return 'mp4';
    case 'video/quicktime': return 'mov';
    default: throw new BadRequestException(`Unsupported media type: ${mimeType}`);
  }
}

@Injectable()
export class MediaStorageService {
  constructor(private readonly prisma: PrismaService) {}

  async prepareUpload(station: AuthenticatedStation, mediaId: string) {
    this.assertCapture(station);
    const media = await this.getEventMedia(station, mediaId, true);
    if (media.byteSize <= 0 || media.byteSize > MAX_MEDIA_BYTES) {
      throw new BadRequestException('Media size is outside the supported range');
    }

    const pathname = this.pathnameFor(media);
    const expiresAtMs = Date.now() + UPLOAD_TICKET_TTL_MS;

    try {
      const existing = await head(pathname, { access: 'private' });
      if (existing.size === media.byteSize && existing.contentType === media.mimeType) {
        await this.ensureUploadSession(media.id, media.byteSize, media.byteSize);
        return {
          mediaId: media.id,
          pathname,
          uploadUrl: '',
          expiresAt: new Date(expiresAtMs),
          contentType: media.mimeType,
          byteSize: media.byteSize,
          alreadyUploaded: true,
        };
      }
    } catch {
      // A missing object is expected before the first upload. The signed PUT below is the normal path.
    }

    await this.ensureUploadSession(media.id, media.byteSize, 0);

    try {
      const signedToken = await issueSignedToken({
        pathname,
        operations: ['put'],
        validUntil: expiresAtMs,
        maximumSizeInBytes: media.byteSize,
        allowedContentTypes: [media.mimeType],
      });
      const { presignedUrl } = await presignUrl(signedToken, {
        access: 'private',
        pathname,
        operation: 'put',
        validUntil: expiresAtMs,
        maximumSizeInBytes: media.byteSize,
        allowedContentTypes: [media.mimeType],
        allowOverwrite: true,
      });
      return {
        mediaId: media.id,
        pathname,
        uploadUrl: presignedUrl,
        expiresAt: new Date(expiresAtMs),
        contentType: media.mimeType,
        byteSize: media.byteSize,
        alreadyUploaded: false,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Blob signing failed';
      throw new ServiceUnavailableException(`Media storage unavailable: ${detail}`);
    }
  }

  async finalizeUpload(station: AuthenticatedStation, mediaId: string) {
    this.assertCapture(station);
    const media = await this.getEventMedia(station, mediaId, true);
    const pathname = this.pathnameFor(media);

    let blob: Awaited<ReturnType<typeof head>>;
    try {
      blob = await head(pathname, { access: 'private' });
    } catch {
      throw new BadRequestException('Cloud media object is not available yet');
    }
    if (blob.size !== media.byteSize) {
      throw new BadRequestException(`Cloud media size mismatch: expected ${media.byteSize}, received ${blob.size}`);
    }
    if (blob.contentType !== media.mimeType) {
      throw new BadRequestException(`Cloud media type mismatch: expected ${media.mimeType}, received ${blob.contentType}`);
    }

    const acknowledgedAt = new Date();
    const [upload, updatedMedia] = await this.prisma.$transaction([
      this.prisma.uploadSession.upsert({
        where: { mediaAssetId: media.id },
        create: {
          mediaAssetId: media.id,
          totalBytes: media.byteSize,
          uploadedBytes: media.byteSize,
          state: UploadState.COMPLETED,
        },
        update: {
          totalBytes: media.byteSize,
          uploadedBytes: media.byteSize,
          state: UploadState.COMPLETED,
        },
      }),
      this.prisma.mediaAsset.update({
        where: { id: media.id },
        data: { syncState: MediaSyncState.SYNCED, acknowledgedAt },
      }),
    ]);

    return { media: updatedMedia, upload };
  }

  async downloadTicket(station: AuthenticatedStation, mediaId: string) {
    const media = await this.getEventMedia(station, mediaId, false);
    if (media.syncState !== MediaSyncState.SYNCED || !media.acknowledgedAt) {
      throw new BadRequestException('Media is not synchronized yet');
    }
    const pathname = this.pathnameFor(media);
    try {
      const blob = await head(pathname, { access: 'private' });
      if (blob.size !== media.byteSize || blob.contentType !== media.mimeType) {
        throw new BadRequestException('Stored media verification failed');
      }
      const expiresAtMs = Date.now() + DOWNLOAD_TICKET_TTL_MS;
      const signedToken = await issueSignedToken({
        pathname,
        operations: ['get'],
        validUntil: expiresAtMs,
      });
      const { presignedUrl } = await presignUrl(signedToken, {
        access: 'private',
        pathname,
        operation: 'get',
        validUntil: expiresAtMs,
      });
      return { mediaId: media.id, downloadUrl: presignedUrl, expiresAt: new Date(expiresAtMs) };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const detail = error instanceof Error ? error.message : 'Blob access failed';
      throw new ServiceUnavailableException(`Media storage unavailable: ${detail}`);
    }
  }

  private async ensureUploadSession(mediaAssetId: string, totalBytes: number, uploadedBytes: number) {
    return this.prisma.uploadSession.upsert({
      where: { mediaAssetId },
      create: {
        mediaAssetId,
        totalBytes,
        uploadedBytes,
        state: uploadedBytes === totalBytes ? UploadState.COMPLETED : UploadState.IN_PROGRESS,
      },
      update: {
        totalBytes,
        uploadedBytes,
        state: uploadedBytes === totalBytes ? UploadState.COMPLETED : UploadState.IN_PROGRESS,
      },
    });
  }

  private pathnameFor(media: { organizationId: string; eventId: string; id: string; mimeType: string }): string {
    const extension = extensionForMimeType(media.mimeType);
    return `organizations/${media.organizationId}/events/${media.eventId}/media/${media.id}.${extension}`;
  }

  private async getEventMedia(station: AuthenticatedStation, mediaId: string, requireOwner: boolean) {
    const media = await this.prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        organizationId: station.organizationId,
        eventId: station.eventId,
        ...(requireOwner ? { createdBySessionId: station.sessionId } : {}),
      },
    });
    if (!media) throw new NotFoundException('Media asset not found');
    return media;
  }

  private assertCapture(station: AuthenticatedStation): void {
    if (station.mode !== StationMode.CAPTURE) {
      throw new ForbiddenException('Only a Capture station can upload media');
    }
  }
}
