import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationApi } from '../api/station-api';
import { RemoteControlPanel } from './remote-control-panel';
import { SharingEventManager } from './sharing-event-manager';
import { SharingMediaGallery } from './sharing-media-gallery';

interface SharingStationPanelProps {
  eventName: string;
  api: StationApi;
  stationToken: string;
  onClientEventCreated?: (eventId:string,eventName:string)=>void;
}

export function SharingStationPanel({ eventName, api, stationToken, onClientEventCreated }: SharingStationPanelProps) {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const checkingRef = useRef(false);

  async function initialize(): Promise<void> {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setError('');
    try {
      await Promise.all([api.control(stationToken), api.listMedia(stationToken), api.clientWorkspace(stationToken)]);
      setReady(true);
    } catch (cause) {
      setReady(false);
      setError(cause instanceof Error ? cause.message : 'Impossible d’initialiser la régie SHARING.');
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }

  useEffect(() => { void initialize(); }, [api, stationToken]);

  if (!ready) {
    return (
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}><View style={styles.dot} /><Text style={styles.eyebrow}>RÉGIE SHARING</Text></View>
        <Text style={styles.title}>{checking ? 'Connexion à KHE Booth…' : 'Connexion interrompue'}</Text>
        {checking ? <ActivityIndicator color="#d2ad4f" size="large" /> : null}
        <Text style={styles.help}>{checking ? 'Vérification de la session, de CAPTURE, des événements client et de la galerie Cloud.' : error}</Text>
        {!checking ? <Pressable style={styles.retry} onPress={() => void initialize()}><Text style={styles.retryText}>RÉESSAYER LA CONNEXION</Text></Pressable> : null}
      </View>
    );
  }

  return (
    <View style={styles.readyShell}>
      <SharingEventManager api={api} stationToken={stationToken} onCreated={(eventId,eventTitle)=>onClientEventCreated?.(eventId,eventTitle)} />
      <RemoteControlPanel eventName={eventName} api={api} stationToken={stationToken} />
      <SharingMediaGallery eventName={eventName} api={api} stationToken={stationToken} />
    </View>
  );
}

const styles = StyleSheet.create({
  readyShell: { gap: 14 },
  statusCard: { marginTop: 16, backgroundColor: '#111113', borderRadius: 22, padding: 22, gap: 14, borderWidth: 1, borderColor: '#30291d' },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#d2ad4f' },
  eyebrow: { color: '#d2ad4f', fontSize: 11, letterSpacing: 2, fontWeight: '900' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  help: { color: '#c4bfba', lineHeight: 20 },
  retry: { backgroundColor: '#b31520', borderRadius: 14, padding: 14, alignItems: 'center' },
  retryText: { color: '#fff', fontWeight: '900', letterSpacing: 0.7 },
});
