import type { MediaAssetContract } from '@khe/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { MediaShareContract, StationApi } from '../api/station-api';

interface SharingMediaGalleryProps {
  eventName: string;
  api: StationApi;
  stationToken: string;
}

const AUTO_SYNC_INTERVAL_MS = 2_000;

function extensionFor(media: MediaAssetContract): string {
  if (media.mimeType === 'image/jpeg') return 'jpg';
  if (media.mimeType === 'image/png') return 'png';
  if (media.mimeType === 'image/webp') return 'webp';
  if (media.mimeType === 'video/quicktime') return 'mov';
  return 'mp4';
}

function capturedLabel(media: MediaAssetContract): string {
  if (!media.capturedAt) return 'Date inconnue';
  const date = new Date(media.capturedAt);
  return `${date.toLocaleDateString()} • ${date.toLocaleTimeString()}`;
}

function sizeLabel(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} Mo`;
}

export function SharingMediaGallery({ eventName, api, stationToken }: SharingMediaGalleryProps) {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaAssetContract[]>([]);
  const [shares, setShares] = useState<Record<string, MediaShareContract>>({});
  const [message, setMessage] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const refreshingRef = useRef(false);
  const receivedIdsRef = useRef(new Set<string>());

  function destinationFor(item: MediaAssetContract): File {
    const directory = new Directory(Paths.document, 'sharing-downloads');
    directory.create({ idempotent: true, intermediates: true });
    return new File(directory, `${item.id}.${extensionFor(item)}`);
  }

  async function downloadMedia(item: MediaAssetContract): Promise<File> {
    const destination = destinationFor(item);
    if (destination.exists && destination.size === item.byteSize) {
      receivedIdsRef.current.add(item.id);
      return destination;
    }
    if (destination.exists) destination.delete();

    const ticket = await api.mediaDownload(stationToken, item.id);
    if (ticket.mediaId !== item.id || !ticket.downloadUrl) throw new Error('Le ticket de téléchargement ne correspond pas au média demandé.');
    const downloaded = await File.downloadFileAsync(ticket.downloadUrl, destination, { idempotent: true });
    if (!downloaded.exists) throw new Error('Le média n’a pas été enregistré sur la tablette SHARING.');
    const actualSize = downloaded.size;
    if (actualSize !== item.byteSize) {
      downloaded.delete();
      throw new Error(`Le média reçu est incomplet : ${actualSize} octets sur ${item.byteSize}.`);
    }
    receivedIdsRef.current.add(item.id);
    return downloaded;
  }

  async function refresh(manual = false): Promise<void> {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    if (media.length === 0) setLoading(true);
    try {
      const items = await api.listMedia(stationToken);
      const synced = items
        .filter((item) => item.syncState === 'SYNCED' && Boolean(item.acknowledgedAt))
        .sort((left, right) => {
          const leftTime = left.capturedAt ? new Date(left.capturedAt).getTime() : 0;
          const rightTime = right.capturedAt ? new Date(right.capturedAt).getTime() : 0;
          return rightTime - leftTime;
        });
      setMedia(synced);

      let newlyReceived = 0;
      for (const item of synced) {
        if (receivedIdsRef.current.has(item.id)) continue;
        try {
          await downloadMedia(item);
          newlyReceived += 1;
        } catch {
          // The metadata remains visible and the automatic loop retries the local reception.
        }
      }
      setLastSyncAt(new Date());
      if (manual) {
        setMessage(newlyReceived > 0
          ? `${newlyReceived} nouveau${newlyReceived === 1 ? '' : 'x'} média${newlyReceived === 1 ? '' : 's'} reçu${newlyReceived === 1 ? '' : 's'} sur SHARING.`
          : 'Synchronisation actualisée. KHE continue de surveiller automatiquement les nouveaux médias.');
      } else if (newlyReceived > 0) {
        setMessage(`${newlyReceived} nouveau${newlyReceived === 1 ? '' : 'x'} média${newlyReceived === 1 ? '' : 's'} reçu${newlyReceived === 1 ? '' : 's'} automatiquement sur SHARING.`);
      }
    } catch (error) {
      if (manual || media.length === 0) setMessage(error instanceof Error ? error.message : 'Impossible de charger les médias synchronisés.');
    } finally {
      refreshingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [api, stationToken]);

  const counts = useMemo(() => ({
    photos: media.filter((item) => item.mimeType.startsWith('image/')).length,
    videos: media.filter((item) => item.mimeType.startsWith('video/')).length,
  }), [media]);

  async function save(item: MediaAssetContract): Promise<void> {
    setBusyId(item.id);
    setMessage('');
    try {
      await downloadMedia(item);
      setMessage('Média reçu et conservé dans KHE Booth sur la tablette SHARING.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Téléchargement impossible.');
    } finally { setBusyId(null); }
  }

  async function share(item: MediaAssetContract): Promise<void> {
    setBusyId(item.id);
    setMessage('');
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage natif n’est pas disponible sur cette tablette.');
      const downloaded = await downloadMedia(item);
      await Sharing.shareAsync(downloaded.uri, { dialogTitle: 'Partager avec KHE Booth', mimeType: item.mimeType || undefined });
      setMessage('Menu de partage Android ouvert avec la copie synchronisée.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Partage impossible.');
    } finally { setBusyId(null); }
  }

  async function createGuestQr(item: MediaAssetContract): Promise<void> {
    setBusyId(item.id);
    setMessage('');
    try {
      const next = await api.createMediaShare(stationToken, item.id);
      if (!next.shareUrl.startsWith('https://')) throw new Error('Le lien invité sécurisé reçu est invalide.');
      setShares((current) => ({ ...current, [item.id]: next }));
      setMessage('QR invité créé. Il pointe vers KHE Booth et non vers l’URL Blob temporaire.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de créer le QR invité.');
    } finally { setBusyId(null); }
  }

  async function revokeGuestQr(item: MediaAssetContract): Promise<void> {
    const currentShare = shares[item.id];
    if (!currentShare) return;
    setBusyId(item.id);
    setMessage('');
    try {
      await api.revokeMediaShare(stationToken, currentShare.id);
      setShares((current) => { const next = { ...current }; delete next[item.id]; return next; });
      setMessage('Lien invité révoqué. L’ancien QR ne donne plus accès au média.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de révoquer le QR invité.');
    } finally { setBusyId(null); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>GALERIE SHARING • SYNCHRONISATION AUTOMATIQUE</Text>
          <Text style={styles.title}>Moments disponibles</Text>
          <Text style={styles.help}>{eventName} • {media.length} média{media.length === 1 ? '' : 's'} • {counts.videos} vidéo{counts.videos === 1 ? '' : 's'} • {counts.photos} photo{counts.photos === 1 ? '' : 's'}</Text>
          <Text style={styles.autoSync}>● Synchronisation auto active toutes les 2 s{lastSyncAt ? ` • dernière vérification ${lastSyncAt.toLocaleTimeString()}` : ''}</Text>
        </View>
        <Pressable disabled={loading} style={styles.refreshButton} onPress={() => void refresh(true)}>
          <Text style={styles.refreshText}>{loading ? '…' : 'Actualiser la synchronisation'}</Text>
        </Pressable>
      </View>

      {loading && media.length === 0 ? (
        <View style={styles.loading}><ActivityIndicator /><Text style={styles.help}>Recherche et réception automatiques des médias…</Text></View>
      ) : media.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>En attente des premières captures</Text>
          <Text style={styles.help}>Aucune action n’est nécessaire : dès qu’un média CAPTURE est vérifié dans le stockage KHE et passe à SYNCED, SHARING le récupère automatiquement.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {media.map((item, index) => {
            const busy = busyId === item.id;
            const kind = item.mimeType.startsWith('image/') ? 'PHOTO' : 'VIDÉO';
            const guestShare = shares[item.id];
            const received = receivedIdsRef.current.has(item.id);
            return (
              <View key={item.id} style={styles.mediaCard}>
                <View style={styles.mediaTopRow}>
                  <View style={styles.mediaCopy}>
                    <Text style={styles.mediaTitle}>{kind} #{media.length - index}</Text>
                    <Text style={styles.meta}>{capturedLabel(item)}</Text>
                    <Text style={styles.meta}>{sizeLabel(item.byteSize)} • {item.mimeType}</Text>
                  </View>
                  <View style={styles.syncedBadge}><Text style={styles.syncedText}>{received ? 'REÇU ✓' : 'SYNCED ✓'}</Text></View>
                </View>
                <View style={styles.actions}>
                  <Pressable disabled={Boolean(busyId)} style={[styles.secondaryButton, Boolean(busyId) && styles.disabled]} onPress={() => void save(item)}><Text style={styles.secondaryText}>{busy ? 'Réception…' : received ? 'Reçu sur SHARING' : 'Recevoir maintenant'}</Text></Pressable>
                  <Pressable disabled={Boolean(busyId)} style={[styles.primaryButton, Boolean(busyId) && styles.disabled]} onPress={() => void share(item)}><Text style={styles.primaryText}>{busy ? 'Préparation…' : 'Partager'}</Text></Pressable>
                  <Pressable disabled={Boolean(busyId)} style={[styles.qrButton, Boolean(busyId) && styles.disabled]} onPress={() => void createGuestQr(item)}><Text style={styles.qrButtonText}>{guestShare ? 'Nouveau QR' : 'QR invité'}</Text></Pressable>
                </View>
                {guestShare ? (
                  <View style={styles.qrCard}>
                    <View style={styles.qrCanvas}><QRCode value={guestShare.shareUrl} size={180} /></View>
                    <Text selectable style={styles.shareUrl}>{guestShare.shareUrl}</Text>
                    <Text style={styles.help}>Ce QR reste stable. KHE Booth génère un accès Blob privé de courte durée seulement au moment où l’invité ouvre le lien.</Text>
                    <Pressable disabled={Boolean(busyId)} style={styles.revokeButton} onPress={() => void revokeGuestQr(item)}><Text style={styles.revokeText}>Révoquer ce QR</Text></Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.qrNote}><Text style={styles.qrTitle}>Réception automatique SHARING</Text><Text style={styles.help}>La tablette vérifie le cloud KHE toutes les 2 secondes et conserve localement chaque nouveau média validé. Le bouton d’actualisation reste disponible si un transfert tarde.</Text></View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: '#dddddd', paddingTop: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  headerCopy: { flex: 1, minWidth: 220, gap: 3 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, opacity: 0.55 },
  title: { fontSize: 20, fontWeight: '900' },
  help: { fontSize: 11, lineHeight: 16, opacity: 0.65 },
  autoSync: { fontSize: 10, lineHeight: 15, color: '#16863a', fontWeight: '800', marginTop: 3 },
  refreshButton: { borderWidth: 1, borderColor: '#111111', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  refreshText: { fontSize: 10, fontWeight: '900' },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyCard: { borderWidth: 1, borderColor: '#dddddd', borderRadius: 14, padding: 14, gap: 5 },
  emptyTitle: { fontSize: 14, fontWeight: '900' },
  list: { gap: 10 },
  mediaCard: { borderWidth: 1, borderColor: '#d7d7d7', borderRadius: 14, padding: 13, gap: 11 },
  mediaTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  mediaCopy: { flex: 1, gap: 2 },
  mediaTitle: { fontSize: 14, fontWeight: '900' },
  meta: { fontSize: 10, lineHeight: 15, opacity: 0.62 },
  syncedBadge: { backgroundColor: '#e7f7ec', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 },
  syncedText: { color: '#16863a', fontSize: 9, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: { flexGrow: 1, minWidth: 120, backgroundColor: '#111111', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  primaryText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  secondaryButton: { flexGrow: 1, minWidth: 120, borderWidth: 1, borderColor: '#111111', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  secondaryText: { fontSize: 10, fontWeight: '900' },
  qrButton: { flexGrow: 1, minWidth: 120, borderWidth: 1, borderColor: '#16863a', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  qrButtonText: { color: '#16863a', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  qrCard: { alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#e4e4e4', paddingTop: 12 },
  qrCanvas: { backgroundColor: '#ffffff', padding: 12, borderRadius: 12 },
  shareUrl: { fontSize: 9, lineHeight: 14, textAlign: 'center', opacity: 0.75 },
  revokeButton: { borderWidth: 1, borderColor: '#a53b3b', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  revokeText: { color: '#a53b3b', fontSize: 10, fontWeight: '900' },
  qrNote: { borderWidth: 1, borderColor: '#d7d7d7', borderRadius: 14, padding: 12, gap: 4 },
  qrTitle: { fontSize: 12, fontWeight: '900' },
  message: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
});
