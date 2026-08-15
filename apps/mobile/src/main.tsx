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
import type { AspectRatio, StationMode } from '@khe/contracts';
import { HttpStationApi } from './api/station-api';
import { CameraCapture } from './capture/camera-capture';
import { API_BASE_URL } from './config';
import { MediaGallery } from './gallery/media-gallery';
import { SQLiteLocalStore } from './offline/sqlite-store';
import type { LocalMediaRecord, PersistedStationContext } from './offline/types';
import { SecureStoreCredentialVault } from './security/secure-store-vault';
import { RemoteControlPanel } from './sharing/remote-control-panel';
import { StationBootstrapService } from './station/station-bootstrap';

function makeInstallationId(): string {
  return `khe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function refreshErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  if (/fetch failed|network request failed|unknownhost|unable to resolve host|timed?\s*out/i.test(detail)) {
    return `Réseau indisponible : le cache local reste conservé. ${detail}`.trim();
  }
  if (/NativeDatabase|prepareAsync|SQLite|NullPointerException|database/i.test(detail)) {
    return `Stockage local indisponible : le cache existant reste conservé. ${detail}`.trim();
  }
  return `Actualisation impossible : le cache local reste conservé. ${detail}`.trim();
}

function App() {
  const store = useMemo(() => new SQLiteLocalStore(), []);
  const vault = useMemo(() => new SecureStoreCredentialVault(), []);
  const api = useMemo(() => new HttpStationApi(API_BASE_URL), []);
  const bootstrap = useMemo(() => new StationBootstrapService(api, store, vault), [api, store, vault]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [station, setStation] = useState<PersistedStationContext | null>(null);
  const [stationToken, setStationToken] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<StationMode>('CAPTURE');
  const [message, setMessage] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await store.init();
        const cached = await bootstrap.getCachedContext();
        const cachedToken = await vault.getStationToken();
        if (cached && !(await vault.getInstallationId())) {
          await vault.saveInstallationId(cached.installationId);
        }
        if (cancelled) return;
        setStation(cached);
        setStationToken(cachedToken);
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
        code: code.trim().toUpperCase(),
        installationId,
        mode,
        platform: 'react-native',
        deviceName: mode === 'CAPTURE' ? 'KHE Booth Capture' : 'KHE Booth Sharing',
      });
      const cached = await bootstrap.getCachedContext();
      setStation(cached);
      setStationToken(response.stationToken);
      setEventName(response.manifest.event.name);
      setMessage(`Station activée pour « ${response.manifest.event.name} ». L’événement a été identifié automatiquement.`);
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
      setMessage(refreshErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function handleCaptured(media: LocalMediaRecord, format: AspectRatio): void {
    setMessage(
      `Capture ${format} conservée localement (${Math.max(1, Math.round(media.byteSize / 1024 / 1024))} Mo) et placée en attente de synchronisation.`,
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Initialisation du stockage offline…</Text>
      </SafeAreaView>
    );
  }

  if (cameraOpen && station?.mode === 'CAPTURE' && stationToken) {
    return (
      <CameraCapture
        eventId={station.session.eventId}
        store={store}
        api={api}
        stationToken={stationToken}
        onClose={() => setCameraOpen(false)}
        onCaptured={handleCaptured}
      />
    );
  }

  if (galleryOpen && station?.mode === 'CAPTURE') {
    return (
      <MediaGallery
        eventId={station.session.eventId}
        eventName={eventName ?? station.session.eventId}
        store={store}
        onClose={() => setGalleryOpen(false)}
      />
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
            {station.mode === 'SHARING' && stationToken ? (
              <RemoteControlPanel
                eventName={eventName ?? 'Événement KHE Booth'}
                api={api}
                stationToken={stationToken}
              />
            ) : (
              <>
                <Text style={styles.label}>Station active</Text>
                <Text style={styles.value}>{station.mode}</Text>
                <Text style={styles.label}>Événement</Text>
                <Text style={styles.value}>{eventName ?? station.session.eventId}</Text>
                <Text style={styles.label}>Session</Text>
                <Text style={styles.small}>{station.session.id}</Text>
                <Pressable disabled={busy} style={styles.primaryButton} onPress={() => void refreshManifest()}>
                  <Text style={styles.primaryButtonText}>{busy ? 'Synchronisation…' : 'Actualiser le manifest'}</Text>
                </Pressable>
                <View style={styles.captureActions}>
                  <Pressable disabled={busy || !stationToken} style={styles.captureButton} onPress={() => setCameraOpen(true)}>
                    <Text style={styles.captureButtonText}>Ouvrir la caméra</Text>
                  </Pressable>
                  <Pressable disabled={busy} style={styles.galleryButton} onPress={() => setGalleryOpen(true)}>
                    <Text style={styles.galleryButtonText}>Galerie</Text>
                  </Pressable>
                </View>
                <Text style={styles.notice}>
                  Laisse la caméra CAPTURE ouverte pendant l’événement pour permettre à la tablette SHARING de piloter REC, Pause/Reprendre, Stop et les effets.
                </Text>
              </>
            )}
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
            <Text style={styles.label}>Code d’activation</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={setCode}
              placeholder="KHE-123456"
              style={styles.input}
            />
            <Text style={styles.activationHelp}>
              Aucun Event ID à saisir : KHE Booth retrouve automatiquement l’événement lié à ce code.
            </Text>
            <Pressable disabled={busy || !code.trim()} style={styles.primaryButton} onPress={() => void activate()}>
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
  activationHelp: { fontSize: 12, lineHeight: 17, opacity: 0.6 },
  primaryButton: { marginTop: 8, backgroundColor: '#111111', borderRadius: 12, padding: 14, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontWeight: '800' },
  captureActions: { flexDirection: 'row', gap: 10 },
  captureButton: { flex: 1, borderWidth: 1, borderColor: '#111111', borderRadius: 12, padding: 14, alignItems: 'center' },
  captureButtonText: { color: '#111111', fontWeight: '800' },
  galleryButton: { flex: 1, backgroundColor: '#111111', borderRadius: 12, padding: 14, alignItems: 'center' },
  galleryButtonText: { color: '#ffffff', fontWeight: '800' },
  notice: { marginTop: 8, fontSize: 12, lineHeight: 18, opacity: 0.65 },
  message: { marginTop: 14, fontSize: 13, lineHeight: 18 },
});

registerRootComponent(App);
