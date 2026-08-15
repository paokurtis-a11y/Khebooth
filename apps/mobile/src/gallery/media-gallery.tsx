import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';

interface MediaGalleryProps {
  eventId: string;
  eventName: string;
  store: LocalStore;
  onClose: () => void;
}

function GalleryPlayer({ media }: { media: LocalMediaRecord }) {
  const player = useVideoPlayer(media.localUri);

  return (
    <View style={styles.playerCard}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="contain"
        surfaceType="textureView"
      />
      <Text style={styles.fileName}>{media.localId}.mp4</Text>
      <Text style={styles.meta}>
        {new Date(media.capturedAt).toLocaleString()} • {Math.max(1, Math.round(media.byteSize / 1024 / 1024))} Mo
      </Text>
      <Text style={styles.state}>État : {media.syncState}</Text>
    </View>
  );
}

export function MediaGallery({ eventId, eventName, store, onClose }: MediaGalleryProps) {
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<LocalMediaRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function refresh(): Promise<void> {
    setLoading(true);
    setMessage('');
    try {
      const items = await store.listMedia(eventId);
      setMedia(items);
      setSelectedId((current) => {
        if (current && items.some((item) => item.localId === current)) return current;
        return items[0]?.localId ?? null;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’ouvrir la galerie locale.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [eventId]);

  const selected = useMemo(
    () => media.find((item) => item.localId === selectedId) ?? null,
    [media, selectedId],
  );
  const pendingCount = media.filter((item) => item.syncState !== 'SYNCED').length;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.brand}>KHE BOOTH</Text>
          <Text style={styles.title}>Galerie</Text>
          <Text style={styles.subtitle}>{eventName}</Text>
        </View>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Fermer</Text>
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{media.length}</Text>
          <Text style={styles.summaryLabel}>vidéo{media.length === 1 ? '' : 's'}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>en attente</Text>
        </View>
        <Pressable style={styles.refreshButton} onPress={() => void refresh()}>
          <Text style={styles.refreshText}>Actualiser</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Chargement des vidéos locales…</Text>
        </View>
      ) : media.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aucune vidéo pour le moment</Text>
          <Text style={styles.muted}>Les prochaines captures apparaîtront ici automatiquement.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {selected ? <GalleryPlayer key={selected.localId} media={selected} /> : null}

          <Text style={styles.sectionTitle}>Toutes les vidéos</Text>
          {media.map((item, index) => (
            <Pressable
              key={item.localId}
              style={[styles.mediaRow, item.localId === selectedId && styles.mediaRowSelected]}
              onPress={() => setSelectedId(item.localId)}
            >
              <View style={styles.indexBadge}>
                <Text style={styles.indexText}>{media.length - index}</Text>
              </View>
              <View style={styles.mediaInfo}>
                <Text style={styles.mediaTitle}>Vidéo {new Date(item.capturedAt).toLocaleTimeString()}</Text>
                <Text style={styles.meta}>
                  {new Date(item.capturedAt).toLocaleDateString()} • {Math.max(1, Math.round(item.byteSize / 1024 / 1024))} Mo
                </Text>
              </View>
              <View style={styles.stateBadge}>
                <Text style={styles.stateBadgeText}>{item.syncState}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010', paddingTop: 22 },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  headerText: { flex: 1 },
  brand: { color: '#ffffff', fontSize: 12, letterSpacing: 3, fontWeight: '900' },
  title: { color: '#ffffff', fontSize: 32, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#a9a9a9', marginTop: 2 },
  closeButton: { borderWidth: 1, borderColor: '#555555', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  closeText: { color: '#ffffff', fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 18 },
  summaryCard: { flex: 1, backgroundColor: '#1b1b1b', borderRadius: 14, padding: 12 },
  summaryNumber: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  summaryLabel: { color: '#9d9d9d', fontSize: 12 },
  refreshButton: { justifyContent: 'center', paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#ffffff' },
  refreshText: { color: '#111111', fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { margin: 20, padding: 24, backgroundColor: '#1b1b1b', borderRadius: 18, gap: 8 },
  emptyTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  muted: { color: '#9d9d9d' },
  scrollContent: { padding: 20, gap: 12 },
  playerCard: { backgroundColor: '#1b1b1b', borderRadius: 18, padding: 12, gap: 8 },
  video: { width: '100%', aspectRatio: 9 / 16, backgroundColor: '#000000', borderRadius: 14 },
  fileName: { color: '#ffffff', fontWeight: '800' },
  meta: { color: '#9d9d9d', fontSize: 12 },
  state: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 8 },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#1b1b1b', borderWidth: 1, borderColor: '#1b1b1b' },
  mediaRowSelected: { borderColor: '#ffffff' },
  indexBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  indexText: { color: '#111111', fontWeight: '900' },
  mediaInfo: { flex: 1 },
  mediaTitle: { color: '#ffffff', fontWeight: '800' },
  stateBadge: { backgroundColor: '#2a2a2a', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  stateBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  error: { color: '#ffffff', padding: 20 },
});
