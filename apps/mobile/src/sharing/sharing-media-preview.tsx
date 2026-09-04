import { useEventListener } from 'expo';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { SharingMediaFit } from '../api/station-api';

interface PreviewProps {
  uri: string | null;
  mimeType: string;
  autoplay: boolean;
  mediaFit: SharingMediaFit;
  active?: boolean;
  onActivate?: () => void;
  onAspectRatio?: (ratio: number) => void;
}

function ImageMoment({ uri, mediaFit, onAspectRatio }: Pick<PreviewProps, 'uri' | 'mediaFit' | 'onAspectRatio'>) {
  useEffect(() => {
    if (!uri) return;
    Image.getSize(uri, (width, height) => {
      if (width > 0 && height > 0) onAspectRatio?.(width / height);
    }, () => undefined);
  }, [uri, onAspectRatio]);
  if (!uri) return <LoadingMoment />;
  return <Image source={{ uri }} resizeMode={mediaFit === 'COVER' ? 'cover' : 'contain'} style={styles.media} />;
}

function VideoMoment({ uri, autoplay, mediaFit, active=false, onActivate, onAspectRatio }: PreviewProps) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri ? { uri } : null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  useEffect(() => {
    player.loop = true;
    player.muted = muted;
    if (!active) player.pause();
    else if (autoplay && uri) player.play();
  }, [active, autoplay, muted, player, uri]);

  useEventListener(player, 'sourceLoad', ({ availableVideoTracks }) => {
    const track = availableVideoTracks[0];
    const width = track?.size?.width ?? 0;
    const height = track?.size?.height ?? 0;
    if (width > 0 && height > 0) onAspectRatio?.(width / height);
    if (!active) { player.currentTime = 0.08; player.pause(); }
  });

  if (!uri) return <LoadingMoment />;
  function activate() { onActivate?.(); player.play(); }
  function toggleAudio() { const nextMuted=!muted;setMuted(nextMuted);player.muted=nextMuted;if(!nextMuted)activate(); }
  return <View style={styles.videoShell}><VideoView player={player} style={styles.media} nativeControls={false} contentFit={mediaFit === 'COVER' ? 'cover' : 'contain'} surfaceType="textureView" />{!active?<Pressable accessibilityRole="button" accessibilityLabel="Lire cette vidéo" style={styles.videoPoster} onPress={activate}><Text style={styles.playIcon}>▶</Text><Text style={styles.playText}>TOUCHER POUR LIRE</Text></Pressable>:null}<Pressable accessibilityRole="button" accessibilityLabel={muted?'Écouter le son de la vidéo':'Couper le son de la vidéo'} style={[styles.audioButton,!muted&&styles.audioButtonActive]} onPress={toggleAudio}><Text style={styles.audioIcon}>{muted?'🔇':'🔊'}</Text></Pressable></View>;
}

function LoadingMoment() {
  return <View style={styles.loading}><Text style={styles.loadingText}>KHE • réception…</Text></View>;
}

export function SharingMediaPreview(props: PreviewProps) {
  if (props.mimeType.startsWith('video/')) {
    if (!props.uri) return <LoadingMoment />;
    return <VideoMoment {...props} />;
  }
  return <ImageMoment uri={props.uri} mediaFit={props.mediaFit} onAspectRatio={props.onAspectRatio} />;
}

const styles = StyleSheet.create({
  media: { width: '100%', height: '100%' },
  videoShell: { flex: 1, backgroundColor: '#151519', overflow: 'hidden' },
  videoPoster: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(10,10,12,.18)' },
  playIcon: { color: '#d2ad4f', fontSize: 34 },
  playText: { color: '#ffffff', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  audioButton: { position: 'absolute', right: 9, top: 9, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(12,12,14,.82)', borderWidth: 1, borderColor: '#d2ad4f', alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  audioButtonActive: { backgroundColor: '#d2ad4f' },
  audioIcon: { fontSize: 18 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151519' },
  loadingText: { color: '#d2ad4f', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
