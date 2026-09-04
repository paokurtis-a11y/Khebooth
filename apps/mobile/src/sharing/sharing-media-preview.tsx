import { useEventListener } from 'expo';
import { useEffect } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

function VolumeIcon({ muted }: { muted: boolean }) {
  const color = muted ? '#d2ad4f' : '#111114';
  return <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden>
    <Path d="M4 9.2v5.6h3.3l4.7 3.8V5.4L7.3 9.2H4Z" fill={color} />
    {muted
      ? <><Path d="m16.2 9.2 4.6 5.6M20.8 9.2l-4.6 5.6" stroke={color} strokeWidth={1.9} strokeLinecap="round" /></>
      : <><Path d="M15.6 9.1a4.3 4.3 0 0 1 0 5.8" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" /><Path d="M18.4 6.7a7.6 7.6 0 0 1 0 10.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" /></>}
  </Svg>;
}

function VideoPoster({ available, muted=true, onActivate, onToggleMuted }: Pick<PreviewProps, 'muted' | 'onActivate' | 'onToggleMuted'> & { available: boolean }) {
  return <View style={styles.videoShell}>
    <Pressable disabled={!available} accessibilityRole="button" accessibilityLabel={available ? 'Visualiser cette vidéo' : 'Vidéo en cours de réception'} style={styles.videoPoster} onPress={onActivate}>
      <View style={styles.playCircle}><Text style={styles.playIcon}>▶</Text></View>
      <View style={styles.playMessage}><Text style={styles.playLead}>{available ? 'TOUCHER POUR' : 'MÉDIA KHE'}</Text><Text style={styles.playText}>{available ? 'VISUALISER LA VIDÉO' : 'VIDÉO EN COURS DE RÉCEPTION'}</Text><View style={styles.playUnderline} /></View>
    </Pressable>
    <Pressable disabled={!available} accessibilityRole="button" accessibilityLabel={muted ? 'Activer le son de la vidéo' : 'Couper le son de la vidéo'} style={[styles.audioButton, !muted && styles.audioButtonActive, !available && styles.audioButtonDisabled]} onPress={onToggleMuted}><VolumeIcon muted={muted} /></Pressable>
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

  useEventListener(player, 'sourceLoad', ({ availableVideoTracks }) => {
    const track = availableVideoTracks[0];
    const width = track?.size?.width ?? 0;
    const height = track?.size?.height ?? 0;
    if (width > 0 && height > 0) onAspectRatio?.(width / height);
  });

  if (!uri) return <LoadingMoment label="KHE • vidéo indisponible" />;
  return <View style={styles.videoShell}><VideoView player={player} style={styles.media} nativeControls={false} contentFit={mediaFit === 'COVER' ? 'cover' : 'contain'} surfaceType="textureView" /><Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Activer le son de la vidéo' : 'Couper le son de la vidéo'} style={[styles.audioButton, !muted && styles.audioButtonActive]} onPress={onToggleMuted}><VolumeIcon muted={muted} /></Pressable></View>;
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
  media: { width: '100%', height: '100%' }, videoShell: { width: '100%', height: '100%', position: 'relative', backgroundColor: '#08080a', overflow: 'hidden' },
  videoPoster: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 24, backgroundColor: '#08080a' }, playCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#141416', borderWidth: 1.5, borderColor: '#d2ad4f', alignItems: 'center', justifyContent: 'center', shadowColor: '#d2ad4f', shadowOpacity: .34, shadowRadius: 12, elevation: 5 }, playIcon: { color: '#d2ad4f', fontSize: 25, marginLeft: 4 }, playMessage: { alignItems: 'center', justifyContent: 'center', maxWidth: 300 }, playLead: { color: '#a9a4a0', fontFamily: Platform.select({ android: 'sans-serif-medium', ios: 'Avenir Next' }), fontSize: 9, lineHeight: 14, fontWeight: '700', letterSpacing: 2.5, textAlign: 'center' }, playText: { color: '#ffffff', fontFamily: Platform.select({ android: 'sans-serif-medium', ios: 'Avenir Next' }), fontSize: 13, lineHeight: 20, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' }, playUnderline: { width: 42, height: 2, borderRadius: 2, backgroundColor: '#d2ad4f', marginTop: 9 },
  audioButton: { position: 'absolute', right: 12, top: 12, width: 46, height: 46, borderRadius: 23, backgroundColor: '#111114', borderWidth: 1.5, borderColor: '#d2ad4f', alignItems: 'center', justifyContent: 'center', zIndex: 4, shadowColor: '#000', shadowOpacity: .28, shadowRadius: 8, elevation: 6 }, audioButtonActive: { backgroundColor: '#d2ad4f' }, audioButtonDisabled: { opacity: .45 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151519', gap: 7 }, loadingStar: { color: '#d2ad4f', fontSize: 25 }, loadingText: { color: '#d2ad4f', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
