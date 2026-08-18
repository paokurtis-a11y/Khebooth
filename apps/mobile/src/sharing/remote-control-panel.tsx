import type {
  CaptureDurationSeconds,
  RemoteCaptureCommand,
  StationControlContract,
  VisualEffect,
} from '@khe/contracts';
import { CAPTURE_DURATIONS, VISUAL_EFFECTS } from '@khe/contracts';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationExperienceApi } from '../api/station-api';
import { SharingLivePreview } from '../live/live-preview';

interface RemoteControlPanelProps {
  eventName: string;
  api: StationExperienceApi;
  stationToken: string;
}

const KHE_GOLD = '#d7b24c';
const KHE_GOLD_DARK = '#8b6819';
const KHE_SKY = '#dff5ff';
const KHE_SKY_STRONG = '#8ad9f5';
const FIREWORK_PARTICLES = Array.from({ length: 12 }, (_, index) => {
  const angle = (Math.PI * 2 * index) / 12;
  const radius = index % 2 === 0 ? 52 : 38;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
});

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
  const [lastRefreshAt, setLastRefreshAt] = useState(0);
  const lastServerSeconds = useRef(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const starProgress = useRef(new Animated.Value(0)).current;
  const celebration = useRef(new Animated.Value(0)).current;
  const wasConnected = useRef(false);
  const [trackWidth, setTrackWidth] = useState(260);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await api.control(stationToken);
        if (!cancelled) {
          setControl(next);
          lastServerSeconds.current = next.elapsedSeconds;
          setDisplaySeconds(next.elapsedSeconds);
          setLastRefreshAt(Date.now());
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Commande distante indisponible.');
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 700);
    return () => { cancelled = true; clearInterval(timer); };
  }, [api, stationToken]);

  const connectionStatus = control?.sharingConnectionStatus ?? 'DISCONNECTED';
  const captureOnline = control?.captureSeenAt
    ? Date.now() - new Date(control.captureSeenAt).getTime() < 5000
    : false;
  const connected = connectionStatus === 'ACCEPTED' && captureOnline;
  const connecting = connectionStatus === 'PENDING' || (connectionStatus === 'ACCEPTED' && !captureOnline);

  useEffect(() => {
    if (!connecting) {
      starProgress.stopAnimation();
      starProgress.setValue(connected ? 1 : 0);
      return;
    }
    starProgress.setValue(0);
    const animation = Animated.loop(
      Animated.timing(starProgress, {
        toValue: 1,
        duration: 1450,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [connected, connecting, starProgress]);

  useEffect(() => {
    if (connected && !wasConnected.current) {
      celebration.setValue(0);
      Animated.timing(celebration, {
        toValue: 1,
        duration: 1050,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    wasConnected.current = connected;
  }, [celebration, connected]);

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
    setBusy(true);
    setMessage('Demande de connexion envoyée à CAPTURE…');
    try {
      const next = await api.requestControlConnection(stationToken);
      setControl(next);
      setLastRefreshAt(Date.now());
      if (next.sharingConnectionStatus === 'ACCEPTED') {
        setMessage('CAPTURE avait déjà autorisé cette station SHARING.');
      } else {
        setMessage('Demande envoyée. Une fenêtre Accepter / Refuser s’affiche maintenant sur CAPTURE.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connexion à CAPTURE impossible pour le moment.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(): Promise<void> {
    setBusy(true);
    try {
      const next = await api.disconnectControlConnection(stationToken);
      setControl(next);
      setMessage('SHARING est déconnectée de CAPTURE. Vous pourrez redemander la connexion à tout moment.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Déconnexion impossible pour le moment.');
    } finally {
      setBusy(false);
    }
  }

  async function command(commandName: Exclude<RemoteCaptureCommand, 'NONE'>): Promise<void> {
    if (!connected) { setMessage('CAPTURE doit d’abord accepter la connexion SHARING.'); return; }
    setBusy(true);
    try {
      const next = await api.updateControlCommand(stationToken, { command: commandName });
      setControl(next);
      setMessage(`Commande ${commandName} envoyée à la station CAPTURE.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’envoyer la commande.');
    } finally { setBusy(false); }
  }

  async function selectEffect(selectedEffect: VisualEffect): Promise<void> {
    if (!connected) { setMessage('CAPTURE doit d’abord accepter la connexion SHARING.'); return; }
    setBusy(true);
    try {
      const next = await api.updateControlCommand(stationToken, { selectedEffect });
      setControl(next);
      setMessage(`Effet ${effectLabels[selectedEffect]} sélectionné.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de modifier l’effet.');
    } finally { setBusy(false); }
  }

  async function selectDuration(maxDurationSeconds: CaptureDurationSeconds): Promise<void> {
    if (!connected) { setMessage('CAPTURE doit d’abord accepter la connexion SHARING.'); return; }
    setBusy(true);
    try {
      const next = await api.updateControlCommand(stationToken, { maxDurationSeconds });
      setControl(next);
      setMessage(`Durée maximum réglée à ${maxDurationSeconds} secondes sur CAPTURE.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de modifier la durée.');
    } finally { setBusy(false); }
  }

  if (!control) {
    return <View style={styles.loading}><ActivityIndicator color={KHE_GOLD} /><Text>Initialisation de la régie SHARING…</Text></View>;
  }

  const paused = control.runtimeState === 'PAUSED';
  const active = ['COUNTDOWN', 'RECORDING', 'PAUSED', 'SAVING'].includes(control.runtimeState);
  const timerLabel = control.runtimeState === 'PAUSED' ? 'PAUSE' : control.runtimeState === 'RECORDING' ? '● REC' : 'TEMPS';
  const lastRefreshLabel = lastRefreshAt ? `${Math.max(0, Math.round((Date.now() - lastRefreshAt) / 1000))} s` : '—';
  const starTravel = Math.max(0, trackWidth - 48);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>RÉGIE SHARING</Text><Text style={styles.title}>{eventName}</Text></View>
        <View style={[styles.connectionBadge, connected && styles.connectionBadgeConnected]}>
          <View style={[styles.connectionDot, connected ? styles.dotConnected : styles.dotDisconnected]} />
          <Text style={styles.connectionText}>{connected ? 'Connecté' : connectionStatus === 'PENDING' ? 'En attente' : 'Déconnecté'}</Text>
        </View>
      </View>

      {connectionStatus === 'DISCONNECTED' || connectionStatus === 'REJECTED' ? (
        <Pressable disabled={busy} style={styles.connectCard} onPress={() => void requestConnection()}>
          <View style={styles.connectionHero}><Text style={styles.heroStar}>✦</Text><Text style={styles.heroLabel}>KHE LINK</Text></View>
          <Text style={styles.connectTitle}>{connectionStatus === 'REJECTED' ? 'Connexion refusée par CAPTURE' : 'Connecter SHARING à CAPTURE'}</Text>
          <Text style={styles.connectHelp}>SHARING envoie une demande à distance. CAPTURE reçoit immédiatement un message et choisit Accepter ou Refuser.</Text>
          <View style={styles.connectButton}><Text style={styles.connectButtonText}>{busy ? 'ENVOI…' : 'SE CONNECTER À CAPTURE'}</Text></View>
        </Pressable>
      ) : connecting ? (
        <View style={styles.connectingCard}>
          <View style={styles.connectionHero}><Text style={styles.heroStar}>✦</Text><Text style={styles.heroLabel}>CONNEXION KHE</Text></View>
          <Text style={styles.connectTitle}>{connectionStatus === 'PENDING' ? 'En attente de l’autorisation CAPTURE…' : 'CAPTURE autorisée, connexion en cours…'}</Text>
          <View style={styles.starTrack} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
            <View style={styles.starTrail} />
            <Animated.Text style={[styles.movingStar, { transform: [{ translateX: starProgress.interpolate({ inputRange: [0, 1], outputRange: [0, starTravel] }) }, { rotate: starProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>★</Animated.Text>
          </View>
          <Text style={styles.progressCaption}>L’étoile dorée parcourt toute la liaison jusqu’à CAPTURE.</Text>
          <Text style={styles.connectHelp}>{connectionStatus === 'PENDING' ? 'Validez la fenêtre de connexion sur la tablette CAPTURE.' : 'Autorisation reçue. KHE attend le heartbeat de CAPTURE.'}</Text>
          <View style={styles.inlineActions}>
            <Pressable disabled={busy} style={styles.retryButton} onPress={() => void requestConnection()}><Text style={styles.retryText}>RENVOYER LA DEMANDE</Text></Pressable>
            <Pressable disabled={busy} style={styles.disconnectButton} onPress={() => void disconnect()}><Text style={styles.disconnectText}>Annuler</Text></Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.connectedCard}>
          <View style={styles.successVisual} pointerEvents="none">
            <Animated.Text style={[styles.successStar, { transform: [{ scale: celebration.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.7, 1.35, 1] }) }] }]}>★</Animated.Text>
            {FIREWORK_PARTICLES.map((particle, index) => (
              <Animated.Text key={index} style={[styles.fireworkParticle, {
                opacity: celebration.interpolate({ inputRange: [0, 0.15, 0.78, 1], outputRange: [0, 1, 0.9, 0] }),
                transform: [
                  { translateX: celebration.interpolate({ inputRange: [0, 1], outputRange: [0, particle.x] }) },
                  { translateY: celebration.interpolate({ inputRange: [0, 1], outputRange: [0, particle.y] }) },
                  { scale: celebration.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.4, 1.2, 0.7] }) },
                ],
              }]}>✦</Animated.Text>
            ))}
          </View>
          <View style={styles.connectedRow}>
            <View style={{flex:1}}><Text style={styles.connectedTitle}>★ CAPTURE CONNECTÉE</Text><Text style={styles.connectedHelp}>Connexion autorisée · dernière synchronisation régie : {lastRefreshLabel}</Text></View>
            <Pressable disabled={busy} style={styles.disconnectButton} onPress={() => void disconnect()}><Text style={styles.disconnectText}>Déconnecter</Text></Pressable>
          </View>
        </View>
      )}

      <View>
        <Text style={styles.sectionTitle}>APERÇU LIVE CAPTURE</Text>
        <View style={styles.liveGap}>
          {connected ? <SharingLivePreview api={api} stationToken={stationToken} /> : <View style={styles.previewPlaceholder}><Text style={styles.previewPlaceholderText}>L’aperçu live démarrera automatiquement après l’acceptation de CAPTURE.</Text></View>}
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
          <Pressable key={seconds} disabled={busy || active || !connected} onPress={() => void selectDuration(seconds)} style={[styles.durationButton, control.maxDurationSeconds === seconds && styles.durationButtonActive, (busy || active || !connected) && styles.disabled]}>
            <Text style={control.maxDurationSeconds === seconds ? styles.durationTextActive : styles.durationText}>{seconds}s</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.commandRow}>
        <Pressable disabled={busy || active || !connected} onPress={() => void command('START')} style={[styles.commandButton, (busy || active || !connected) && styles.disabled]}><Text style={styles.commandText}>● REC</Text></Pressable>
        <Pressable disabled={busy || (!paused && control.runtimeState !== 'RECORDING') || !connected} onPress={() => void command(paused ? 'RESUME' : 'PAUSE')} style={[styles.commandButton, (busy || (!paused && control.runtimeState !== 'RECORDING') || !connected) && styles.disabled]}><Text style={styles.commandText}>{paused ? '▶ REPRENDRE' : 'Ⅱ PAUSE'}</Text></Pressable>
        <Pressable disabled={busy || !active || !connected} onPress={() => void command('STOP')} style={[styles.commandButton, (busy || !active || !connected) && styles.disabled]}><Text style={styles.commandText}>■ STOP</Text></Pressable>
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
  connectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#bad9e7', backgroundColor:'#effaff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  connectionBadgeConnected:{borderColor:KHE_GOLD,backgroundColor:'#fff9e9'},
  connectionDot: { width: 10, height: 10, borderRadius: 5 },
  dotConnected: { backgroundColor: KHE_GOLD },
  dotDisconnected: { backgroundColor: '#55bde3' },
  connectionText: { fontSize: 10, fontWeight: '900' },
  connectCard: { borderWidth: 2, borderColor: KHE_GOLD, backgroundColor:KHE_SKY, borderRadius: 22, padding: 18, gap: 10 },
  connectingCard: { borderWidth: 2, borderColor: KHE_GOLD, backgroundColor:KHE_SKY, borderRadius: 22, padding: 18, gap: 11, overflow: 'hidden' },
  connectedCard: { borderWidth: 2, borderColor: KHE_GOLD, backgroundColor:'#e9f9ff', borderRadius: 22, padding: 16, overflow:'hidden' },
  connectionHero:{alignItems:'center',gap:3,marginBottom:2},heroStar:{fontSize:38,color:KHE_GOLD,textShadowColor:'#ffffff',textShadowRadius:9},heroLabel:{fontSize:9,letterSpacing:2.5,fontWeight:'900',color:KHE_GOLD_DARK},
  connectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, zIndex:2 },
  inlineActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  connectTitle: { fontSize: 18, fontWeight: '900', color:'#173548',textAlign:'center' },
  connectHelp: { fontSize: 11, lineHeight: 17, color:'#315a70',textAlign:'center' },
  connectButton: { backgroundColor: KHE_GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center',borderWidth:1,borderColor:'#f6df8f' },
  connectButtonText: { color: '#332400', fontWeight: '900', fontSize: 11, letterSpacing: 0.7 },
  starTrack: { height: 48, borderRadius: 24, backgroundColor:'#aee5f7',borderWidth:1,borderColor:'#7fc9e5', justifyContent: 'center', paddingHorizontal: 9, overflow: 'hidden' },
  starTrail:{position:'absolute',left:18,right:18,height:4,borderRadius:2,backgroundColor:'rgba(255,255,255,.78)'},
  movingStar: { color: KHE_GOLD, fontSize: 30, width: 38,textShadowColor:'#fff6ce',textShadowRadius:8 },
  progressCaption:{fontSize:9,textAlign:'center',fontWeight:'800',color:'#58758a'},
  retryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: KHE_GOLD_DARK, backgroundColor:'#fff9e9',borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 },
  retryText: { fontWeight: '900', fontSize: 10,color:KHE_GOLD_DARK },
  connectedTitle: { color: KHE_GOLD_DARK, fontWeight: '900', fontSize: 13, letterSpacing: 0.7 },
  connectedHelp: { fontSize: 10, color:'#315a70', marginTop: 3 },
  disconnectButton: { borderWidth: 1, borderColor: KHE_GOLD_DARK, backgroundColor:'rgba(255,255,255,.72)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  disconnectText: { fontSize: 10, fontWeight: '800',color:'#5d4810' },
  successVisual:{height:88,alignItems:'center',justifyContent:'center',marginBottom:2},successStar:{position:'absolute',fontSize:44,color:KHE_GOLD,textShadowColor:'#fff6ce',textShadowRadius:12},fireworkParticle:{position:'absolute',fontSize:16,color:KHE_GOLD},
  liveGap: { marginTop: 8 },
  previewPlaceholder: { minHeight: 130, borderWidth: 1, borderColor: '#b9dcea', backgroundColor:'#f2fbff',borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 18 },
  previewPlaceholderText: { textAlign: 'center', fontSize: 11, lineHeight: 17, opacity: 0.6 },
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
