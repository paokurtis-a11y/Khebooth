import { useEventListener } from 'expo';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import type { SharingMediaFit } from '../api/station-api';
import { shouldMountSharingVideoPlayer } from './sharing-video-playback-policy';

interface PreviewProps {
  uri: string | null;
  posterUri?: string | null;
  mimeType: string;
  autoplay: boolean;
  mediaFit: SharingMediaFit;
  active?: boolean;
  startWithAudio?: boolean;
  onActivate?: (withAudio: boolean) => void;
  onAspectRatio?: (ratio: number) => void;
}

function ImageMoment({ uri, mediaFit, onAspectRatio }: Pick<PreviewProps, 'uri' | 'mediaFit' | 'onAspectRatio'>) {
  useEffect(() => {
    if (!uri) return;
    Image.getSize(uri, (width, height) => {
      if (width > 0 && height > 0) onAspectRatio?.(width / height);
    }, () => undefined);
  }, [uri, onAspectRatio]);
  if (!uri) return <LoadingMoment label="KHE • réception…" />;
  return <Image source={{ uri }} resizeMode={mediaFit === 'COVER' ? 'cover' : 'contain'} style={styles.media} />;
}

function VideoPoster({ posterUri, mediaFit, onActivate, onAspectRatio }: Pick<PreviewProps, 'posterUri' | 'mediaFit' | 'onActivate' | 'onAspectRatio'>) {
  useEffect(() => {
    if (!posterUri) return;
    Image.getSize(posterUri, (width, height) => {
      if (width > 0 && height > 0) onAspectRatio?.(width / height);
    }, () => undefined);
  }, [posterUri, onAspectRatio]);

  return <View style={styles.videoShell}>
    {posterUri ? <Image source={{ uri: posterUri }} resizeMode={mediaFit === 'COVER' ? 'cover' : 'contain'} style={styles.media} /> : <View style={styles.posterFallback}><View style={styles.posterOrbit} /><Text style={styles.posterKhe}>KHE BOOTH</Text><Text style={styles.posterPreparing}>APERÇU EN PRÉPARATION</Text></View>}
    <Pressable accessibilityRole="button" accessibilityLabel="Lire cette vidéo" style={styles.videoPoster} onPress={() => onActivate?.(false)}><View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View><Text style={styles.playText}>TOUCHER POUR LIRE</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Écouter le son de la vidéo" style={styles.audioButton} onPress={() => onActivate?.(true)}><Text style={styles.audioIcon}>🔊</Text></Pressable>
  </View>;
}

function ActiveVideoMoment({ uri, mediaFit, startWithAudio=false, onAspectRatio }: PreviewProps) {
  const [muted, setMuted] = useState(!startWithAudio);
  const player = useVideoPlayer(uri ? { uri } : null, (instance) => {
    instance.loop = true;
    instance.muted = !startWithAudio;
    instance.play();
  });

  useEffect(() => {
    player.loop = true;
    player.muted = muted;
    if (uri) player.play();
    return () => player.pause();
  }, [muted, player, uri]);

  useEventListener(player, 'sourceLoad', ({ availableVideoTracks }) => {
    const track = availableVideoTracks[0];
    const width = track?.size?.width ?? 0;
    const height = track?.size?.height ?? 0;
    if (width > 0 && height > 0) onAspectRatio?.(width / height);
  });

  if (!uri) return <LoadingMoment label="KHE • vidéo indisponible" />;
  function toggleAudio() { setMuted((current) => !current); }
  return <View style={styles.videoShell}><VideoView player={player} style={styles.media} nativeControls={false} contentFit={mediaFit === 'COVER' ? 'cover' : 'contain'} surfaceType="textureView" /><Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Écouter le son de la vidéo' : 'Couper le son de la vidéo'} style={[styles.audioButton, !muted && styles.audioButtonActive]} onPress={toggleAudio}><Text style={styles.audioIcon}>{muted ? '🔇' : '🔊'}</Text></Pressable></View>;
}

function LoadingMoment({ label }: { label: string }) {
  return <View style={styles.loading}><Text style={styles.loadingStar}>✦</Text><Text style={styles.loadingText}>{label}</Text></View>;
}

export function SharingMediaPreview(props: PreviewProps) {
  if (!props.mimeType.startsWith('video/')) return <ImageMoment uri={props.uri} mediaFit={props.mediaFit} onAspectRatio={props.onAspectRatio} />;
  if (!shouldMountSharingVideoPlayer(Boolean(props.active), props.uri)) return <VideoPoster posterUri={props.posterUri} mediaFit={props.mediaFit} onActivate={props.onActivate} onAspectRatio={props.onAspectRatio} />;
  return <ActiveVideoMoment {...props} />;
}

const styles = StyleSheet.create({
  media: { width: '100%', height: '100%' }, videoShell: { flex: 1, backgroundColor: '#151519', overflow: 'hidden' },
  videoPoster: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(10,10,12,.16)' }, playCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(10,10,12,.78)', borderWidth: 1, borderColor: '#d2ad4f', alignItems: 'center', justifyContent: 'center' }, playIcon: { color: '#d2ad4f', fontSize: 24, marginLeft: 4 }, playText: { color: '#ffffff', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textShadowColor: '#000', textShadowRadius: 5 },
  audioButton: { position: 'absolute', right: 9, top: 9, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(12,12,14,.86)', borderWidth: 1, borderColor: '#d2ad4f', alignItems: 'center', justifyContent: 'center', zIndex: 4 }, audioButtonActive: { backgroundColor: '#d2ad4f' }, audioIcon: { fontSize: 18 },
  posterFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17151a', overflow: 'hidden' }, posterOrbit: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 18, borderColor: '#d2ad4f22' }, posterKhe: { color: '#d2ad4f', fontSize: 17, fontWeight: '900', letterSpacing: 3 }, posterPreparing: { color: '#8f8b82', fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: 8 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151519', gap: 7 }, loadingStar: { color: '#d2ad4f', fontSize: 25 }, loadingText: { color: '#d2ad4f', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
