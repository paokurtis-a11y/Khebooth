import type {
  CaptureDurationSeconds,
  RemoteCaptureCommand,
  StationControlContract,
  VisualEffect,
} from '@khe/contracts';
import { CAPTURE_DURATIONS, VISUAL_EFFECTS } from '@khe/contracts';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationApi } from '../api/station-api';
import { SharingLivePreview } from '../live/live-preview';

interface RemoteControlPanelProps {
  eventName: string;
  api: StationApi;
  stationToken: string;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const effectLabels: Record<VisualEffect, string> = {
  NONE: 'Normal',
  WARM: 'Chaud',
  COOL: 'Froid',
  GOLD: 'Doré',
  PARTY: 'Party',
};

export function RemoteControlPanel({ eventName, api, stationToken }: RemoteControlPanelProps) {
  const [control, setControl] = useState<StationControlContract | null>(null);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [connectionRequested, setConnectionRequested] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState(0);
  const lastServerSeconds = useRef(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const comet = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      try {
        const next = await api.control(stationToken);
        if (!cancelled) {
          setControl(next);
          lastServerSeconds.current = next.elapsedSeconds;
          setDisplaySeconds(next.elapsedSeconds);
          setLastRefreshAt(Date.now());
          setMessage('');
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Commande distante indisponible.');
      }
    };

    void refresh();
    timer = setInterval(() => void refresh(), connectionRequested ? 450 : 900);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [api, connectionRequested, stationToken]);

  const captureOnline = control?.captureSeenAt
    ? Date.now() - new Date(control.captureSeenAt).getTime() < 5000
    : false;
  const connected = Boolean(connectionRequested && captureOnline);
  const connecting = Boolean(connectionRequested && !connected);

  useEffect(() => {
    if (!connecting) {
      comet.stopAnimation();
      comet.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(comet, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [comet, connecting]);

  useEffect(() => {
    if (control?.runtimeState !== 'RECORDING') {
      setDisplaySeconds(control?.elapsedSeconds ?? 0);
      return;
    }
    const timer = setInterval(() => {
      setDisplaySeconds((current) => Math.min(control.maxDurationSeconds, Math.max(current + 1, lastServerSeconds.current)));
    }, 1000);
    return () => clearInterval(timer);
  }, [control?.runtimeState, control?.elapsedSeconds, control?.maxDurationSeconds]);

  async function requestConnection(): Promise<void> {
    setConnectionRequested(true);
    setMessage('Connexion à la station CAPTURE en cours…');
    try {
      const next = await api.control(stationToken);
      setControl(next);
      setLastRefreshAt(Date.now());
      if (next.captureSeenAt && Date.now() - new Date(next.captureSeenAt).getTime() < 5000) {
        setMessage('Station CAPTURE connectée.');
      } else {
        setMessage('Recherche de la station CAPTURE… Vérifiez qu’elle est ouverte sur le même événement.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connexion à CAPTURE impossible pour le moment.');
    }
  }

  function disconnectLocally(): void {
    setConnectionRequested(false);
    setMessage('Régie SHARING déconnectée de CAPTURE. Les stations restent activées sur l’événement.');
  }

  async function command(commandName: Exclude<RemoteCaptureCommand, 'NONE'>): Promise<void> {
    if (!connected) {
      setMessage('Connectez d’abord SHARING à la station CAPTURE.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.updateControlCommand(stationToken, { command: commandName });
      setControl(next);
      setMessage(`Commande ${commandName} envoyée à la station CAPTURE.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’envoyer la commande.');
    } finally {
      setBusy(false);
    }
  }

  async function selectEffect(selectedEffect: VisualEffect): Promise<void> {
    if (!connected) {
      setMessage('Connectez d’abord SHARING à la station CAPTURE.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.updateControlCommand(stationToken, { selectedEffect });
      setControl(next);
      setMessage(`Effet ${effectLabels[selectedEffect]} sélectionné.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de modifier l’effet.');
    } finally {
      setBusy(false);
    }
  }

  async function selectDuration(maxDurationSeconds: CaptureDurationSeconds): Promise<void> {
    if (!connected) {
      setMessage('Connectez d’abord SHARING à la station CAPTURE.');
      return;
    }
    setBusy(true);
    try {
      const next = await api.updateControlCommand(stationToken, { maxDurationSeconds });
      setControl(next);
      setMessage(`Durée maximum réglée à ${maxDurationSeconds} secondes sur CAPTURE.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de modifier la durée.');
    } finally {
      setBusy(false);
    }
  }

  if (!control) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text>Initialisation de la régie SHARING…</Text>
      </View>
    );
  }

  const paused = control.runtimeState === 'PAUSED';
  const active = ['COUNTDOWN', 'RECORDING', 'PAUSED', 'SAVING'].includes(control.runtimeState);
  const timerLabel = control.runtimeState === 'PAUSED' ? 'PAUSE' : control.runtimeState === 'RECORDING' ? '● REC' : 'TEMPS';
  const lastRefreshLabel = lastRefreshAt ? `${Math.max(0, Math.round((Date.now() - lastRefreshAt) / 1000))} s` : '—';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>RÉGIE SHARING</Text>
          <Text style={styles.title}>{eventName}</Text>
        </View>
        <View style={styles.connectionBadge}>
          <View style={[styles.connectionDot, connected ? styles.dotConnected : styles.dotDisconnected]} />
          <Text style={styles.connectionText}>{connected ? 'Connecté' : 'Déconnecté'}</Text>
        </View>
      </View>

      {!connectionRequested ? (
        <Pressable style={styles.connectCard} onPress={() => void requestConnection()}>
          <Text style={styles.connectTitle}>Connectez-vous à la station CAPTURE</Text>
          <Text style={styles.connectHelp}>Touchez ici pour rechercher la station CAPTURE de ce même événement et activer la régie à distance.</Text>
          <View style={styles.connectButton}><Text style={styles.connectButtonText}>SE CONNECTER À CAPTURE</Text></View>
        </Pressable>
      ) : connecting ? (
        <View style={styles.connectingCard}>
          <Text style={styles.connectTitle}>Connexion à CAPTURE…</Text>
          <View style={styles.cometTrack}>
            <Animated.Text
              style={[
                styles.comet,
                { transform: [{ translateX: comet.interpolate({ inputRange: [0, 1], outputRange: [0, 230] }) }] },
              ]}
            >
              ✦
            </Animated.Text>
          </View>
          <Text style={styles.connectHelp}>KHE recherche la présence réelle de CAPTURE. L’état passera automatiquement au vert dès que son heartbeat est reçu.</Text>
          <Pressable style={styles.retryButton} onPress={() => void requestConnection()}><Text style={styles.retryText}>RÉESSAYER MAINTENANT</Text></Pressable>
        </View>
      ) : (
        <View style={styles.connectedCard}>
          <View style={styles.connectedRow}>
            <View>
              <Text style={styles.connectedTitle}>● CAPTURE CONNECTÉE</Text>
              <Text style={styles.connectedHelp}>Dernière synchronisation régie : {lastRefreshLabel}</Text>
            </View>
            <Pressable style={styles.disconnectButton} onPress={disconnectLocally}><Text style={styles.disconnectText}>Déconnecter</Text></Pressable>
          </View>
        </View>
      )}

      <View>
        <Text style={styles.sectionTitle}>APERÇU LIVE CAPTURE</Text>
        <View style={styles.liveGap}>
          {connectionRequested ? <SharingLivePreview api={api} stationToken={stationToken} /> : <View style={styles.previewPlaceholder}><Text style={styles.previewPlaceholderText}>Connectez SHARING à CAPTURE pour afficher l’aperçu live.</Text></View>}
        </View>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>ÉTAT CAPTURE · SYNCHRONISÉ</Text>
        <Text style={styles.statusValue}>{control.runtimeState}</Text>
        <View style={styles.timerRow}>
          {control.runtimeState === 'RECORDING' ? <View style={styles.recordingDot} /> : null}
          <Text style={styles.timerLabel}>{timerLabel}</Text>
          <Text style={styles.timer}>{formatDuration(displaySeconds)} / {formatDuration(control.maxDurationSeconds)}</Text>
        </View>
        <Text style={styles.timerHint}>Le minuteur suit CAPTURE, se fige en pause et respecte la durée maximum sélectionnée ci-dessous.</Text>
        <Text style={styles.ack}>Commande #{control.commandVersion} · acquittée #{control.acknowledgedVersion}</Text>
      </View>

      <Text style={styles.sectionTitle}>DURÉE MAXIMUM</Text>
      <View style={styles.durationRow}>
        {CAPTURE_DURATIONS.map((seconds) => (
          <Pressable
            key={seconds}
            disabled={busy || active || !connected}
            onPress={() => void selectDuration(seconds)}
            style={[styles.durationButton, control.maxDurationSeconds === seconds && styles.durationButtonActive, (busy || active || !connected) && styles.disabled]}
          >
            <Text style={control.maxDurationSeconds === seconds ? styles.durationTextActive : styles.durationText}>{seconds}s</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.commandRow}>
        <Pressable disabled={busy || active || !connected} onPress={() => void command('START')} style={[styles.commandButton, (busy || active || !connected) && styles.disabled]}>
          <Text style={styles.commandText}>● REC</Text>
        </Pressable>
        <Pressable disabled={busy || (!paused && control.runtimeState !== 'RECORDING') || !connected} onPress={() => void command(paused ? 'RESUME' : 'PAUSE')} style={[styles.commandButton, (busy || (!paused && control.runtimeState !== 'RECORDING') || !connected) && styles.disabled]}>
          <Text style={styles.commandText}>{paused ? '▶ REPRENDRE' : 'Ⅱ PAUSE'}</Text>
        </Pressable>
        <Pressable disabled={busy || !active || !connected} onPress={() => void command('STOP')} style={[styles.commandButton, (busy || !active || !connected) && styles.disabled]}>
          <Text style={styles.commandText}>■ STOP</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>EFFETS VISUELS</Text>
      <View style={styles.effectsRow}>
        {VISUAL_EFFECTS.map((effect) => (
          <Pressable key={effect} disabled={busy || !connected} onPress={() => void selectEffect(effect)} style={[styles.effectButton, control.selectedEffect === effect && styles.effectActive, !connected && styles.disabled]}>
            <Text style={control.selectedEffect === effect ? styles.effectTextActive : styles.effectText}>{effectLabels[effect]}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.effectNote}>L’effet choisi est transmis à CAPTURE et enregistré dans l’état de régie. Son rendu final sera appliqué par le pipeline vidéo pour ne pas altérer le fichier source hors ligne.</Text>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  loading: { padding: 24, gap: 12, alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  title: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  connectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#d5d5d5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  connectionDot: { width: 10, height: 10, borderRadius: 5 },
  dotConnected: { backgroundColor: '#20a447' },
  dotDisconnected: { backgroundColor: '#d93434' },
  connectionText: { fontSize: 10, fontWeight: '900' },
  connectCard: { borderWidth: 1, borderColor: '#111111', borderRadius: 18, padding: 16, gap: 9 },
  connectingCard: { borderWidth: 1, borderColor: '#c9c9c9', borderRadius: 18, padding: 16, gap: 10, overflow: 'hidden' },
  connectedCard: { borderWidth: 1, borderColor: '#20a447', borderRadius: 18, padding: 14 },
  connectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  connectTitle: { fontSize: 17, fontWeight: '900' },
  connectHelp: { fontSize: 11, lineHeight: 17, opacity: 0.65 },
  connectButton: { backgroundColor: '#111111', borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  connectButtonText: { color: '#ffffff', fontWeight: '900', fontSize: 11, letterSpacing: 0.6 },
  cometTrack: { height: 34, borderRadius: 17, backgroundColor: '#111111', justifyContent: 'center', paddingHorizontal: 8, overflow: 'hidden' },
  comet: { color: '#ffffff', fontSize: 22, width: 28 },
  retryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#111111', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  retryText: { fontWeight: '900', fontSize: 10 },
  connectedTitle: { color: '#16863a', fontWeight: '900', fontSize: 12, letterSpacing: 0.7 },
  connectedHelp: { fontSize: 10, opacity: 0.6, marginTop: 3 },
  disconnectButton: { borderWidth: 1, borderColor: '#c9c9c9', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  disconnectText: { fontSize: 10, fontWeight: '800' },
  liveGap: { marginTop: 8 },
  previewPlaceholder: { minHeight: 130, borderWidth: 1, borderColor: '#d5d5d5', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 18 },
  previewPlaceholderText: { textAlign: 'center', fontSize: 11, lineHeight: 17, opacity: 0.55 },
  statusCard: { borderWidth: 1, borderColor: '#d5d5d5', borderRadius: 16, padding: 16 },
  statusLabel: { fontSize: 10, fontWeight: '800', opacity: 0.5 },
  statusValue: { fontSize: 20, fontWeight: '900', marginTop: 4 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d62424' },
  timerLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  timer: { fontSize: 32, fontWeight: '900' },
  timerHint: { fontSize: 10, opacity: 0.55, marginTop: 2 },
  ack: { fontSize: 10, opacity: 0.5, marginTop: 4 },
  sectionTitle: { marginTop: 4, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  durationRow: { flexDirection: 'row', gap: 6 },
  durationButton: { flex: 1, borderWidth: 1, borderColor: '#bdbdbd', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  durationButtonActive: { backgroundColor: '#111111', borderColor: '#111111' },
  durationText: { fontWeight: '800', fontSize: 11 },
  durationTextActive: { color: '#ffffff', fontWeight: '900', fontSize: 11 },
  commandRow: { flexDirection: 'row', gap: 8 },
  commandButton: { flex: 1, backgroundColor: '#111111', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  commandText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.25 },
  effectsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effectButton: { borderWidth: 1, borderColor: '#bdbdbd', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  effectActive: { backgroundColor: '#111111', borderColor: '#111111' },
  effectText: { fontWeight: '800', fontSize: 11 },
  effectTextActive: { color: '#ffffff', fontWeight: '800', fontSize: 11 },
  effectNote: { fontSize: 11, lineHeight: 16, opacity: 0.6 },
  message: { fontSize: 12, lineHeight: 17 },
});