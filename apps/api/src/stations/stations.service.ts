import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  MediaSyncState,
  Prisma,
  RemoteCaptureCommand,
  RemoteCaptureState,
  StationMode,
  UploadState,
  VisualEffect,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { RedeemStationDto } from './dto/redeem-station.dto';
import { UpdateStationCommandDto } from './dto/update-station-command.dto';
import { UpdateStationStatusDto } from './dto/update-station-status.dto';
import { UpdateUploadProgressDto } from './dto/update-upload-progress.dto';
import type { AuthenticatedStation, StationTokenPayload } from './station-auth.types';

const STATION_SESSION_TTL_SECONDS = 24 * 60 * 60;
const MAX_ACTIVE_CODE_CANDIDATES = 50;

@Injectable()
export class StationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly events: EventsService,
  ) {}

  async redeem(dto: RedeemStationDto) {
    const activation = await this.findMatchingActivation(dto.eventId, dto.code);
    const device = await this.prisma.device.upsert({
      where: {
        organizationId_installationId: {
          organizationId: activation.organizationId,
          installationId: dto.installationId,
        },
      },
      create: {
        organizationId: activation.organizationId,
        installationId: dto.installationId,
        name: dto.deviceName,
        platform: dto.platform,
      },
      update: {
        name: dto.deviceName,
        platform: dto.platform,
        lastSeenAt: new Date(),
      },
    });

    if (device.revokedAt) throw new UnauthorizedException('Device is revoked');

    const claimed = await this.prisma.stationSession.findUnique({
      where: { activationId_mode: { activationId: activation.id, mode: dto.mode } },
      include: { device: { select: { installationId: true } } },
    });

    if (claimed) {
      if (claimed.device.installationId !== dto.installationId || claimed.revokedAt || claimed.expiresAt <= new Date()) {
        throw new ConflictException(`The ${dto.mode} station is already claimed for this activation`);
      }
      return this.buildRedeemResponse(claimed, activation.organizationId);
    }

    if (activation.usedAt) throw new UnauthorizedException('Activation code has already been consumed');

    const expiresAt = new Date(Date.now() + STATION_SESSION_TTL_SECONDS * 1000);
    let session;
    try {
      session = await this.prisma.stationSession.create({
        data: {
          organizationId: activation.organizationId,
          eventId: activation.eventId,
          deviceId: device.id,
          activationId: activation.id,
          mode: dto.mode,
          expiresAt,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.prisma.stationSession.findUnique({
          where: { activationId_mode: { activationId: activation.id, mode: dto.mode } },
          include: { device: { select: { installationId: true } } },
        });
        if (concurrent?.device.installationId === dto.installationId && !concurrent.revokedAt && concurrent.expiresAt > new Date()) {
          return this.buildRedeemResponse(concurrent, activation.organizationId);
        }
        throw new ConflictException(`The ${dto.mode} station is already claimed for this activation`);
      }
      throw error;
    }

    const activeModes = await this.prisma.stationSession.count({
      where: { activationId: activation.id, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (activeModes >= 2) {
      await this.prisma.eventActivation.updateMany({
        where: { id: activation.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId: activation.organizationId,
        action: 'STATION_REDEEMED',
        entityType: 'StationSession',
        entityId: session.id,
        metadata: { eventId: activation.eventId, deviceId: device.id, mode: dto.mode },
      },
    });

    return this.buildRedeemResponse(session, activation.organizationId);
  }

  manifest(station: AuthenticatedStation) {
    return this.events.manifest(station.organizationId, station.eventId);
  }

  async getControl(station: AuthenticatedStation) {
    return this.prisma.stationRemoteControl.upsert({
      where: { eventId: station.eventId },
      create: {
        organizationId: station.organizationId,
        eventId: station.eventId,
      },
      update: {},
    });
  }

  async updateControlCommand(station: AuthenticatedStation, dto: UpdateStationCommandDto) {
    this.assertSharing(station);
    if (dto.command === RemoteCaptureCommand.NONE) {
      throw new BadRequestException('NONE cannot be issued as a remote command');
    }
    if (dto.command === undefined && dto.selectedEffect === undefined && dto.maxDurationSeconds === undefined) {
      throw new BadRequestException('A command, visual effect or capture duration is required');
    }

    return this.prisma.stationRemoteControl.upsert({
      where: { eventId: station.eventId },
      create: {
        organizationId: station.organizationId,
        eventId: station.eventId,
        command: dto.command ?? RemoteCaptureCommand.NONE,
        commandVersion: dto.command ? 1 : 0,
        selectedEffect: dto.selectedEffect ?? VisualEffect.NONE,
        maxDurationSeconds: dto.maxDurationSeconds ?? 15,
      },
      update: {
        ...(dto.command ? { command: dto.command, commandVersion: { increment: 1 } } : {}),
        ...(dto.selectedEffect !== undefined ? { selectedEffect: dto.selectedEffect } : {}),
        ...(dto.maxDurationSeconds !== undefined ? { maxDurationSeconds: dto.maxDurationSeconds } : {}),
      },
    });
  }

  async updateControlStatus(station: AuthenticatedStation, dto: UpdateStationStatusDto) {
    this.assertCapture(station);
    const now = new Date();
    return this.prisma.stationRemoteControl.upsert({
      where: { eventId: station.eventId },
      create: {
        organizationId: station.organizationId,
        eventId: station.eventId,
        acknowledgedVersion: dto.acknowledgedVersion ?? 0,
        runtimeState: dto.runtimeState ?? RemoteCaptureState.IDLE,
        elapsedSeconds: dto.elapsedSeconds ?? 0,
        captureSeenAt: now,
      },
      update: {
        ...(dto.acknowledgedVersion !== undefined ? { acknowledgedVersion: dto.acknowledgedVersion } : {}),
        ...(dto.runtimeState !== undefined ? { runtimeState: dto.runtimeState } : {}),
        ...(dto.elapsedSeconds !== undefined ? { elapsedSeconds: dto.elapsedSeconds } : {}),
        captureSeenAt: now,
      },
    });
  }

  async listMedia(station: AuthenticatedStation) {
    return this.prisma.mediaAsset.findMany({
      where: {
        organizationId: station.organizationId,
        eventId: station.eventId,
        ...(station.mode === StationMode.SHARING ? { syncState: MediaSyncState.SYNCED } : {}),
      },
      include: { uploadSession: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMedia(station: AuthenticatedStation, dto: CreateMediaDto) {
    this.assertCapture(station);

    const existing = await this.prisma.mediaAsset.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: station.organizationId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
      include: { uploadSession: true },
    });
    if (existing) {
      if (
        existing.eventId !== station.eventId ||
        existing.localId !== dto.localId ||
        existing.contentHash !== dto.contentHash ||
        existing.byteSize !== dto.byteSize ||
        existing.mimeType !== dto.mimeType
      ) {
        throw new ConflictException('Idempotency key was already used for different media metadata');
      }
      return existing;
    }

    try {
      return await this.prisma.mediaAsset.create({
        data: {
          organizationId: station.organizationId,
          eventId: station.eventId,
          createdBySessionId: station.sessionId,
          localId: dto.localId,
          idempotencyKey: dto.idempotencyKey,
          contentHash: dto.contentHash,
          byteSize: dto.byteSize,
          mimeType: dto.mimeType,
          capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : undefined,
        },
        include: { uploadSession: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Media localId or idempotencyKey already exists');
      }
      throw error;
    }
  }

  async initializeUpload(station: AuthenticatedStation, mediaAssetId: string) {
    const asset = await this.getWritableMedia(station, mediaAssetId);
    const upload = await this.prisma.uploadSession.upsert({
      where: { mediaAssetId: asset.id },
      create: { mediaAssetId: asset.id, totalBytes: asset.byteSize },
      update: {},
    });
    return upload;
  }

  async updateUploadProgress(
    station: AuthenticatedStation,
    mediaAssetId: string,
    dto: UpdateUploadProgressDto,
  ) {
    const asset = await this.getWritableMedia(station, mediaAssetId);
    if (asset.syncState === MediaSyncState.SYNCED) {
      return asset.uploadSession;
    }

    const upload = asset.uploadSession;
    if (!upload) throw new NotFoundException('Upload session not initialized');
    if (dto.uploadedBytes < upload.uploadedBytes) {
      throw new ConflictException('Upload progress cannot move backwards');
    }
    if (dto.uploadedBytes > upload.totalBytes) {
      throw new BadRequestException('Upload progress exceeds media byte size');
    }

    const [updatedUpload] = await this.prisma.$transaction([
      this.prisma.uploadSession.update({
        where: { id: upload.id },
        data: { uploadedBytes: dto.uploadedBytes, state: UploadState.IN_PROGRESS },
      }),
      this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { syncState: MediaSyncState.UPLOADING },
      }),
    ]);
    return updatedUpload;
  }

  async finalizeUpload(station: AuthenticatedStation, mediaAssetId: string) {
    const asset = await this.getWritableMedia(station, mediaAssetId);
    const upload = asset.uploadSession;
    if (!upload) throw new NotFoundException('Upload session not initialized');

    if (asset.syncState === MediaSyncState.SYNCED && upload.state === UploadState.COMPLETED) {
      return { media: asset, upload };
    }
    if (upload.uploadedBytes !== upload.totalBytes) {
      throw new BadRequestException('Upload is incomplete');
    }

    const acknowledgedAt = new Date();
    const [updatedUpload, updatedMedia] = await this.prisma.$transaction([
      this.prisma.uploadSession.update({
        where: { id: upload.id },
        data: { state: UploadState.COMPLETED },
      }),
      this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { syncState: MediaSyncState.SYNCED, acknowledgedAt },
      }),
    ]);
    return { media: updatedMedia, upload: updatedUpload };
  }

  private async findMatchingActivation(eventId: string | undefined, code: string) {
    const candidates = await this.prisma.eventActivation.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: eventId ? 3 : MAX_ACTIVE_CODE_CANDIDATES,
    });

    let match: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (await argon2.verify(candidate.codeHash, code)) {
        if (match && match.id !== candidate.id) {
          throw new ConflictException('Activation code is ambiguous. Generate a new activation code.');
        }
        match = candidate;
      }
    }
    if (match) return match;
    throw new UnauthorizedException('Invalid or expired activation code');
  }

  private async buildRedeemResponse(
    session: {
      id: string;
      organizationId: string;
      eventId: string;
      deviceId: string;
      mode: StationMode;
      expiresAt: Date;
    },
    organizationId: string,
  ) {
    const payload: StationTokenPayload = {
      typ: 'station',
      sessionId: session.id,
      organizationId: session.organizationId,
      eventId: session.eventId,
      deviceId: session.deviceId,
      mode: session.mode,
    };
    const stationToken = await this.jwt.signAsync(payload, {
      subject: session.id,
      expiresIn: STATION_SESSION_TTL_SECONDS,
    });
    const manifest = await this.events.manifest(organizationId, session.eventId);
    return {
      stationToken,
      session: {
        id: session.id,
        organizationId: session.organizationId,
        eventId: session.eventId,
        deviceId: session.deviceId,
        mode: session.mode,
        expiresAt: session.expiresAt,
      },
      manifest,
    };
  }

  private assertCapture(station: AuthenticatedStation) {
    if (station.mode !== StationMode.CAPTURE) {
      throw new ForbiddenException('Only a Capture station can create or upload media');
    }
  }

  private assertSharing(station: AuthenticatedStation) {
    if (station.mode !== StationMode.SHARING) {
      throw new ForbiddenException('Only a Sharing station can issue remote capture commands');
    }
  }

  private async getWritableMedia(station: AuthenticatedStation, id: string) {
    this.assertCapture(station);
    const asset = await this.prisma.mediaAsset.findFirst({
      where: {
        id,
        organizationId: station.organizationId,
        eventId: station.eventId,
        createdBySessionId: station.sessionId,
      },
      include: { uploadSession: true },
    });
    if (!asset) throw new NotFoundException('Media asset not found');
    return asset;
  }
}
