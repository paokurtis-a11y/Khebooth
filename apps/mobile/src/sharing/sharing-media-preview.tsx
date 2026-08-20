import { useEventListener } from 'expo';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { SharingMediaFit } from '../api/station-api';

interface PreviewProps {
  uri: string | null;
  mimeType: string;
  autoplay: boolean;
  mediaFit: SharingMediaFit;
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

function VideoMoment({ uri, autoplay, mediaFit, onAspectRatio }: PreviewProps) {
  const player = useVideoPlayer(uri ? { uri } : null, (instance) => {
    instance.loop = true;
    instance.muted = true;
    if (autoplay && uri) instance.play();
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    if (autoplay && uri) player.play();
    else player.pause();
  }, [autoplay, player, uri]);

  useEventListener(player, 'sourceLoad', ({ availableVideoTracks }) => {
    const track = availableVideoTracks[0];
    const width = track?.size?.width ?? 0;
    const height = track?.size?.height ?? 0;
    if (width > 0 && height > 0) onAspectRatio?.(width / height);
  });

  if (!uri) return <LoadingMoment />;
  return <VideoView player={player} style={styles.media} nativeControls={false} contentFit={mediaFit === 'COVER' ? 'cover' : 'contain'} surfaceType="textureView" />;
}

function LoadingMoment() {
  return <View style={styles.loading}><Text style={styles.loadingText}>KHE • réception…</Text></View>;
}

export function SharingMediaPreview(props: PreviewProps) {
  if (props.mimeType.startsWith('video/')) return <VideoMoment {...props} />;
  return <ImageMoment uri={props.uri} mediaFit={props.mediaFit} onAspectRatio={props.onAspectRatio} />;
}

const styles = StyleSheet.create({
  media: { width: '100%', height: '100%' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151519' },
  loadingText: { color: '#d2ad4f', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
