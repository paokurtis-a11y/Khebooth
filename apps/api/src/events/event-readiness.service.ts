import { Injectable, NotFoundException } from '@nestjs/common';
import { MediaSyncState, StationMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ONLINE_WINDOW_MS = 30_000;
const STALE_WINDOW_MS = 3 * 60_000;

type CheckLevel = 'PASS' | 'WARN' | 'BLOCK' | 'INFO';

interface ReadinessCheck {
  id: string;
  level: CheckLevel;
  detail: string;
}

@Injectable()
export class EventReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(organizationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizationId },
      include: { preset: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const now = new Date();
    const [sessions, remote, queued, uploading, failed, synced] = await Promise.all([
      this.prisma.stationSession.findMany({
        where: {
          organizationId,
          eventId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        include: { device: { select: { id: true, name: true, platform: true, lastSeenAt: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stationRemoteControl.findUnique({ where: { eventId } }),
      this.prisma.mediaAsset.count({ where: { organizationId, eventId, syncState: MediaSyncState.QUEUED } }),
      this.prisma.mediaAsset.count({ where: { organizationId, eventId, syncState: MediaSyncState.UPLOADING } }),
      this.prisma.mediaAsset.count({ where: { organizationId, eventId, syncState: MediaSyncState.FAILED } }),
      this.prisma.mediaAsset.count({ where: { organizationId, eventId, syncState: MediaSyncState.SYNCED } }),
    ]);

    const stationItems = sessions.map((session) => {
      const ageMs = Math.max(0, now.getTime() - session.lastSeenAt.getTime());
      return {
        id: session.id,
        mode: session.mode,
        deviceId: session.deviceId,
        deviceName: session.device.name,
        platform: session.device.platform,
        lastSeenAt: session.lastSeenAt,
        ageSeconds: Math.round(ageMs / 1000),
        online: ageMs <= ONLINE_WINDOW_MS,
        stale: ageMs > STALE_WINDOW_MS,
        expiresAt: session.expiresAt,
      };
    });

    const capture = stationItems.find((station) => station.mode === StationMode.CAPTURE) ?? null;
    const sharing = stationItems.find((station) => station.mode === StationMode.SHARING) ?? null;
    const pending = queued + uploading + failed;
    const checks: ReadinessCheck[] = [];

    checks.push({
      id: 'studio',
      level: event.preset ? 'PASS' : 'WARN',
      detail: event.preset ? `Preset ${event.preset.name} associé.` : 'Aucun preset Studio associé à cet événement.',
    });
    checks.push(this.stationCheck('capture', capture));
    checks.push(this.stationCheck('sharing', sharing));
    checks.push({
      id: 'sync',
      level: failed > 0 ? 'BLOCK' : pending > 0 ? 'WARN' : 'PASS',
      detail: failed > 0
        ? `${failed} média(s) en échec de synchronisation.`
        : pending > 0
          ? `${pending} média(s) encore en transfert ou en attente.`
          : `${synced} média(s) synchronisé(s), aucun transfert en attente.`,
    });

    const sharingStatus = remote?.sharingConnectionStatus ?? 'DISCONNECTED';
    checks.push({
      id: 'station-link',
      level: sharingStatus === 'ACCEPTED' ? 'PASS' : capture && sharing ? 'WARN' : 'INFO',
      detail: sharingStatus === 'ACCEPTED'
        ? 'Liaison CAPTURE ↔ SHARING acceptée.'
        : capture && sharing
          ? `Les deux stations existent mais la liaison est ${sharingStatus.toLowerCase()}.`
          : 'La liaison sera vérifiable lorsque les deux stations seront présentes.',
    });

    for (const id of ['camera', 'microphone', 'battery', 'storage', 'network', 'printer', 'test-photo', 'test-video', 'guest-qr']) {
      checks.push({
        id,
        level: 'INFO',
        detail: 'État matériel à confirmer depuis KHE Event Ready sur la tablette concernée.',
      });
    }

    const alerts: Array<{ level: 'warning' | 'critical'; code: string; message: string }> = [];
    for (const station of stationItems) {
      if (station.stale) alerts.push({ level: 'critical', code: `STATION_${station.mode}_STALE`, message: `${station.mode} ne communique plus depuis plus de 3 minutes.` });
      else if (!station.online) alerts.push({ level: 'warning', code: `STATION_${station.mode}_QUIET`, message: `${station.mode} n’a pas communiqué depuis ${station.ageSeconds} secondes.` });
    }
    if (failed > 0) alerts.push({ level: 'critical', code: 'SYNC_FAILED', message: `${failed} média(s) sont en échec de synchronisation.` });
    else if (pending > 0) alerts.push({ level: 'warning', code: 'SYNC_PENDING', message: `${pending} média(s) attendent encore la synchronisation.` });

    const state = checks.some((check) => check.level === 'BLOCK')
      ? 'BLOCKED'
      : checks.some((check) => check.level === 'WARN')
        ? 'ATTENTION'
        : 'READY';

    return {
      generatedAt: now,
      event: { id: event.id, name: event.name, status: event.status, startsAt: event.startsAt, endsAt: event.endsAt },
      state,
      stations: stationItems,
      media: { queued, uploading, failed, synced, pending },
      remote: remote ? {
        runtimeState: remote.runtimeState,
        captureSeenAt: remote.captureSeenAt,
        sharingConnectionStatus: remote.sharingConnectionStatus,
      } : null,
      checks,
      alerts,
      recommendedAction: this.recommendedAction(checks, capture, sharing),
    };
  }

  private stationCheck(id: 'capture' | 'sharing', station: { online: boolean; stale: boolean; ageSeconds: number } | null): ReadinessCheck {
    const label = id.toUpperCase();
    if (!station) return { id, level: 'BLOCK', detail: `Aucune station ${label} active pour cet événement.` };
    if (station.stale) return { id, level: 'BLOCK', detail: `${label} n’a pas communiqué depuis plus de 3 minutes.` };
    if (!station.online) return { id, level: 'WARN', detail: `${label} n’a pas communiqué depuis ${station.ageSeconds} secondes.` };
    return { id, level: 'PASS', detail: `${label} communique avec KHE Cloud.` };
  }

  private recommendedAction(checks: ReadinessCheck[], capture: unknown, sharing: unknown) {
    if (!capture) return 'CONNECT_CAPTURE';
    if (!sharing) return 'CONNECT_SHARING';
    if (checks.some((check) => check.id === 'sync' && check.level === 'BLOCK')) return 'RESCUE_SYNC';
    if (checks.some((check) => check.level === 'WARN')) return 'REVIEW_WARNINGS';
    return 'RUN_TABLET_EVENT_READY';
  }
}
