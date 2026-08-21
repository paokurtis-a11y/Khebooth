import type { MediaAssetContract, StationControlContract, StationMode } from '@khe/contracts';
import type { LocalMediaRecord, SyncQueueItem } from '../offline/types';

export type LinkHealthLevel = 'READY' | 'SYNCING' | 'ATTENTION' | 'OFFLINE';

export interface LinkHealthInput {
  mode: StationMode;
  eventId: string;
  manifestEventId: string | null;
  networkConnected: boolean;
  apiReachable: boolean;
  control: StationControlContract | null;
  localMedia: LocalMediaRecord[];
  queue: SyncQueueItem[];
  remoteMedia: MediaAssetContract[];
  checkedAt: Date;
}

export interface LinkHealthSnapshot {
  level: LinkHealthLevel;
  title: string;
  summary: string;
  eventMatches: boolean;
  networkConnected: boolean;
  apiReachable: boolean;
  captureOnline: boolean;
  captureSeenAgeSeconds: number | null;
  connectionStatus: string;
  pendingMedia: number;
  failedMedia: number;
  queueItems: number;
  oldestPendingAgeSeconds: number | null;
  remoteSyncedMedia: number;
  latestCloudAckAt: string | null;
  commandLag: number;
  reasons: string[];
  advice: string[];
}

const CAPTURE_ONLINE_WINDOW_MS = 5_000;
const OLD_PENDING_WINDOW_MS = 60_000;

function ageSeconds(value: string | Date | null | undefined, now: Date): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.round((now.getTime() - time) / 1_000));
}

function latestAck(media: MediaAssetContract[]): string | null {
  const values = media
    .map((item) => item.acknowledgedAt ? new Date(item.acknowledgedAt).getTime() : Number.NaN)
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  return values.length ? new Date(values[0]).toISOString() : null;
}

export function evaluateLinkHealth(input: LinkHealthInput): LinkHealthSnapshot {
  const localForEvent = input.localMedia.filter((item) => item.eventId === input.eventId);
  const localIds = new Set(localForEvent.map((item) => item.localId));
  const queueForEvent = input.queue.filter((item) => localIds.has(item.localId));
  const pending = localForEvent.filter((item) => item.syncState !== 'SYNCED');
  const failed = pending.filter((item) => item.syncState === 'FAILED');
  const pendingAges = pending
    .map((item) => ageSeconds(item.capturedAt, input.checkedAt))
    .filter((value): value is number => value !== null);
  const oldestPendingAgeSeconds = pendingAges.length ? Math.max(...pendingAges) : null;

  const eventMatches = Boolean(input.manifestEventId && input.manifestEventId === input.eventId);
  const captureSeenAgeSeconds = ageSeconds(input.control?.captureSeenAt, input.checkedAt);
  const captureOnline = captureSeenAgeSeconds !== null && captureSeenAgeSeconds * 1_000 < CAPTURE_ONLINE_WINDOW_MS;
  const connectionStatus = input.control?.sharingConnectionStatus ?? 'DISCONNECTED';
  const commandLag = input.control
    ? Math.max(0, input.control.commandVersion - input.control.acknowledgedVersion)
    : 0;
  const remoteForEvent = input.remoteMedia.filter((item) => item.eventId === input.eventId);
  const remoteSynced = remoteForEvent.filter((item) => item.syncState === 'SYNCED' && Boolean(item.acknowledgedAt));

  const reasons: string[] = [];
  const advice: string[] = [];
  let level: LinkHealthLevel = 'READY';

  if (!input.networkConnected || !input.apiReachable) {
    level = 'OFFLINE';
    reasons.push(!input.networkConnected ? 'La tablette ne détecte pas de connexion réseau.' : 'L’API KHE Booth ne répond pas actuellement.');
    advice.push(input.mode === 'CAPTURE'
      ? 'CAPTURE continue en mode offline-first. Les nouveaux médias restent stockés localement et seront repris automatiquement au retour du réseau.'
      : 'SHARING conserve les médias déjà téléchargés. Les nouveaux Moments apparaîtront lorsque la connexion KHE sera revenue.');
  } else {
    if (!eventMatches) {
      level = 'ATTENTION';
      reasons.push('Le manifest reçu ne correspond pas à l’événement actif de cette tablette.');
      advice.push('Actualisez le manifest ou réactivez la station avec le code du bon événement avant de continuer.');
    }
    if (!input.control) {
      level = 'ATTENTION';
      reasons.push('L’état de liaison CAPTURE / SHARING n’a pas pu être lu.');
      advice.push('Relancez le diagnostic. Si le problème persiste, vérifiez que les deux stations utilisent le même événement.');
    } else {
      if (!captureOnline) {
        level = 'ATTENTION';
        reasons.push('Aucun heartbeat CAPTURE récent n’est visible.');
        advice.push('Ouvrez KHE Booth sur la tablette CAPTURE et laissez-la active quelques secondes.');
      }
      if (connectionStatus !== 'ACCEPTED') {
        level = 'ATTENTION';
        reasons.push(connectionStatus === 'PENDING'
          ? 'SHARING attend encore l’autorisation de CAPTURE.'
          : connectionStatus === 'REJECTED'
            ? 'La dernière demande de connexion SHARING a été refusée sur CAPTURE.'
            : 'SHARING n’est pas encore autorisée à piloter CAPTURE.');
        advice.push('Depuis SHARING, demandez la connexion puis acceptez-la sur CAPTURE.');
      }
    }
    if (failed.length > 0) {
      level = 'ATTENTION';
      reasons.push(`${failed.length} média${failed.length > 1 ? 's' : ''} CAPTURE en échec de synchronisation.`);
      advice.push('KHE réessaie automatiquement avec temporisation. Gardez les fichiers locaux jusqu’à confirmation Cloud.');
    } else if (oldestPendingAgeSeconds !== null && oldestPendingAgeSeconds > OLD_PENDING_WINDOW_MS / 1_000) {
      level = 'ATTENTION';
      reasons.push('Au moins un média attend la synchronisation depuis plus d’une minute.');
      advice.push('Vérifiez le réseau puis relancez le diagnostic. Ne supprimez pas le média local tant qu’il n’est pas marqué synchronisé.');
    } else if (pending.length > 0 || commandLag > 0) {
      if (level === 'READY') level = 'SYNCING';
      if (pending.length > 0) reasons.push(`${pending.length} média${pending.length > 1 ? 's' : ''} en cours ou en attente de synchronisation.`);
      if (commandLag > 0) reasons.push(`${commandLag} commande${commandLag > 1 ? 's' : ''} SHARING en attente d’acquittement CAPTURE.`);
      advice.push('Aucune action nécessaire si les compteurs diminuent : KHE poursuit automatiquement la synchronisation.');
    }
  }

  const labels: Record<LinkHealthLevel, { title: string; summary: string }> = {
    READY: { title: 'PRÊT', summary: 'CAPTURE et SHARING sont alignés et la liaison KHE est opérationnelle.' },
    SYNCING: { title: 'SYNCHRONISATION', summary: 'La liaison est saine, mais KHE termine encore des transferts ou commandes.' },
    ATTENTION: { title: 'ATTENTION', summary: 'Une vérification est nécessaire avant de considérer les deux tablettes prêtes.' },
    OFFLINE: { title: 'HORS LIGNE', summary: 'Le Cloud KHE n’est pas joignable pour le moment ; les protections offline restent actives.' },
  };

  return {
    level,
    title: labels[level].title,
    summary: labels[level].summary,
    eventMatches,
    networkConnected: input.networkConnected,
    apiReachable: input.apiReachable,
    captureOnline,
    captureSeenAgeSeconds,
    connectionStatus,
    pendingMedia: pending.length,
    failedMedia: failed.length,
    queueItems: queueForEvent.length,
    oldestPendingAgeSeconds,
    remoteSyncedMedia: remoteSynced.length,
    latestCloudAckAt: latestAck(remoteSynced),
    commandLag,
    reasons,
    advice: [...new Set(advice)],
  };
}
