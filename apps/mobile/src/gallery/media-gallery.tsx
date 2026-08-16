import { File } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';

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

function GalleryPlayer({ media }: { media: LocalMediaRecord }) {
  if (isPhoto(media)) {
    return (
      <View style={styles.heroCard}>
        <Image source={{ uri: media.localUri }} style={styles.photo} resizeMode="contain" />
        <HeroMeta media={media} />
      </View>
    );
  }
  return <VideoGalleryPlayer media={media} />;
}

function VideoGalleryPlayer({ media }: { media: LocalMediaRecord }) {
  const player = useVideoPlayer(media.localUri);
  return (
    <View style={styles.heroCard}>
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" surfaceType="textureView" />
      <HeroMeta media={media} />
    </View>
  );
}

function HeroMeta({ media }: { media: LocalMediaRecord }) {
  return (
    <View style={styles.heroMeta}>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroTitle}>Moment du {new Date(media.capturedAt).toLocaleDateString()}</Text>
        <Text style={styles.meta}>{new Date(media.capturedAt).toLocaleTimeString()} • {Math.max(1, Math.round(media.byteSize / 1024 / 1024))} Mo</Text>
      </View>
      <View style={styles.stateBadge}><Text style={styles.stateBadgeText}>{media.syncState}</Text></View>
    </View>
  );
}

function AnimatedMoment({ media, selected, label, onPress, landscape }: { media: LocalMediaRecord; selected: boolean; label: string; onPress: () => void; landscape: boolean }) {
  if (isPhoto(media)) {
    return (
      <Pressable style={[styles.mediaCard, landscape && styles.mediaCardLandscape, selected && styles.mediaCardSelected]} onPress={onPress}>
        <Image source={{ uri: media.localUri }} style={[styles.previewMedia, landscape && styles.previewMediaLandscape]} resizeMode="cover" />
        <MomentMeta media={media} label={label} />
      </Pressable>
    );
  }
  return <AnimatedVideoMoment media={media} selected={selected} label={label} onPress={onPress} landscape={landscape} />;
}

function AnimatedVideoMoment({ media, selected, label, onPress, landscape }: { media: LocalMediaRecord; selected: boolean; label: string; onPress: () => void; landscape: boolean }) {
  const player = useVideoPlayer(media.localUri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <Pressable style={[styles.mediaCard, landscape && styles.mediaCardLandscape, selected && styles.mediaCardSelected]} onPress={onPress}>
      <View style={styles.previewShell}>
        <VideoView player={player} style={[styles.previewMedia, landscape && styles.previewMediaLandscape]} nativeControls={false} contentFit="cover" surfaceType="textureView" />
        <View pointerEvents="none" style={styles.motionBadge}><Text style={styles.motionBadgeText}>● LIVE</Text></View>
      </View>
      <MomentMeta media={media} label={label} />
    </Pressable>
  );
}

function MomentMeta({ media, label }: { media: LocalMediaRecord; label: string }) {
  return (
    <View style={styles.momentMeta}>
      <Text style={styles.mediaTitle}>{label}</Text>
      <Text style={styles.meta}>{new Date(media.capturedAt).toLocaleTimeString()}</Text>
      <Text style={styles.meta}>{Math.max(1, Math.round(media.byteSize / 1024 / 1024))} Mo</Text>
      <View style={styles.miniState}><Text style={styles.miniStateText}>{media.syncState === 'SYNCED' ? 'Synchronisé' : 'Hors ligne'}</Text></View>
    </View>
  );
}

export function MediaGallery({ eventId, eventName, store, onClose }: MediaGalleryProps) {
  const { width } = useWindowDimensions();
  const landscape = width >= 760;
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<LocalMediaRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MediaFilter>('ALL');
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

  const filteredMedia = useMemo(() => media.filter((item) => filter === 'ALL' || (filter === 'PHOTO' ? isPhoto(item) : !isPhoto(item))), [filter, media]);
  const selected = useMemo(() => media.find((item) => item.localId === selectedId) ?? null, [media, selectedId]);
  const pendingCount = media.filter((item) => item.syncState !== 'SYNCED').length;
  const photoCount = media.filter(isPhoto).length;
  const videoCount = media.length - photoCount;

  useEffect(() => {
    if (filteredMedia.length > 0 && !filteredMedia.some((item) => item.localId === selectedId)) setSelectedId(filteredMedia[0]?.localId ?? null);
  }, [filter, filteredMedia, selectedId]);

  async function deleteSelected(item: LocalMediaRecord): Promise<void> {
    try {
      const file = new File(item.localUri);
      if (file.exists) file.delete();
      await store.deleteMedia(item.localId);
      setMessage(`${isPhoto(item) ? 'Photo' : 'Vidéo'} supprimée de cette tablette.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  }

  function confirmDelete(item: LocalMediaRecord): void {
    const kind = isPhoto(item) ? 'photo' : 'vidéo';
    Alert.alert(
      `Supprimer cette ${kind} ?`,
      item.syncState === 'SYNCED'
        ? 'La copie locale sera supprimée de cette tablette.'
        : `Cette ${kind} n’est pas encore synchronisée. Sa suppression locale est définitive et annulera son envoi.`,
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
            <Text style={styles.subtitle}>{eventName} • Vos moments prennent vie, même hors ligne</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{media.length}</Text><Text style={styles.summaryLabel}>moments</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{videoCount}</Text><Text style={styles.summaryLabel}>vidéos</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{photoCount}</Text><Text style={styles.summaryLabel}>photos</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{pendingCount}</Text><Text style={styles.summaryLabel}>à synchroniser</Text></View>
        </View>

        <View style={styles.filterRow}>
          {(['ALL', 'VIDEO', 'PHOTO'] as const).map((candidate) => (
            <Pressable key={candidate} onPress={() => setFilter(candidate)} style={[styles.filterButton, filter === candidate && styles.filterButtonActive]}>
              <Text style={filter === candidate ? styles.filterTextActive : styles.filterText}>{candidate === 'ALL' ? 'Tous' : candidate === 'VIDEO' ? 'Vidéos' : 'Photos'}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.refreshButton} onPress={() => void refresh()}><Text style={styles.refreshText}>↻ Actualiser</Text></Pressable>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Chargement des moments locaux…</Text></View>
        ) : filteredMedia.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>La galerie attend votre prochain moment</Text><Text style={styles.muted}>Les photos et vidéos prises depuis CAPTURE apparaîtront ici immédiatement.</Text></View>
        ) : (
          <View style={[styles.content, landscape && styles.contentLandscape]}>
            <View style={styles.viewerColumn}>
              {selected ? <GalleryPlayer key={selected.localId} media={selected} /> : null}
              {selected ? (
                <Pressable style={styles.deleteButton} onPress={() => confirmDelete(selected)}>
                  <Text style={styles.deleteText}>Supprimer ce moment</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.libraryColumn}>
              <Text style={styles.sectionTitle}>Tous les moments</Text>
              <Text style={styles.sectionHint}>Les vidéos bougent silencieusement pour donner vie à la galerie. Touchez une carte pour l’ouvrir.</Text>
              <ScrollView horizontal={!landscape} nestedScrollEnabled style={styles.strip} contentContainerStyle={styles.stripContent}>
                {filteredMedia.map((item, index) => (
                  <AnimatedMoment
                    key={item.localId}
                    media={item}
                    selected={item.localId === selectedId}
                    label={`${isPhoto(item) ? 'Photo' : 'Vidéo'} ${filteredMedia.length - index}`}
                    onPress={() => setSelectedId(item.localId)}
                    landscape={landscape}
                  />
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
  summaryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summaryCard: { flexGrow: 1, minWidth: 88, backgroundColor: '#171719', borderRadius: 16, padding: 14 },
  summaryNumber: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  summaryLabel: { color: '#9d9d9d', fontSize: 12 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filterButton: { borderWidth: 1, borderColor: '#4b4b4e', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 10 },
  filterButtonActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  filterText: { color: '#d8d8d8', fontWeight: '800', fontSize: 11 },
  filterTextActive: { color: '#111111', fontWeight: '900', fontSize: 11 },
  refreshButton: { justifyContent: 'center', paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#ffffff' },
  refreshText: { color: '#111111', fontWeight: '900' },
  center: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 10 },
  empty: { padding: 30, backgroundColor: '#171719', borderRadius: 22, gap: 9, alignItems: 'center' },
  emptyIcon: { color: '#111111', backgroundColor: '#ffffff', width: 54, height: 54, borderRadius: 27, textAlign: 'center', textAlignVertical: 'center', fontSize: 22 },
  emptyTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  muted: { color: '#9d9d9d', textAlign: 'center' },
  content: { gap: 18 },
  contentLandscape: { flexDirection: 'row', alignItems: 'flex-start' },
  viewerColumn: { flex: 1.45, gap: 10 },
  libraryColumn: { flex: 1, minWidth: 0 },
  heroCard: { backgroundColor: '#171719', borderRadius: 22, padding: 12, gap: 10, overflow: 'hidden' },
  video: { width: '100%', aspectRatio: 9 / 16, maxHeight: 600, backgroundColor: '#000000', borderRadius: 16 },
  photo: { width: '100%', aspectRatio: 9 / 16, maxHeight: 600, backgroundColor: '#000000', borderRadius: 16 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroTitle: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  meta: { color: '#9d9d9d', fontSize: 12 },
  stateBadge: { backgroundColor: '#27272a', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  stateBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  deleteButton: { borderWidth: 1, borderColor: '#713838', borderRadius: 14, padding: 13, alignItems: 'center' },
  deleteText: { color: '#ffb1b1', fontWeight: '900' },
  sectionTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  sectionHint: { color: '#8d8d8d', fontSize: 12, marginTop: 3, marginBottom: 8, lineHeight: 17 },
  strip: { flexGrow: 0 },
  stripContent: { gap: 10, paddingBottom: 8 },
  mediaCard: { width: 170, backgroundColor: '#171719', borderWidth: 1, borderColor: '#27272a', borderRadius: 18, padding: 8, gap: 7, overflow: 'hidden' },
  mediaCardLandscape: { width: '100%', minHeight: 132, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  mediaCardSelected: { borderColor: '#ffffff', backgroundColor: '#222225' },
  previewShell: { position: 'relative' },
  previewMedia: { width: '100%', aspectRatio: 1, borderRadius: 13, backgroundColor: '#050505' },
  previewMediaLandscape: { width: 104, height: 104, aspectRatio: undefined },
  motionBadge: { position: 'absolute', left: 7, bottom: 7, backgroundColor: 'rgba(0,0,0,0.66)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  motionBadgeText: { color: '#ffffff', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  momentMeta: { flex: 1, gap: 4, padding: 4 },
  mediaTitle: { color: '#ffffff', fontWeight: '900' },
  miniState: { alignSelf: 'flex-start', backgroundColor: '#2b2b2e', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, marginTop: 3 },
  miniStateText: { color: '#dddddd', fontSize: 9, fontWeight: '800' },
  message: { color: '#ffffff', backgroundColor: '#171719', borderRadius: 12, padding: 12, lineHeight: 18 },
});