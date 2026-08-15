import type { StationLiveSessionContract } from '@khe/contracts';
import {
  isTrackReference,
  LiveKitRoom,
  registerGlobals,
  useConnectionState,
  useTracks,
  VideoTrack,
} from '@livekit/react-native';
import { ConnectionState, Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationApi } from '../api/station-api';

registerGlobals({ autoConfigureAudioSession: false });

export type LivePreviewState = 'OFF' | 'LOADING' | 'CONNECTING' | 'LIVE' | 'UNAVAILABLE' | 'ERROR';

interface LiveSessionState {
  session: StationLiveSessionContract | null;
  error: string | null;
  loading: boolean;
}

function useStationLiveSession(
  api: StationApi,
  stationToken: string,
  enabled: boolean,
  retryNonce = 0,
): LiveSessionState {
  const [session, setSession] = useState<StationLiveSessionContract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    if (!enabled) {
      setSession(null);
      setError(null);
      setLoading(false);
      return () => undefined;
    }

    const load = async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const next = await api.liveSession(stationToken);
        if (cancelled) return;
        setSession(next);
        setError(null);
        setLoading(false);
      } catch (loadError) {
        if (cancelled) return;
        setSession(null);
        setError(loadError instanceof Error ? loadError.message : 'Aperçu live indisponible.');
        setLoading(false);
        retryTimer = setTimeout(() => void load(), 5000);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [api, enabled, retryNonce, stationToken]);

  return { session, error, loading };
}

interface CaptureLivePublisherProps {
  api: StationApi;
  stationToken: string;
  enabled: boolean;
  onStateChange?: (state: LivePreviewState, detail?: string) => void;
}

export function CaptureLivePublisher({
  api,
  stationToken,
  enabled,
  onStateChange,
}: CaptureLivePublisherProps) {
  const { session, error, loading } = useStationLiveSession(api, stationToken, enabled);

  useEffect(() => {
    if (!enabled) onStateChange?.('OFF');
    else if (loading) onStateChange?.('LOADING');
    else if (error) onStateChange?.('UNAVAILABLE', error);
    else if (session) onStateChange?.('CONNECTING');
  }, [enabled, error, loading, onStateChange, session]);

  if (!enabled || !session) return null;

  return (
    <LiveKitRoom
      serverUrl={session.serverUrl}
      token={session.participantToken}
      connect
      audio={false}
      video={false}
      screen
      connectOptions={{ autoSubscribe: false }}
      options={{ adaptiveStream: true, dynacast: true }}
      onConnected={() => onStateChange?.('LIVE')}
      onDisconnected={() => onStateChange?.('CONNECTING')}
      onError={(liveError) => onStateChange?.('ERROR', liveError.message)}
      onMediaDeviceFailure={(failure) =>
        onStateChange?.('ERROR', failure ? String(failure) : 'Partage écran indisponible')
      }
    >
      <View />
    </LiveKitRoom>
  );
}

function RemoteScreenTrack() {
  const connectionState = useConnectionState();
  const tracks = useTracks([Track.Source.ScreenShare]);
  const screenTrack = tracks.find((track) => isTrackReference(track));

  if (screenTrack && isTrackReference(screenTrack)) {
    return <VideoTrack trackRef={screenTrack} style={styles.video} />;
  }

  const reconnecting = connectionState === ConnectionState.Reconnecting;
  const connecting = connectionState === ConnectionState.Connecting || reconnecting;

  return (
    <View style={styles.placeholder}>
      {connecting ? <ActivityIndicator /> : null}
      <Text style={styles.placeholderTitle}>
        {connectionState === ConnectionState.Connected ? 'CAPTURE CONNECTÉE' : 'CONNEXION LIVE'}
      </Text>
      <Text style={styles.placeholderText}>
        {connectionState === ConnectionState.Connected
          ? 'En attente de l’autorisation de partage d’écran sur la tablette CAPTURE.'
          : 'Connexion sécurisée à l’aperçu temps réel…'}
      </Text>
    </View>
  );
}

interface SharingLivePreviewProps {
  api: StationApi;
  stationToken: string;
}

export function SharingLivePreview({ api, stationToken }: SharingLivePreviewProps) {
  const [retryNonce, setRetryNonce] = useState(0);
  const { session, error, loading } = useStationLiveSession(api, stationToken, true, retryNonce);

  if (loading && !session) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator />
        <Text style={styles.placeholderTitle}>APERÇU LIVE</Text>
        <Text style={styles.placeholderText}>Préparation du canal vidéo sécurisé…</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>APERÇU LIVE INDISPONIBLE</Text>
        <Text style={styles.placeholderText}>{error ?? 'Le service live n’est pas configuré.'}</Text>
        <Pressable style={styles.retryButton} onPress={() => setRetryNonce((current) => current + 1)}>
          <Text style={styles.retryText}>RÉESSAYER</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.previewFrame}>
      <LiveKitRoom
        serverUrl={session.serverUrl}
        token={session.participantToken}
        connect
        audio={false}
        video={false}
        screen={false}
        connectOptions={{ autoSubscribe: true }}
        options={{ adaptiveStream: { pixelDensity: 'screen' } }}
      >
        <RemoteScreenTrack />
      </LiveKitRoom>
    </View>
  );
}

const styles = StyleSheet.create({
  previewFrame: {
    minHeight: 190,
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#050505',
  },
  video: { flex: 1 },
  placeholder: {
    minHeight: 190,
    borderRadius: 18,
    backgroundColor: '#121212',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderTitle: { color: '#ffffff', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  placeholderText: { color: '#c8c8c8', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  retryButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
});
