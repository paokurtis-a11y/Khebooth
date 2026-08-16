import { File } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
    <View style={styles.heroCard}>
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" surfaceType="textureView" />
      <View style={styles.heroMeta}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>Moment du {new Date(media.capturedAt).toLocaleDateString()}</Text>
          <Text style={styles.meta}>{new Date(media.capturedAt).toLocaleTimeString()} • {Math.max(1, Math.round(media.byteSize / 1024 / 1024))} Mo</Text>
        </View>
        <View style={styles.stateBadge}><Text style={styles.stateBadgeText}>{media.syncState}</Text></View>
      </View>
    </View>
  );
}

export function MediaGallery({ eventId, eventName, store, onClose }: MediaGalleryProps) {
  const { width } = useWindowDimensions();
  const landscape = width >= 760;
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
      setSelectedId((current) => current && items.some((item) => item.localId === current) ? current : items[0]?.localId ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’ouvrir la galerie locale.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [eventId]);

  const selected = useMemo(() => media.find((item) => item.localId === selectedId) ?? null, [media, selectedId]);
  const pendingCount = media.filter((item) => item.syncState !== 'SYNCED').length;

  async function deleteSelected(item: LocalMediaRecord): Promise<void> {
    try {
      const file = new File(item.localUri);
      if (file.exists) file.delete();
      await store.deleteMedia(item.localId);
      setMessage('Vidéo supprimée de cette tablette.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  }

  function confirmDelete(item: LocalMediaRecord): void {
    Alert.alert(
      'Supprimer cette vidéo ?',
      item.syncState === 'SYNCED'
        ? 'La copie locale sera supprimée de cette tablette.'
        : 'Cette vidéo n’est pas encore synchronisée. Sa suppression locale est définitive et annulera son envoi.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void deleteSelected(item) },
      ],
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={[styles.pageScroll, landscape && styles.pageScrollLandscape]} showsVerticalScrollIndicator>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.brand}>KHE BOOTH</Text>
            <Text style={styles.title}>Galerie interactive</Text>
            <Text style={styles.subtitle}>{eventName} • Vos moments, disponibles même hors ligne</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{media.length}</Text><Text style={styles.summaryLabel}>vidéo{media.length === 1 ? '' : 's'}</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{pendingCount}</Text><Text style={styles.summaryLabel}>à synchroniser</Text></View>
          <Pressable style={styles.refreshButton} onPress={() => void refresh()}><Text style={styles.refreshText}>↻ Actualiser</Text></Pressable>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Chargement des vidéos locales…</Text></View>
        ) : media.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>▶</Text><Text style={styles.emptyTitle}>La galerie attend votre premier moment</Text><Text style={styles.muted}>Enregistrez une vidéo depuis CAPTURE : elle apparaîtra ici immédiatement.</Text></View>
        ) : (
          <View style={[styles.content, landscape && styles.contentLandscape]}>
            <View style={styles.viewerColumn}>
              {selected ? <GalleryPlayer key={selected.localId} media={selected} /> : null}
              {selected ? (
                <Pressable style={styles.deleteButton} onPress={() => confirmDelete(selected)}>
                  <Text style={styles.deleteText}>Supprimer cette vidéo</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.libraryColumn}>
              <Text style={styles.sectionTitle}>Tous les moments</Text>
              <Text style={styles.sectionHint}>Touchez une carte pour la regarder.</Text>
              <ScrollView horizontal={!landscape} nestedScrollEnabled style={styles.strip} contentContainerStyle={styles.stripContent}>
                {media.map((item, index) => (
                  <Pressable key={item.localId} style={[styles.mediaCard, landscape && styles.mediaCardLandscape, item.localId === selectedId && styles.mediaCardSelected]} onPress={() => setSelectedId(item.localId)}>
                    <View style={styles.playCircle}><Text style={styles.playText}>▶</Text></View>
                    <Text style={styles.mediaTitle}>Vidéo {media.length - index}</Text>
                    <Text style={styles.meta}>{new Date(item.capturedAt).toLocaleTimeString()}</Text>
                    <Text style={styles.meta}>{Math.max(1, Math.round(item.byteSize / 1024 / 1024))} Mo</Text>
                    <View style={styles.miniState}><Text style={styles.miniStateText}>{item.syncState === 'SYNCED' ? 'Synchronisée' : 'Hors ligne'}</Text></View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0b0b0c' },
  pageScroll: { padding: 20, paddingTop: 28, paddingBottom: 48, gap: 18 },
  pageScrollLandscape: { paddingHorizontal: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  headerText: { flex: 1 },
  brand: { color: '#ffffff', fontSize: 12, letterSpacing: 3, fontWeight: '900' },
  title: { color: '#ffffff', fontSize: 30, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#a9a9a9', marginTop: 4, lineHeight: 19 },
  closeButton: { borderWidth: 1, borderColor: '#555555', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  closeText: { color: '#ffffff', fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#171719', borderRadius: 16, padding: 14 },
  summaryNumber: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  summaryLabel: { color: '#9d9d9d', fontSize: 12 },
  refreshButton: { justifyContent: 'center', paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#ffffff' },
  refreshText: { color: '#111111', fontWeight: '900' },
  center: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { padding: 30, backgroundColor: '#171719', borderRadius: 22, gap: 9, alignItems: 'center' },
  emptyIcon: { color: '#111111', backgroundColor: '#ffffff', width: 54, height: 54, borderRadius: 27, textAlign: 'center', textAlignVertical: 'center', fontSize: 18 },
  emptyTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  muted: { color: '#9d9d9d', textAlign: 'center' },
  content: { gap: 18 },
  contentLandscape: { flexDirection: 'row', alignItems: 'flex-start' },
  viewerColumn: { flex: 1.45, gap: 10 },
  libraryColumn: { flex: 1, minWidth: 0 },
  heroCard: { backgroundColor: '#171719', borderRadius: 22, padding: 12, gap: 10, overflow: 'hidden' },
  video: { width: '100%', aspectRatio: 9 / 16, maxHeight: 600, backgroundColor: '#000000', borderRadius: 16 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroTitle: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  meta: { color: '#9d9d9d', fontSize: 12 },
  stateBadge: { backgroundColor: '#27272a', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  stateBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  deleteButton: { borderWidth: 1, borderColor: '#713838', borderRadius: 14, padding: 13, alignItems: 'center' },
  deleteText: { color: '#ffb1b1', fontWeight: '900' },
  sectionTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  sectionHint: { color: '#8d8d8d', fontSize: 12, marginTop: 3, marginBottom: 8 },
  strip: { flexGrow: 0 },
  stripContent: { gap: 10, paddingBottom: 8 },
  mediaCard: { width: 145, minHeight: 152, backgroundColor: '#171719', borderWidth: 1, borderColor: '#27272a', borderRadius: 18, padding: 14, gap: 5 },
  mediaCardLandscape: { width: '100%', minHeight: 112, marginBottom: 8 },
  mediaCardSelected: { borderColor: '#ffffff', backgroundColor: '#222225' },
  playCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  playText: { color: '#111111', fontSize: 14, marginLeft: 2 },
  mediaTitle: { color: '#ffffff', fontWeight: '900' },
  miniState: { alignSelf: 'flex-start', backgroundColor: '#2b2b2e', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, marginTop: 3 },
  miniStateText: { color: '#dddddd', fontSize: 9, fontWeight: '800' },
  message: { color: '#ffffff', backgroundColor: '#171719', borderRadius: 12, padding: 12, lineHeight: 18 },
});
