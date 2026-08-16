import type {
  AspectRatio,
  CaptureDurationSeconds,
  RemoteCaptureState,
  VisualEffect,
} from '@khe/contracts';
import { CAPTURE_DURATIONS } from '@khe/contracts';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { StationApi } from '../api/station-api';
import { CaptureLivePublisher, type LivePreviewState } from '../live/live-preview';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';

interface CameraCaptureProps {
  eventId: string;
  store: LocalStore;
  api: StationApi;
  stationToken: string;
  onClose: () => void;
  onCaptured: (media: LocalMediaRecord, format: AspectRatio) => void;
}

function makeLocalId(): string {
  return `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const effectOverlay: Record<VisualEffect, string> = {
  NONE: 'transparent',
  WARM: 'rgba(255,118,35,0.13)',
  COOL: 'rgba(60,120,255,0.13)',
  GOLD: 'rgba(218,170,60,0.17)',
  PARTY: 'rgba(225,40,180,0.12)',
};

const liveLabels: Record<LivePreviewState, string> = {
  OFF: 'LIVE OFF',
  LOADING: 'LIVE…',
  CONNECTING: 'LIVE…',
  LIVE: 'LIVE ●',
  UNAVAILABLE: 'LIVE !',
  ERROR: 'LIVE !',
};

export function CameraCapture({ eventId, store, api, stationToken, onClose, onCaptured }: CameraCaptureProps) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const cameraRef = useRef<CameraView | null>(null);
  const handledCommandVersion = useRef(0);
  const runtimeStateRef = useRef<RemoteCaptureState>('IDLE');
  const elapsedRef = useRef(0);
  const durationRef = useRef<CaptureDurationSeconds>(15);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const [controlsVisible, setControlsVisible] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [format, setFormat] = useState<AspectRatio>('9:16');
  const [captureDuration, setCaptureDuration] = useState<CaptureDurationSeconds>(15);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [selectedEffect, setSelectedEffect] = useState<VisualEffect>('NONE');
  const [message, setMessage] = useState('');
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveState, setLiveState] = useState<LivePreviewState>('OFF');

  function setRuntimeState(next: RemoteCaptureState): void {
    runtimeStateRef.current = next;
  }

  function applyDuration(seconds: CaptureDurationSeconds): void {
    durationRef.current = seconds;
    setCaptureDuration(seconds);
  }

  function clearHideTimer(): void {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function hideControls(): void {
    Animated.timing(controlsOpacity, { toValue: 0, duration: 700, useNativeDriver: true }).start(() => setControlsVisible(false));
  }

  function revealControls(autoHide = recording): void {
    clearHideTimer();
    setControlsVisible(true);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    if (autoHide && !paused) {
      hideTimerRef.current = setTimeout(hideControls, 5000);
    }
  }

  useEffect(() => () => clearHideTimer(), []);

  useEffect(() => {
    if (starting) revealControls(false);
  }, [starting]);

  useEffect(() => {
    if (recording && !paused) revealControls(true);
    if (!recording || paused) revealControls(false);
  }, [paused, recording]);

  const handleLiveState = useCallback((next: LivePreviewState, detail?: string) => {
    setLiveState(next);
    if ((next === 'ERROR' || next === 'UNAVAILABLE') && detail) {
      setMessage(`Aperçu live indisponible : ${detail}. La capture locale reste active.`);
    }
  }, []);

  useEffect(() => { elapsedRef.current = elapsedSeconds; }, [elapsedSeconds]);

  useEffect(() => {
    if (!recording || paused) return;
    const timer = setInterval(() => setElapsedSeconds((current) => Math.min(durationRef.current, current + 1)), 1000);
    return () => clearInterval(timer);
  }, [paused, recording]);

  useEffect(() => {
    if (!cameraPermission?.granted || !microphonePermission?.granted) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const control = await api.control(stationToken);
        if (cancelled) return;
        setSelectedEffect(control.selectedEffect);
        if (!recording && !starting && control.maxDurationSeconds !== durationRef.current) applyDuration(control.maxDurationSeconds);
        if (control.commandVersion <= handledCommandVersion.current) return;
        handledCommandVersion.current = control.commandVersion;
        if (control.command === 'START') {
          if (ready && !recording && !starting) {
            applyDuration(control.maxDurationSeconds);
            void startRecording(control.maxDurationSeconds);
            await api.updateControlStatus(stationToken, { acknowledgedVersion: control.commandVersion, runtimeState: 'COUNTDOWN', elapsedSeconds: 0, maxDurationSeconds: control.maxDurationSeconds });
          }
        } else if (control.command === 'STOP') {
          if (recording) {
            stopRecording();
            await api.updateControlStatus(stationToken, { acknowledgedVersion: control.commandVersion, runtimeState: 'SAVING', elapsedSeconds: elapsedRef.current, maxDurationSeconds: durationRef.current });
          }
        } else if (control.command === 'PAUSE') {
          if (recording && !paused && cameraRef.current && typeof cameraRef.current.toggleRecordingAsync === 'function') {
            await cameraRef.current.toggleRecordingAsync();
            setPaused(true);
            setRuntimeState('PAUSED');
            await api.updateControlStatus(stationToken, { acknowledgedVersion: control.commandVersion, runtimeState: 'PAUSED', elapsedSeconds: elapsedRef.current, maxDurationSeconds: durationRef.current });
          } else {
            setMessage('La pause vidéo n’est pas disponible sur cette configuration caméra Android.');
            await api.updateControlStatus(stationToken, { acknowledgedVersion: control.commandVersion, runtimeState: recording ? 'RECORDING' : 'IDLE', elapsedSeconds: elapsedRef.current, maxDurationSeconds: durationRef.current });
          }
        } else if (control.command === 'RESUME') {
          if (recording && paused && cameraRef.current && typeof cameraRef.current.toggleRecordingAsync === 'function') {
            await cameraRef.current.toggleRecordingAsync();
            setPaused(false);
            setRuntimeState('RECORDING');
            await api.updateControlStatus(stationToken, { acknowledgedVersion: control.commandVersion, runtimeState: 'RECORDING', elapsedSeconds: elapsedRef.current, maxDurationSeconds: durationRef.current });
          }
        }
      } catch {
        // La capture locale ne dépend jamais du réseau.
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 800);
    return () => { cancelled = true; clearInterval(timer); };
  }, [api, cameraPermission?.granted, microphonePermission?.granted, paused, ready, recording, starting, stationToken]);

  useEffect(() => {
    if (!cameraPermission?.granted || !microphonePermission?.granted) return;
    const heartbeat = setInterval(() => {
      void api.updateControlStatus(stationToken, { runtimeState: runtimeStateRef.current, elapsedSeconds: elapsedRef.current, maxDurationSeconds: durationRef.current }).catch(() => undefined);
    }, 2000);
    return () => clearInterval(heartbeat);
  }, [api, cameraPermission?.granted, microphonePermission?.granted, stationToken]);

  async function requestPermissions(): Promise<void> {
    setMessage('');
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    const microphone = microphonePermission?.granted ? microphonePermission : await requestMicrophonePermission();
    if (!camera.granted || !microphone.granted) setMessage('La caméra et le microphone sont nécessaires pour enregistrer une vidéo avec son.');
  }

  async function persistRecording(uri: string): Promise<LocalMediaRecord> {
    const localId = makeLocalId();
    const capturedAt = new Date().toISOString();
    const directory = new Directory(Paths.document, 'captures', eventId);
    await directory.create({ idempotent: true, intermediates: true });
    const source = new File(uri);
    const destination = new File(directory, `${localId}.mp4`);
    await source.copy(destination);
    if (!destination.exists || destination.size <= 0) throw new Error('La vidéo n’a pas pu être conservée dans le stockage permanent.');
    if (!destination.md5) throw new Error('La vidéo est conservée localement mais son empreinte n’a pas pu être calculée.');
    const media: LocalMediaRecord = {
      localId, eventId, idempotencyKey: `${eventId}:${localId}`, contentHash: destination.md5,
      byteSize: destination.size, mimeType: 'video/mp4', localUri: destination.uri, capturedAt,
      syncState: 'QUEUED', remoteId: null, uploadedBytes: 0, acknowledgedAt: null, retryCount: 0,
      lastError: null, updatedAt: capturedAt,
    };
    await store.upsertMedia(media);
    await store.enqueue({ localId, nextAttemptAt: capturedAt, retryCount: 0, lastError: null });
    return media;
  }

  async function startRecording(durationOverride?: CaptureDurationSeconds): Promise<void> {
    if (!cameraRef.current || !ready || recording || starting) return;
    const duration = durationOverride ?? durationRef.current;
    applyDuration(duration);
    setMessage('');
    setStarting(true);
    setRuntimeState('COUNTDOWN');
    revealControls(false);
    try {
      for (let value = 5; value >= 1; value -= 1) { setCountdown(value); await sleep(1000); }
      setCountdown(null);
      setElapsedSeconds(0);
      setRecording(true);
      setPaused(false);
      setRuntimeState('RECORDING');
      revealControls(true);
      void api.updateControlStatus(stationToken, { runtimeState: 'RECORDING', elapsedSeconds: 0, maxDurationSeconds: duration }).catch(() => undefined);
      const result = await cameraRef.current.recordAsync({ maxDuration: duration });
      setRuntimeState('SAVING');
      if (!result?.uri) { setRuntimeState('ERROR'); setMessage('Enregistrement interrompu avant la création du fichier vidéo.'); return; }
      const media = await persistRecording(result.uri);
      onCaptured(media, format);
      setMessage(`Vidéo ${duration} s max conservée hors ligne (${format}). Elle ne sera pas supprimée avant synchronisation confirmée.`);
      setRuntimeState('IDLE');
      void api.updateControlStatus(stationToken, { runtimeState: 'IDLE', elapsedSeconds: 0, maxDurationSeconds: duration }).catch(() => undefined);
    } catch (error) {
      setRuntimeState('ERROR');
      setMessage(error instanceof Error ? error.message : 'Échec de l’enregistrement vidéo.');
      void api.updateControlStatus(stationToken, { runtimeState: 'ERROR', elapsedSeconds: elapsedRef.current, maxDurationSeconds: durationRef.current }).catch(() => undefined);
    } finally {
      setCountdown(null); setStarting(false); setRecording(false); setPaused(false); revealControls(false);
    }
  }

  function stopRecording(): void { cameraRef.current?.stopRecording(); }

  async function toggleLocalPause(): Promise<void> {
    if (!cameraRef.current || !recording || typeof cameraRef.current.toggleRecordingAsync !== 'function') return;
    try {
      await cameraRef.current.toggleRecordingAsync();
      const nextPaused = !paused;
      setPaused(nextPaused);
      setRuntimeState(nextPaused ? 'PAUSED' : 'RECORDING');
      void api.updateControlStatus(stationToken, { runtimeState: nextPaused ? 'PAUSED' : 'RECORDING', elapsedSeconds: elapsedRef.current, maxDurationSeconds: durationRef.current }).catch(() => undefined);
    } catch { setMessage('La pause/reprise n’est pas supportée par cette tablette.'); }
  }

  function selectLocalDuration(seconds: CaptureDurationSeconds): void {
    applyDuration(seconds);
    void api.updateControlStatus(stationToken, { runtimeState: runtimeStateRef.current, elapsedSeconds: elapsedRef.current, maxDurationSeconds: seconds }).catch(() => undefined);
  }

  function toggleLive(): void {
    if (recording || starting) return;
    setMessage('');
    setLiveEnabled((current) => !current);
  }

  const controlsLocked = recording || starting;

  if (!cameraPermission?.granted || !microphonePermission?.granted) {
    return (
      <View style={styles.permissionPage}>
        <Text style={styles.brand}>KHE BOOTH</Text><Text style={styles.title}>Autorisation caméra</Text>
        <Text style={styles.help}>KHE Booth a besoin de la caméra et du microphone pour produire les vidéos événementielles avec son.</Text>
        <Pressable style={styles.primaryButton} onPress={() => void requestPermissions()}><Text style={styles.primaryText}>Autoriser caméra + micro</Text></Pressable>
        <Pressable style={styles.secondaryButton} onPress={onClose}><Text style={styles.secondaryText}>Retour</Text></Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <Pressable style={styles.page} onPress={() => revealControls(recording)}>
      <CameraView
        ref={cameraRef} style={styles.camera} facing={facing} mode="video" ratio={format === '1:1' ? '1:1' : '16:9'} videoQuality="1080p"
        onCameraReady={() => {
          setReady(true); setRuntimeState('IDLE');
          void api.updateControlStatus(stationToken, { runtimeState: 'IDLE', elapsedSeconds: 0, maxDurationSeconds: durationRef.current }).catch(() => undefined);
        }}
        onMountError={(event) => { setRuntimeState('ERROR'); setMessage(event.message); }}
      />
      <CaptureLivePublisher api={api} stationToken={stationToken} enabled={liveEnabled} onStateChange={handleLiveState} />
      <View pointerEvents="none" style={[styles.effectOverlay, { backgroundColor: effectOverlay[selectedEffect] }]} />

      {selectedEffect !== 'NONE' ? <View pointerEvents="none" style={styles.effectBadge}><Text style={styles.effectBadgeText}>EFFET {selectedEffect}</Text></View> : null}
      {liveEnabled ? <View pointerEvents="none" style={styles.liveBadge}><Text style={styles.liveBadgeText}>SHARING · {liveLabels[liveState]}</Text></View> : null}

      {countdown !== null ? (
        <View pointerEvents="none" style={styles.countdownOverlay}>
          <View style={styles.countdownCircle}><Text style={styles.countdownText}>{countdown}</Text></View>
          <Text style={styles.countdownLabel}>Préparez-vous</Text>
        </View>
      ) : null}

      {recording ? (
        <View pointerEvents="none" style={styles.recordingTimer}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingTimerText}>{paused ? 'PAUSE' : 'REC'} {formatDuration(elapsedSeconds)} / {formatDuration(captureDuration)}</Text>
        </View>
      ) : null}

      {controlsVisible ? (
        <Animated.View style={[styles.uiLayer, { opacity: controlsOpacity }]} pointerEvents="box-none">
          <View style={[styles.topControls, landscape && styles.topControlsLandscape]}>
            <Pressable disabled={controlsLocked} style={styles.control} onPress={onClose}><Text numberOfLines={1} style={styles.controlText}>Fermer</Text></Pressable>
            <Pressable disabled={controlsLocked} style={styles.control} onPress={() => setFacing((current) => current === 'back' ? 'front' : 'back')}><Text numberOfLines={1} style={styles.controlText}>Retourner</Text></Pressable>
            <Pressable disabled={controlsLocked} style={[styles.control, liveState === 'LIVE' && styles.liveControl]} onPress={toggleLive}><Text numberOfLines={1} style={styles.controlText}>{liveEnabled ? liveLabels[liveState] : 'Activer live'}</Text></Pressable>
          </View>

          <View style={[styles.bottomDock, landscape && styles.bottomDockLandscape]}>
            <ScrollView style={[styles.bottomScroll, landscape && { maxHeight: Math.max(180, height - 104) }]} contentContainerStyle={styles.bottomPanel} showsVerticalScrollIndicator nestedScrollEnabled>
              <View style={styles.formatRow}>
                {(['9:16', '1:1'] as const).map((candidate) => (
                  <Pressable key={candidate} disabled={controlsLocked} onPress={() => setFormat(candidate)} style={[styles.formatButton, format === candidate && styles.formatButtonActive]}>
                    <Text style={format === candidate ? styles.formatTextActive : styles.formatText}>{candidate}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.durationLabel}>DURÉE MAXIMUM · SYNCHRONISÉE AVEC SHARING</Text>
              <View style={styles.durationRow}>
                {CAPTURE_DURATIONS.map((seconds) => (
                  <Pressable key={seconds} disabled={controlsLocked} onPress={() => selectLocalDuration(seconds)} style={[styles.durationButton, captureDuration === seconds && styles.durationButtonActive]}>
                    <Text style={captureDuration === seconds ? styles.durationTextActive : styles.durationText}>{seconds}s</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.status}>
                {recording ? `${paused ? 'Pause' : 'Enregistrement'} • ${formatDuration(elapsedSeconds)} / ${formatDuration(captureDuration)}` : starting ? `Départ dans ${countdown ?? 1} s…` : ready ? `Prêt • ${format} • ${captureDuration} s max` : 'Initialisation caméra…'}
              </Text>
              {recording ? (
                <View style={styles.recordingControls}>
                  <Pressable style={styles.pauseButton} onPress={() => void toggleLocalPause()}><Text style={styles.recordText}>{paused ? 'REPRENDRE' : 'PAUSE'}</Text></Pressable>
                  <Pressable style={[styles.recordButton, styles.stopButton]} onPress={stopRecording}><Text style={styles.recordText}>ARRÊTER • {formatDuration(elapsedSeconds)}</Text></Pressable>
                </View>
              ) : (
                <Pressable disabled={!ready || starting} style={[styles.recordButton, starting && styles.disabledButton]} onPress={() => void startRecording()}><Text style={styles.recordText}>{starting ? 'PRÉPAREZ-VOUS…' : `ENREGISTRER • ${captureDuration}s`}</Text></Pressable>
              )}
              <Text style={styles.policy}>Les commandes restent visibles pendant le décompte et les 5 premières secondes de la prise, puis disparaissent doucement. Touchez l’écran à tout moment pour les faire réapparaître. Le minuteur REC reste toujours visible.</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' }, camera: { flex: 1 }, uiLayer: { ...StyleSheet.absoluteFill },
  effectOverlay: { ...StyleSheet.absoluteFill },
  effectBadge: { position: 'absolute', top: 78, left: 14, backgroundColor: 'rgba(0,0,0,0.68)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  effectBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  liveBadge: { position: 'absolute', top: 116, left: 14, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  liveBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  permissionPage: { flex: 1, backgroundColor: '#101010', padding: 28, justifyContent: 'center', gap: 16 },
  brand: { color: '#ffffff', fontSize: 14, letterSpacing: 3, fontWeight: '800' }, title: { color: '#ffffff', fontSize: 30, fontWeight: '800' },
  help: { color: '#d3d3d3', fontSize: 16, lineHeight: 23 }, primaryButton: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryText: { color: '#111111', fontWeight: '800' }, secondaryButton: { borderWidth: 1, borderColor: '#777777', borderRadius: 14, padding: 14, alignItems: 'center' }, secondaryText: { color: '#ffffff', fontWeight: '700' },
  topControls: { position: 'absolute', left: 14, right: 14, top: 22, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  topControlsLandscape: { right: '42%' },
  control: { minWidth: 0, flexShrink: 1, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9 },
  liveControl: { borderWidth: 1, borderColor: '#ffffff' }, controlText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  countdownOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.18)' },
  countdownCircle: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: 4, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  countdownText: { color: '#ffffff', fontSize: 76, lineHeight: 88, fontWeight: '900' }, countdownLabel: { marginTop: 14, color: '#ffffff', fontSize: 18, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 },
  recordingTimer: { position: 'absolute', top: 76, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 18, paddingHorizontal: 13, paddingVertical: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff3b30' }, recordingTimerText: { color: '#ffffff', fontWeight: '900', fontSize: 15, letterSpacing: 0.4 },
  bottomDock: { position: 'absolute', left: 12, right: 12, bottom: 12 }, bottomDockLandscape: { left: '57%', right: 10, top: 62, bottom: 10, justifyContent: 'flex-end' },
  bottomScroll: { flexGrow: 0, backgroundColor: 'rgba(0,0,0,0.82)', borderRadius: 20 }, bottomPanel: { padding: 14, gap: 9, paddingBottom: 18 },
  formatRow: { flexDirection: 'row', gap: 8 }, formatButton: { flex: 1, borderWidth: 1, borderColor: '#777777', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  formatButtonActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' }, formatText: { color: '#ffffff', fontWeight: '800' }, formatTextActive: { color: '#111111', fontWeight: '800' },
  durationLabel: { color: '#dedede', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.8 }, durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  durationButton: { flexGrow: 1, minWidth: 48, borderWidth: 1, borderColor: '#777777', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 5, alignItems: 'center' }, durationButtonActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  durationText: { color: '#ffffff', fontSize: 11, fontWeight: '800' }, durationTextActive: { color: '#111111', fontSize: 11, fontWeight: '900' }, status: { color: '#ffffff', textAlign: 'center', fontWeight: '800', lineHeight: 20 },
  recordingControls: { flexDirection: 'row', gap: 8 }, pauseButton: { flex: 1, backgroundColor: '#f2f2f2', borderRadius: 15, padding: 15, alignItems: 'center' }, recordButton: { flex: 1, backgroundColor: '#ffffff', borderRadius: 15, padding: 16, alignItems: 'center' },
  stopButton: { backgroundColor: '#d9d9d9' }, disabledButton: { opacity: 0.7 }, recordText: { color: '#111111', fontWeight: '900', letterSpacing: 0.6, textAlign: 'center' },
  policy: { color: '#d2d2d2', fontSize: 11, lineHeight: 16 }, message: { color: '#ffffff', fontSize: 12, lineHeight: 17 },
});
