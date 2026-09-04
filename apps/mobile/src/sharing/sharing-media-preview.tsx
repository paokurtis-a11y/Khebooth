import { useEventListener } from 'expo';
import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import type { SharingMediaFit } from '../api/station-api';
import { shouldMountSharingVideoPlayer } from './sharing-video-playback-policy';

interface PreviewProps {
  uri: string | null;
  mimeType: string;
  mediaFit: SharingMediaFit;
  active?: boolean;
  muted?: boolean;
  onActivate?: () => void;
  onToggleMuted?: () => void;
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

function VideoPoster({ available, muted=true, onActivate, onToggleMuted }: Pick<PreviewProps, 'muted' | 'onActivate' | 'onToggleMuted'> & { available: boolean }) {
  return <View style={styles.videoShell}>
    <Pressable disabled={!available} accessibilityRole="button" accessibilityLabel={available ? 'Visualiser cette vidéo' : 'Vidéo en cours de réception'} style={styles.videoPoster} onPress={onActivate}><View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View><Text style={styles.playText}>{available ? 'TOUCHER POUR VISUALISER LA VIDÉO' : 'VIDÉO EN COURS DE RÉCEPTION'}</Text></Pressable>
    <Pressable disabled={!available} accessibilityRole="button" accessibilityLabel={muted ? 'Activer le son de la vidéo' : 'Couper le son de la vidéo'} style={[styles.audioButton, !muted && styles.audioButtonActive, !available && styles.audioButtonDisabled]} onPress={onToggleMuted}><Text style={styles.audioIcon}>{muted ? '🔇' : '🔊'}</Text></Pressable>
  </View>;
}

function ActiveVideoMoment({ uri, mediaFit, muted=true, onToggleMuted, onAspectRatio }: PreviewProps) {
  const player = useVideoPlayer(uri ? { uri } : null, (instance) => {
    instance.loop = true;
    instance.muted = muted;
    instance.play();
  });

  useEffect(() => {
    player.loop = true;
    player.muted = muted;
    if (uri) player.play();
  }, [muted, player, uri]);

  useEffect(() => () => player.pause(), [player]);

  useEventListener(player, 'sourceLoad', ({ availableVideoTracks }) => {
    const track = availableVideoTracks[0];
    const width = track?.size?.width ?? 0;
    const height = track?.size?.height ?? 0;
    if (width > 0 && height > 0) onAspectRatio?.(width / height);
  });

  if (!uri) return <LoadingMoment label="KHE • vidéo indisponible" />;
  return <View style={styles.videoShell}><VideoView player={player} style={styles.media} nativeControls={false} contentFit={mediaFit === 'COVER' ? 'cover' : 'contain'} surfaceType="textureView" /><Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Activer le son de la vidéo' : 'Couper le son de la vidéo'} style={[styles.audioButton, !muted && styles.audioButtonActive]} onPress={onToggleMuted}><Text style={styles.audioIcon}>{muted ? '🔇' : '🔊'}</Text></Pressable></View>;
}

function LoadingMoment({ label }: { label: string }) {
  return <View style={styles.loading}><Text style={styles.loadingStar}>✦</Text><Text style={styles.loadingText}>{label}</Text></View>;
}

export function SharingMediaPreview(props: PreviewProps) {
  if (!props.mimeType.startsWith('video/')) return <ImageMoment uri={props.uri} mediaFit={props.mediaFit} onAspectRatio={props.onAspectRatio} />;
  if (!shouldMountSharingVideoPlayer(Boolean(props.active), props.uri)) return <VideoPoster available={Boolean(props.uri)} muted={props.muted} onActivate={props.onActivate} onToggleMuted={props.onToggleMuted} />;
  return <ActiveVideoMoment {...props} />;
}

const styles = StyleSheet.create({
  media: { width: '100%', height: '100%' }, videoShell: { flex: 1, backgroundColor: '#151519', overflow: 'hidden' },
  videoPoster: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#08080a' }, playCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#171719', borderWidth: 1, borderColor: '#d2ad4f', alignItems: 'center', justifyContent: 'center' }, playIcon: { color: '#d2ad4f', fontSize: 24, marginLeft: 4 }, playText: { maxWidth: '75%', color: '#ffffff', fontSize: 9, lineHeight: 14, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
  audioButton: { position: 'absolute', right: 9, top: 9, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(12,12,14,.86)', borderWidth: 1, borderColor: '#d2ad4f', alignItems: 'center', justifyContent: 'center', zIndex: 4 }, audioButtonActive: { backgroundColor: '#d2ad4f' }, audioButtonDisabled: { opacity: .45 }, audioIcon: { fontSize: 18 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151519', gap: 7 }, loadingStar: { color: '#d2ad4f', fontSize: 25 }, loadingText: { color: '#d2ad4f', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
