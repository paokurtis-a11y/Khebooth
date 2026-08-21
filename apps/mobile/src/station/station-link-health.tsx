import * as Network from 'expo-network';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StationExperienceApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import { evaluateLinkHealth, type LinkHealthSnapshot } from './link-health-model';
import type { StationMode } from '@khe/contracts';

interface StationLinkHealthProps {
  mode: StationMode;
  eventId: string;
  eventName: string;
  api: StationExperienceApi;
  stationToken: string;
  store: LocalStore;
  onClose?: () => void;
}

const REFRESH_MS = 3_000;
const LEVEL_COLORS = {
  READY: '#57c785',
  SYNCING: '#d7b24c',
  ATTENTION: '#ff9f66',
  OFFLINE: '#ff6b78',
} as const;

function ageLabel(seconds: number | null): string {
  if (seconds === null) return 'Jamais';
  if (seconds < 2) return 'À l’instant';
  if (seconds < 60) return `Il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `Il y a ${minutes} min`;
}

function dateLabel(value: string | null): string {
  if (!value) return 'Aucune confirmation Cloud';
  return new Date(value).toLocaleString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function StateRow({ label, value, ok, hint }: { label: string; value: string; ok?: boolean; hint?: string }) {
  return <View style={styles.stateRow}>
    <View style={styles.stateCopy}>
      <Text style={styles.stateLabel}>{label}</Text>
      {hint ? <Text style={styles.stateHint}>{hint}</Text> : null}
    </View>
    <Text style={[styles.stateValue, ok === true && styles.valueOk, ok === false && styles.valueBad]}>{value}</Text>
  </View>;
}

export function StationLinkHealth({ mode, eventId, eventName, api, stationToken, store, onClose }: StationLinkHealthProps) {
  const [snapshot, setSnapshot] = useState<LinkHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const runningRef = useRef(false);

  const refresh = useCallback(async (manual = false) => {
    if (runningRef.current) return;
    runningRef.current = true;
    if (!snapshot) setLoading(true);
    try {
      const network = await Network.getNetworkStateAsync();
      const networkConnected = network.isConnected !== false && network.isInternetReachable !== false;
      const [manifestResult, controlResult, remoteResult, localMedia, queue] = await Promise.all([
        api.manifest(stationToken).then((value) => ({ ok: true as const, value })).catch(() => ({ ok: false as const, value: null })),
        api.control(stationToken).then((value) => ({ ok: true as const, value })).catch(() => ({ ok: false as const, value: null })),
        api.listMedia(stationToken).then((value) => ({ ok: true as const, value })).catch(() => ({ ok: false as const, value: [] })),
        store.listMedia(eventId),
        store.listQueue(),
      ]);
      const apiReachable = manifestResult.ok || controlResult.ok || remoteResult.ok;
      const next = evaluateLinkHealth({
        mode,
        eventId,
        manifestEventId: manifestResult.value?.event.id ?? null,
        networkConnected,
        apiReachable,
        control: controlResult.value,
        localMedia,
        queue,
        remoteMedia: remoteResult.value,
        checkedAt: new Date(),
      });
      setSnapshot(next);
      setMessage(manual ? `✓ Diagnostic KHE actualisé à ${new Date().toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.` : '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Diagnostic KHE momentanément indisponible.');
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [api, eventId, mode, snapshot, stationToken, store]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const color = snapshot ? LEVEL_COLORS[snapshot.level] : '#d7b24c';

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>KHE LINK HEALTH · {mode}</Text>
        <Text style={styles.title}>Liaison & synchronisation</Text>
        <Text style={styles.subtitle}>{eventName}</Text>
      </View>
      {onClose ? <Pressable style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable> : null}
    </View>

    {loading && !snapshot ? <View style={styles.loading}><ActivityIndicator color="#d7b24c"/><Text style={styles.muted}>Vérification des deux stations…</Text></View> : null}

    {snapshot ? <>
      <View style={[styles.hero, { borderColor: color }]}> 
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroStatus, { color }]}>{snapshot.title}</Text>
          <Text style={styles.heroSummary}>{snapshot.summary}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>ÉTAT DES DEUX TABLETTES</Text>
        <StateRow label="Événement" value={snapshot.eventMatches ? 'Même événement' : 'Incohérent'} ok={snapshot.eventMatches} hint={eventId} />
        <StateRow label="Réseau" value={snapshot.networkConnected ? 'Connecté' : 'Hors ligne'} ok={snapshot.networkConnected} />
        <StateRow label="Cloud KHE" value={snapshot.apiReachable ? 'Joignable' : 'Indisponible'} ok={snapshot.apiReachable} />
        <StateRow label="CAPTURE" value={snapshot.captureOnline ? 'En ligne' : 'Non détectée'} ok={snapshot.captureOnline} hint={`Heartbeat : ${ageLabel(snapshot.captureSeenAgeSeconds)}`} />
        <StateRow label="Autorisation SHARING" value={snapshot.connectionStatus} ok={snapshot.connectionStatus === 'ACCEPTED'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>SYNCHRONISATION DES MOMENTS</Text>
        <StateRow label="En attente / envoi" value={String(snapshot.pendingMedia)} ok={snapshot.pendingMedia === 0} hint={`${snapshot.queueItems} élément(s) dans la file de l’événement actif`} />
        <StateRow label="Échecs locaux" value={String(snapshot.failedMedia)} ok={snapshot.failedMedia === 0} hint={snapshot.oldestPendingAgeSeconds === null ? 'Aucune attente locale' : `Plus ancienne attente : ${ageLabel(snapshot.oldestPendingAgeSeconds)}`} />
        <StateRow label="Cloud synchronisé" value={String(snapshot.remoteSyncedMedia)} hint={`Dernier ACK : ${dateLabel(snapshot.latestCloudAckAt)}`} />
        <StateRow label="Commandes SHARING → CAPTURE" value={snapshot.commandLag === 0 ? 'À jour' : `${snapshot.commandLag} en attente`} ok={snapshot.commandLag === 0} />
      </View>

      {snapshot.reasons.length ? <View style={styles.card}>
        <Text style={styles.cardTitle}>À CONTRÔLER</Text>
        {snapshot.reasons.map((reason, index) => <Text key={`${reason}-${index}`} style={styles.reason}>• {reason}</Text>)}
      </View> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>REPRISE AUTOMATIQUE KHE</Text>
        {snapshot.advice.length ? snapshot.advice.map((entry, index) => <Text key={`${entry}-${index}`} style={styles.advice}>✓ {entry}</Text>) : <Text style={styles.advice}>✓ Aucune intervention nécessaire. La liaison est prête.</Text>}
        <Text style={styles.technical}>{mode === 'CAPTURE'
          ? 'CAPTURE vérifie sa file environ toutes les 2 secondes. En cas d’échec réseau, le délai de retry augmente progressivement jusqu’à 60 secondes. Les fichiers locaux ne sont pas effacés par le diagnostic.'
          : 'SHARING vérifie les nouveaux médias Cloud environ toutes les 2 secondes. Le diagnostic ne supprime, ne republie et ne retransfère aucun fichier.'}</Text>
      </View>

      <Pressable style={styles.refreshButton} onPress={() => void refresh(true)}><Text style={styles.refreshText}>↻ RELANCER LE DIAGNOSTIC</Text></Pressable>
      {message ? <Text style={message.startsWith('✓') ? styles.success : styles.error}>{message}</Text> : null}
    </> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' },
  content: { padding: 18, paddingBottom: 44, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#d7b24c', fontWeight: '900', fontSize: 11, letterSpacing: 1.4 },
  title: { color: '#fff', fontSize: 27, lineHeight: 33, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#aeb7c0', fontSize: 14, marginTop: 3 },
  closeButton: { borderWidth: 1, borderColor: '#49515a', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  closeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  loading: { minHeight: 180, justifyContent: 'center', alignItems: 'center', gap: 10 },
  muted: { color: '#9da7b0' },
  hero: { borderWidth: 2, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#181b1f' },
  statusDot: { width: 14, height: 14, borderRadius: 7 },
  heroStatus: { fontWeight: '950', fontSize: 23, letterSpacing: .8 },
  heroSummary: { color: '#e4e8eb', lineHeight: 20, marginTop: 3 },
  card: { backgroundColor: '#181b1f', borderWidth: 1, borderColor: '#2f3740', borderRadius: 16, padding: 15, gap: 3 },
  cardTitle: { color: '#d7b24c', fontSize: 11, letterSpacing: 1.2, fontWeight: '900', marginBottom: 7 },
  stateRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#343b43' },
  stateCopy: { flex: 1 },
  stateLabel: { color: '#fff', fontWeight: '800', fontSize: 13 },
  stateHint: { color: '#89939e', fontSize: 10, lineHeight: 14, marginTop: 3 },
  stateValue: { color: '#d9dee2', fontSize: 12, fontWeight: '900', textAlign: 'right', maxWidth: '42%' },
  valueOk: { color: '#57c785' },
  valueBad: { color: '#ff7b86' },
  reason: { color: '#ffd1b5', lineHeight: 20, fontSize: 13, paddingVertical: 2 },
  advice: { color: '#cdeed9', lineHeight: 20, fontSize: 13, paddingVertical: 2 },
  technical: { color: '#8f9aa4', fontSize: 11, lineHeight: 17, marginTop: 8 },
  refreshButton: { backgroundColor: '#d7b24c', borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  refreshText: { color: '#111', fontWeight: '950', letterSpacing: .5 },
  success: { color: '#75d69c', textAlign: 'center', fontWeight: '800' },
  error: { color: '#ff7b86', textAlign: 'center', fontWeight: '800' },
});
