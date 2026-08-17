import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';
import { shareMediaNatively } from '../sharing/native-share';

interface MediaGalleryProps {
  eventId: string;
  eventName: string;
  store: LocalStore;
  onClose: () => void;
}

type MediaFilter = 'ALL' | 'PHOTO' | 'VIDEO';

function isPhoto(media: LocalMediaRecord): boolean {
  return media.mimeType.startsWith('image/');
}

function SelectedVideo({ media }: { media: LocalMediaRecord }) {
  const player = useVideoPlayer(media.localUri);
  return <VideoView player={player} style={styles.viewerMedia} nativeControls contentFit="contain" surfaceType="textureView" />;
}

export function MediaGallery({ eventId, eventName, store, onClose }: MediaGalleryProps) {
  const { width } = useWindowDimensions();
  const landscape = width >= 760;
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [media, setMedia] = useState<LocalMediaRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MediaFilter>('ALL');
  const [message, setMessage] = useState('');

  async function refresh(): Promise<void> {
    setLoading(true);
    try {
      const items = await store.listMedia(eventId);
      setMedia(items);
      setSelectedId((current) => current && items.some((item) => item.localId === current) ? current : items[0]?.localId ?? null);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’ouvrir la galerie locale.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [eventId]);

  const filteredMedia = useMemo(
    () => media.filter((item) => filter === 'ALL' || (filter === 'PHOTO' ? isPhoto(item) : !isPhoto(item))),
    [filter, media],
  );
  const selected = useMemo(() => media.find((item) => item.localId === selectedId) ?? null, [media, selectedId]);
  const photoCount = media.filter(isPhoto).length;
  const videoCount = media.length - photoCount;
  const pendingCount = media.filter((item) => item.syncState !== 'SYNCED').length;

  useEffect(() => {
    if (filteredMedia.length && !filteredMedia.some((item) => item.localId === selectedId)) {
      setSelectedId(filteredMedia[0]?.localId ?? null);
    }
  }, [filteredMedia, selectedId]);

  async function shareSelected(item: LocalMediaRecord): Promise<void> {
    setSharing(true);
    try {
      await shareMediaNatively(item);
      setMessage('Partage Android ouvert.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de partager ce moment.');
    } finally {
      setSharing(false);
    }
  }

  async function printPhoto(item: LocalMediaRecord): Promise<void> {
    if (!isPhoto(item)) return;
    setPrinting(true);
    try {
      const file = new File(item.localUri);
      if (!file.exists) throw new Error('Le fichier photo local est introuvable.');
      const base64 = await file.base64();
      const html = `<!DOCTYPE html><html><head><style>@page{margin:0}html,body{margin:0}main{min-height:100vh;display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100vh;object-fit:contain}</style></head><body><main><img src="data:${item.mimeType || 'image/jpeg'};base64,${base64}" /></main></body></html>`;
      await Print.printAsync({ html });
      setMessage('Fenêtre d’impression ouverte.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’imprimer cette photo.');
    } finally {
      setPrinting(false);
    }
  }

  async function remove(item: LocalMediaRecord): Promise<void> {
    try {
      const file = new File(item.localUri);
      if (file.exists) file.delete();
      await store.deleteMedia(item.localId);
      await refresh();
      setMessage('Moment supprimé de cette tablette.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  }

  function confirmDelete(item: LocalMediaRecord): void {
    Alert.alert('Supprimer ce moment ?', item.syncState === 'SYNCED' ? 'La copie locale sera supprimée.' : 'Ce média n’est pas encore synchronisé. La suppression est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void remove(item) },
    ]);
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>KHE BOOTH</Text>
            <Text style={styles.title}>Galerie CAPTURE</Text>
            <Text style={styles.subtitle}>{eventName} • Galerie locale stable et offline-first</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{media.length}</Text><Text style={styles.summaryLabel}>moments</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{videoCount}</Text><Text style={styles.summaryLabel}>vidéos</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{photoCount}</Text><Text style={styles.summaryLabel}>photos</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{pendingCount}</Text><Text style={styles.summaryLabel}>à synchroniser</Text></View>
        </View>

        <View style={styles.filters}>
          {(['ALL', 'VIDEO', 'PHOTO'] as const).map((candidate) => (
            <Pressable key={candidate} style={[styles.filter, filter === candidate && styles.filterActive]} onPress={() => setFilter(candidate)}>
              <Text style={[styles.filterText, filter === candidate && styles.filterTextActive]}>{candidate === 'ALL' ? 'Tous' : candidate === 'VIDEO' ? 'Vidéos' : 'Photos'}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.refresh} onPress={() => void refresh()}><Text style={styles.refreshText}>↻ Actualiser</Text></Pressable>
        </View>

        {loading ? <View style={styles.center}><ActivityIndicator /><Text>Chargement…</Text></View> : null}

        {!loading && filteredMedia.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>Aucun moment pour ce filtre</Text><Text style={styles.muted}>Les prochaines captures apparaîtront ici immédiatement.</Text></View>
        ) : null}

        {selected ? (
          <View style={[styles.workspace, landscape && styles.workspaceLandscape]}>
            <View style={styles.viewerCard}>
              {isPhoto(selected)
                ? <Image source={{ uri: selected.localUri }} style={styles.viewerMedia} resizeMode="contain" />
                : <SelectedVideo key={selected.localId} media={selected} />}
              <View style={styles.viewerMeta}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.viewerTitle}>{isPhoto(selected) ? 'Photo' : 'Vidéo'} sélectionnée</Text>
                  <Text style={styles.muted}>{new Date(selected.capturedAt).toLocaleString()} • {Math.max(1, Math.round(selected.byteSize / 1024 / 1024))} Mo</Text>
                </View>
                <View style={[styles.state, selected.syncState === 'SYNCED' && styles.stateSynced]}><Text style={styles.stateText}>{selected.syncState}</Text></View>
              </View>
              <View style={styles.actions}>
                <Pressable disabled={sharing} style={styles.primary} onPress={() => void shareSelected(selected)}><Text style={styles.primaryText}>{sharing ? 'Ouverture…' : 'Partager'}</Text></Pressable>
                {isPhoto(selected) ? <Pressable disabled={printing} style={styles.secondary} onPress={() => void printPhoto(selected)}><Text style={styles.secondaryText}>{printing ? 'Préparation…' : 'Imprimer'}</Text></Pressable> : null}
                <Pressable style={styles.danger} onPress={() => confirmDelete(selected)}><Text style={styles.dangerText}>Supprimer</Text></Pressable>
              </View>
            </View>

            <View style={styles.library}>
              <Text style={styles.sectionTitle}>Moments disponibles</Text>
              <Text style={styles.muted}>Les vidéos ne démarrent plus automatiquement dans les vignettes : un seul lecteur est actif pour éviter les crashs Android.</Text>
              <View style={styles.cards}>
                {filteredMedia.map((item, index) => (
                  <Pressable key={item.localId} style={[styles.mediaCard, item.localId === selectedId && styles.mediaCardActive]} onPress={() => setSelectedId(item.localId)}>
                    {isPhoto(item)
                      ? <Image source={{ uri: item.localUri }} style={styles.thumb} resizeMode="cover" />
                      : <View style={styles.videoThumb}><Text style={styles.playIcon}>▶</Text><Text style={styles.videoLabel}>VIDÉO</Text></View>}
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardTitle}>{isPhoto(item) ? 'Photo' : 'Vidéo'} {filteredMedia.length - index}</Text>
                      <Text style={styles.cardMeta}>{new Date(item.capturedAt).toLocaleTimeString()} • {item.syncState === 'SYNCED' ? 'Synchronisé' : 'En attente'}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </View>
  );
}

const KHE_RED = '#b31520';
const KHE_GOLD = '#c9a84c';
const KHE_BLACK = '#0d0d0f';

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f6f2eb' },
  content: { padding: 18, paddingBottom: 50, gap: 16 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  brand: { color: KHE_RED, fontSize: 12, letterSpacing: 4, fontWeight: '900' },
  title: { color: KHE_BLACK, fontSize: 32, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#666', marginTop: 4 },
  closeButton: { backgroundColor: KHE_BLACK, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  closeText: { color: '#fff', fontWeight: '900' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { minWidth: 92, flexGrow: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#eadfce' },
  summaryNumber: { fontSize: 24, fontWeight: '900', color: KHE_RED },
  summaryLabel: { color: '#6c6258', fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  filterActive: { backgroundColor: KHE_RED, borderColor: KHE_RED },
  filterText: { fontWeight: '800', color: '#222' },
  filterTextActive: { color: '#fff' },
  refresh: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: KHE_GOLD },
  refreshText: { color: '#17120a', fontWeight: '900' },
  center: { padding: 30, alignItems: 'center', gap: 8 },
  empty: { padding: 32, backgroundColor: '#fff', borderRadius: 22, alignItems: 'center', gap: 6 },
  emptyIcon: { fontSize: 28, color: KHE_GOLD },
  emptyTitle: { fontWeight: '900', fontSize: 18 },
  muted: { color: '#6d665f', lineHeight: 18 },
  workspace: { gap: 16 },
  workspaceLandscape: { flexDirection: 'row', alignItems: 'flex-start' },
  viewerCard: { flex: 1.2, backgroundColor: KHE_BLACK, borderRadius: 24, padding: 12, gap: 12 },
  viewerMedia: { width: '100%', height: 340, borderRadius: 18, backgroundColor: '#000' },
  viewerMeta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  viewerTitle: { color: '#fff', fontWeight: '900', fontSize: 18 },
  state: { backgroundColor: '#4a3a3a', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  stateSynced: { backgroundColor: '#176b43' },
  stateText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { flexGrow: 1, backgroundColor: KHE_RED, borderRadius: 13, padding: 13, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { flexGrow: 1, backgroundColor: KHE_GOLD, borderRadius: 13, padding: 13, alignItems: 'center' },
  secondaryText: { color: '#17120a', fontWeight: '900' },
  danger: { flexGrow: 1, borderWidth: 1, borderColor: '#733', borderRadius: 13, padding: 13, alignItems: 'center' },
  dangerText: { color: '#ff9c9c', fontWeight: '900' },
  library: { flex: 1, backgroundColor: '#fff', borderRadius: 24, padding: 15, gap: 10 },
  sectionTitle: { fontSize: 19, fontWeight: '900', color: KHE_BLACK },
  cards: { gap: 9 },
  mediaCard: { flexDirection: 'row', backgroundColor: '#f4efe7', borderRadius: 16, padding: 8, gap: 10, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  mediaCardActive: { borderColor: KHE_GOLD, backgroundColor: '#fffaf0' },
  thumb: { width: 86, height: 66, borderRadius: 12, backgroundColor: '#ddd' },
  videoThumb: { width: 86, height: 66, borderRadius: 12, backgroundColor: KHE_BLACK, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: KHE_GOLD, fontSize: 24 },
  videoLabel: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardCopy: { flex: 1 },
  cardTitle: { fontWeight: '900', fontSize: 15 },
  cardMeta: { color: '#766e64', fontSize: 11, marginTop: 3 },
  message: { backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: KHE_GOLD, borderRadius: 14, padding: 13, color: '#312b25' },
});
