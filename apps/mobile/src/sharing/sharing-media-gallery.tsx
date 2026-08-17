import type { MediaAssetContract } from '@khe/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationApi } from '../api/station-api';

interface SharingMediaGalleryProps {
  eventName: string;
  api: StationApi;
  stationToken: string;
}

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
  const [message, setMessage] = useState('');
  const refreshingRef = useRef(false);

  async function refresh(): Promise<void> {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(true);
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de charger les médias synchronisés.');
    } finally {
      refreshingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [api, stationToken]);

  const counts = useMemo(() => ({
    photos: media.filter((item) => item.mimeType.startsWith('image/')).length,
    videos: media.filter((item) => item.mimeType.startsWith('video/')).length,
  }), [media]);

  async function downloadMedia(item: MediaAssetContract): Promise<File> {
    const ticket = await api.mediaDownload(stationToken, item.id);
    if (ticket.mediaId !== item.id || !ticket.downloadUrl) throw new Error('Le ticket de téléchargement ne correspond pas au média demandé.');

    const directory = new Directory(Paths.document, 'sharing-downloads');
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, `${item.id}.${extensionFor(item)}`);
    const downloaded = await File.downloadFileAsync(ticket.downloadUrl, destination, { idempotent: true });
    if (!downloaded.exists) throw new Error('Le média n’a pas été enregistré sur la tablette.');
    const actualSize = downloaded.size;
    if (actualSize !== item.byteSize) {
      downloaded.delete();
      throw new Error(`Le média téléchargé est incomplet : ${actualSize} octets reçus sur ${item.byteSize}.`);
    }
    return downloaded;
  }

  async function save(item: MediaAssetContract): Promise<void> {
    setBusyId(item.id);
    setMessage('');
    try {
      await downloadMedia(item);
      setMessage('Média téléchargé et conservé dans KHE Booth sur cette tablette.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Téléchargement impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function share(item: MediaAssetContract): Promise<void> {
    setBusyId(item.id);
    setMessage('');
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage natif n’est pas disponible sur cette tablette.');
      const downloaded = await downloadMedia(item);
      await Sharing.shareAsync(downloaded.uri, {
        dialogTitle: 'Partager avec KHE Booth',
        mimeType: item.mimeType || undefined,
      });
      setMessage('Menu de partage Android ouvert avec la copie cloud vérifiée.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Partage impossible.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>GALERIE CLOUD • SYNCED UNIQUEMENT</Text>
          <Text style={styles.title}>Moments disponibles</Text>
          <Text style={styles.help}>{eventName} • {media.length} média{media.length === 1 ? '' : 's'} • {counts.videos} vidéo{counts.videos === 1 ? '' : 's'} • {counts.photos} photo{counts.photos === 1 ? '' : 's'}</Text>
        </View>
        <Pressable disabled={loading} style={styles.refreshButton} onPress={() => void refresh()}>
          <Text style={styles.refreshText}>{loading ? '…' : 'Actualiser'}</Text>
        </Pressable>
      </View>

      {loading && media.length === 0 ? (
        <View style={styles.loading}><ActivityIndicator /><Text style={styles.help}>Recherche des médias synchronisés…</Text></View>
      ) : media.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucun média cloud disponible</Text>
          <Text style={styles.help}>Dès qu’une capture est vérifiée dans Blob et passe à SYNCED, elle apparaîtra ici automatiquement.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {media.map((item, index) => {
            const busy = busyId === item.id;
            const kind = item.mimeType.startsWith('image/') ? 'PHOTO' : 'VIDÉO';
            return (
              <View key={item.id} style={styles.mediaCard}>
                <View style={styles.mediaTopRow}>
                  <View style={styles.mediaCopy}>
                    <Text style={styles.mediaTitle}>{kind} #{media.length - index}</Text>
                    <Text style={styles.meta}>{capturedLabel(item)}</Text>
                    <Text style={styles.meta}>{sizeLabel(item.byteSize)} • {item.mimeType}</Text>
                  </View>
                  <View style={styles.syncedBadge}><Text style={styles.syncedText}>SYNCED ✓</Text></View>
                </View>
                <View style={styles.actions}>
                  <Pressable disabled={Boolean(busyId)} style={[styles.secondaryButton, Boolean(busyId) && styles.disabled]} onPress={() => void save(item)}>
                    <Text style={styles.secondaryText}>{busy ? 'Téléchargement…' : 'Télécharger'}</Text>
                  </Pressable>
                  <Pressable disabled={Boolean(busyId)} style={[styles.primaryButton, Boolean(busyId) && styles.disabled]} onPress={() => void share(item)}>
                    <Text style={styles.primaryText}>{busy ? 'Préparation…' : 'Partager'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.qrNote}>
        <Text style={styles.qrTitle}>QR invité</Text>
        <Text style={styles.help}>Le QR ne contientra jamais l’URL Blob temporaire. Il sera activé avec une route invité stable et révocable lors de l’étape suivante.</Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: '#dddddd', paddingTop: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, opacity: 0.55 },
  title: { fontSize: 20, fontWeight: '900' },
  help: { fontSize: 11, lineHeight: 16, opacity: 0.65 },
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
  disabled: { opacity: 0.45 },
  qrNote: { borderWidth: 1, borderColor: '#d7d7d7', borderRadius: 14, padding: 12, gap: 4 },
  qrTitle: { fontSize: 12, fontWeight: '900' },
  message: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
});
