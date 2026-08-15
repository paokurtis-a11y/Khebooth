import type {
  RemoteCaptureCommand,
  StationControlContract,
  VisualEffect,
} from '@khe/contracts';
import { VISUAL_EFFECTS } from '@khe/contracts';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationApi } from '../api/station-api';

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
  const lastServerSeconds = useRef(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

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
          setMessage('');
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Commande distante indisponible.');
      }
    };

    void refresh();
    timer = setInterval(() => void refresh(), 700);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [api, stationToken]);

  useEffect(() => {
    if (control?.runtimeState !== 'RECORDING') {
      setDisplaySeconds(control?.elapsedSeconds ?? 0);
      return;
    }
    const timer = setInterval(() => {
      setDisplaySeconds((current) => Math.max(current + 1, lastServerSeconds.current));
    }, 1000);
    return () => clearInterval(timer);
  }, [control?.runtimeState, control?.elapsedSeconds]);

  async function command(commandName: Exclude<RemoteCaptureCommand, 'NONE'>): Promise<void> {
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

  if (!control) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
        <Text>Connexion à la station CAPTURE…</Text>
      </View>
    );
  }

  const captureOnline = control.captureSeenAt
    ? Date.now() - new Date(control.captureSeenAt).getTime() < 5000
    : false;
  const paused = control.runtimeState === 'PAUSED';
  const active = ['COUNTDOWN', 'RECORDING', 'PAUSED', 'SAVING'].includes(control.runtimeState);
  const timerLabel = control.runtimeState === 'PAUSED' ? 'PAUSE' : control.runtimeState === 'RECORDING' ? '● REC' : 'TEMPS';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>RÉGIE SHARING</Text>
          <Text style={styles.title}>{eventName}</Text>
        </View>
        <View style={[styles.onlineBadge, !captureOnline && styles.offlineBadge]}>
          <Text style={styles.onlineText}>{captureOnline ? 'CAPTURE EN LIGNE' : 'CAPTURE HORS LIGNE'}</Text>
        </View>
      </View>

      <View style={styles.previewPlaceholder}>
        <Text style={styles.previewTitle}>APERÇU LIVE</Text>
        <Text style={styles.previewText}>
          Le canal de contrôle est actif. Le flux vidéo temps réel sera raccordé au transport live dédié afin de ne pas dégrader l’enregistrement local.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>ÉTAT CAPTURE · SYNCHRONISÉ</Text>
        <Text style={styles.statusValue}>{control.runtimeState}</Text>
        <View style={styles.timerRow}>
          {control.runtimeState === 'RECORDING' ? <View style={styles.recordingDot} /> : null}
          <Text style={styles.timerLabel}>{timerLabel}</Text>
          <Text style={styles.timer}>{formatDuration(displaySeconds)}</Text>
        </View>
        <Text style={styles.timerHint}>
          Le minuteur suit l’écoulement de la station CAPTURE et se fige automatiquement pendant une pause.
        </Text>
        <Text style={styles.ack}>Commande #{control.commandVersion} · acquittée #{control.acknowledgedVersion}</Text>
      </View>

      <View style={styles.commandRow}>
        <Pressable
          disabled={busy || active || !captureOnline}
          onPress={() => void command('START')}
          style={[styles.commandButton, (busy || active || !captureOnline) && styles.disabled]}
        >
          <Text style={styles.commandText}>● REC</Text>
        </Pressable>
        <Pressable
          disabled={busy || (!paused && control.runtimeState !== 'RECORDING') || !captureOnline}
          onPress={() => void command(paused ? 'RESUME' : 'PAUSE')}
          style={[styles.commandButton, (busy || (!paused && control.runtimeState !== 'RECORDING') || !captureOnline) && styles.disabled]}
        >
          <Text style={styles.commandText}>{paused ? '▶ REPRENDRE' : 'Ⅱ PAUSE'}</Text>
        </Pressable>
        <Pressable
          disabled={busy || !active || !captureOnline}
          onPress={() => void command('STOP')}
          style={[styles.commandButton, (busy || !active || !captureOnline) && styles.disabled]}
        >
          <Text style={styles.commandText}>■ STOP</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>EFFETS VISUELS</Text>
      <View style={styles.effectsRow}>
        {VISUAL_EFFECTS.map((effect) => (
          <Pressable
            key={effect}
            disabled={busy}
            onPress={() => void selectEffect(effect)}
            style={[styles.effectButton, control.selectedEffect === effect && styles.effectActive]}
          >
            <Text style={control.selectedEffect === effect ? styles.effectTextActive : styles.effectText}>
              {effectLabels[effect]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.effectNote}>
        L’effet choisi est transmis à CAPTURE et enregistré dans l’état de régie. Son rendu final sera appliqué par le pipeline vidéo pour ne pas altérer le fichier source hors ligne.
      </Text>

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  loading: { padding: 24, gap: 12, alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  title: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  onlineBadge: { backgroundColor: '#111111', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  offlineBadge: { opacity: 0.35 },
  onlineText: { color: '#ffffff', fontSize: 9, fontWeight: '900' },
  previewPlaceholder: { minHeight: 150, borderRadius: 18, backgroundColor: '#121212', padding: 18, justifyContent: 'center' },
  previewTitle: { color: '#ffffff', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  previewText: { marginTop: 8, color: '#c8c8c8', fontSize: 12, lineHeight: 18 },
  statusCard: { borderWidth: 1, borderColor: '#d5d5d5', borderRadius: 16, padding: 16 },
  statusLabel: { fontSize: 10, fontWeight: '800', opacity: 0.5 },
  statusValue: { fontSize: 20, fontWeight: '900', marginTop: 4 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d62424' },
  timerLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  timer: { fontSize: 36, fontWeight: '900' },
  timerHint: { fontSize: 10, opacity: 0.55, marginTop: 2 },
  ack: { fontSize: 10, opacity: 0.5, marginTop: 4 },
  commandRow: { flexDirection: 'row', gap: 8 },
  commandButton: { flex: 1, backgroundColor: '#111111', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  commandText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.25 },
  sectionTitle: { marginTop: 4, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  effectsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effectButton: { borderWidth: 1, borderColor: '#bdbdbd', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  effectActive: { backgroundColor: '#111111', borderColor: '#111111' },
  effectText: { fontWeight: '800', fontSize: 11 },
  effectTextActive: { color: '#ffffff', fontWeight: '800', fontSize: 11 },
  effectNote: { fontSize: 11, lineHeight: 16, opacity: 0.6 },
  message: { fontSize: 12, lineHeight: 17 },
});
