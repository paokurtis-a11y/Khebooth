import { registerRootComponent } from 'expo';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StationMode } from '@khe/contracts';
import { HttpStationApi } from './api/station-api';
import { API_BASE_URL } from './config';
import { SQLiteLocalStore } from './offline/sqlite-store';
import type { PersistedStationContext } from './offline/types';
import { SecureStoreCredentialVault } from './security/secure-store-vault';
import { StationBootstrapService } from './station/station-bootstrap';

function makeInstallationId(): string {
  return `khe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function App() {
  const store = useMemo(() => new SQLiteLocalStore(), []);
  const vault = useMemo(() => new SecureStoreCredentialVault(), []);
  const api = useMemo(() => new HttpStationApi(API_BASE_URL), []);
  const bootstrap = useMemo(() => new StationBootstrapService(api, store, vault), [api, store, vault]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [station, setStation] = useState<PersistedStationContext | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [eventId, setEventId] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<StationMode>('CAPTURE');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await store.init();
        const cached = await bootstrap.getCachedContext();
        if (cached && !(await vault.getInstallationId())) {
          await vault.saveInstallationId(cached.installationId);
        }
        if (cancelled) return;
        setStation(cached);
        if (cached) {
          const manifest = await store.getManifest(cached.session.eventId);
          if (!cancelled) setEventName(manifest?.event.name ?? null);
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Impossible d’ouvrir le stockage local.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, store, vault]);

  async function activate(): Promise<void> {
    setBusy(true);
    setMessage('');
    try {
      let installationId = await vault.getInstallationId();
      if (!installationId) {
        installationId = makeInstallationId();
        await vault.saveInstallationId(installationId);
      }

      const response = await bootstrap.redeem({
        eventId: eventId.trim(),
        code: code.trim().toUpperCase(),
        installationId,
        mode,
        platform: 'react-native',
        deviceName: mode === 'CAPTURE' ? 'KHE Booth Capture' : 'KHE Booth Sharing',
      });
      const cached = await bootstrap.getCachedContext();
      setStation(cached);
      setEventName(response.manifest.event.name);
      setMessage('Station activée. Le manifest est disponible hors ligne.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Activation impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshManifest(): Promise<void> {
    setBusy(true);
    setMessage('');
    try {
      await bootstrap.refreshManifest();
      if (station) {
        const manifest = await store.getManifest(station.session.eventId);
        setEventName(manifest?.event.name ?? null);
      }
      setMessage('Manifest actualisé et remis en cache.');
    } catch (error) {
      setMessage(
        `Réseau indisponible : le cache local reste conservé. ${error instanceof Error ? error.message : ''}`.trim(),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Initialisation du stockage offline…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.brand}>KHE BOOTH</Text>
        <Text style={styles.title}>Station événement</Text>
        <Text style={styles.muted}>Offline-first • Capture et Sharing séparés</Text>

        {station ? (
          <View style={styles.section}>
            <Text style={styles.label}>Station active</Text>
            <Text style={styles.value}>{station.mode}</Text>
            <Text style={styles.label}>Événement</Text>
            <Text style={styles.value}>{eventName ?? station.session.eventId}</Text>
            <Text style={styles.label}>Session</Text>
            <Text style={styles.small}>{station.session.id}</Text>
            <Pressable disabled={busy} style={styles.primaryButton} onPress={() => void refreshManifest()}>
              <Text style={styles.primaryButtonText}>{busy ? 'Synchronisation…' : 'Actualiser le manifest'}</Text>
            </Pressable>
            <Text style={styles.notice}>
              La caméra reste volontairement désactivée jusqu’à validation complète du gate Phase 2C–E.
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.label}>Mode de la tablette</Text>
            <View style={styles.modeRow}>
              {(['CAPTURE', 'SHARING'] as const).map((candidate) => (
                <Pressable
                  key={candidate}
                  onPress={() => setMode(candidate)}
                  style={[styles.modeButton, mode === candidate && styles.modeButtonActive]}
                >
                  <Text style={mode === candidate ? styles.modeTextActive : styles.modeText}>{candidate}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Event ID</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              value={eventId}
              onChangeText={setEventId}
              placeholder="UUID de l’événement"
              style={styles.input}
            />
            <Text style={styles.label}>Code d’activation</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={setCode}
              placeholder="KHE-123456"
              style={styles.input}
            />
            <Pressable disabled={busy || !eventId.trim() || !code.trim()} style={styles.primaryButton} onPress={() => void activate()}>
              <Text style={styles.primaryButtonText}>{busy ? 'Activation…' : 'Activer cette station'}</Text>
            </Pressable>
          </View>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010', padding: 24, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  card: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, gap: 8 },
  brand: { fontSize: 13, letterSpacing: 3, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '800' },
  muted: { opacity: 0.6 },
  section: { marginTop: 18, gap: 10 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', opacity: 0.55 },
  value: { fontSize: 18, fontWeight: '700' },
  small: { fontSize: 12, opacity: 0.65 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeButton: { flex: 1, borderWidth: 1, borderColor: '#c9c9c9', borderRadius: 12, padding: 12, alignItems: 'center' },
  modeButtonActive: { backgroundColor: '#111111', borderColor: '#111111' },
  modeText: { fontWeight: '700' },
  modeTextActive: { color: '#ffffff', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#d6d6d6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  primaryButton: { marginTop: 8, backgroundColor: '#111111', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontWeight: '800' },
  notice: { marginTop: 8, fontSize: 12, lineHeight: 18, opacity: 0.65 },
  message: { marginTop: 14, fontSize: 13, lineHeight: 18 },
});

registerRootComponent(App);
