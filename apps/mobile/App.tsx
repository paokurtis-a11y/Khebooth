import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { EventManifestContract } from '@khe/contracts';
import { activateCaptureStation, fetchStationManifest } from './src/api/station-api';
import {
  clearStationSession,
  loadCachedManifest,
  loadStationToken,
  saveStationSession,
} from './src/storage/station-cache';

export default function App() {
  const [code, setCode] = useState('');
  const [manifest, setManifest] = useState<EventManifestContract | null>(null);
  const [onlineFresh, setOnlineFresh] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void restore();
  }, []);

  async function restore() {
    setBusy(true);
    setError('');
    try {
      const cached = await loadCachedManifest();
      if (cached) setManifest(cached);

      const token = await loadStationToken();
      if (token) {
        try {
          const fresh = await fetchStationManifest(token);
          await saveStationSession(token, fresh);
          setManifest(fresh);
          setOnlineFresh(true);
        } catch {
          setOnlineFresh(false);
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Cache local indisponible');
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    const normalized = code.trim().toUpperCase();
    if (!/^KHE-\d{6}$/.test(normalized)) {
      setError('Le code doit être au format KHE-123456.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await activateCaptureStation(normalized);
      await saveStationSession(result.stationToken, result.manifest);
      setManifest(result.manifest);
      setOnlineFresh(true);
      setCode('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Activation impossible');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError('');
    try {
      await clearStationSession();
      setManifest(null);
      setOnlineFresh(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Réinitialisation impossible');
    } finally {
      setBusy(false);
    }
  }

  if (busy && !manifest) {
    return (
      <SafeAreaView style={styles.page}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Chargement de KHE Booth Capture…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (manifest) {
    return (
      <SafeAreaView style={styles.page}>
        <StatusBar style="light" />
        <View style={styles.container}>
          <Text style={styles.brand}>KHE <Text style={styles.gold}>Booth</Text></Text>
          <View style={styles.badge}><Text style={styles.badgeText}>CAPTURE STATION</Text></View>
          <View style={styles.card}>
            <Text style={styles.label}>Événement chargé</Text>
            <Text style={styles.title}>{manifest.event.name}</Text>
            <Text style={styles.muted}>{manifest.event.venueName ?? 'Lieu non renseigné'}</Text>
            <Text style={styles.muted}>{new Date(manifest.event.startsAt).toLocaleString('fr-CH')}</Text>
            <View style={styles.divider} />
            <Text style={styles.label}>Preset</Text>
            <Text style={styles.value}>{manifest.preset?.name ?? 'Aucun preset'}</Text>
            <Text style={styles.value}>{manifest.preset?.aspectRatio === 'PORTRAIT_9_16' ? '9:16' : manifest.preset?.aspectRatio === 'SQUARE_1_1' ? '1:1' : '—'}</Text>
          </View>
          <View style={[styles.status, onlineFresh ? styles.statusOnline : styles.statusOffline]}>
            <Text style={styles.statusText}>{onlineFresh ? 'Manifest synchronisé' : 'Mode hors connexion · manifest local'}</Text>
          </View>
          <Text style={styles.muted}>Prochaine étape : vérification caméra, micro, stockage, batterie, orientation et réseau.</Text>
          <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => void reset()}>
            <Text style={styles.secondaryButtonText}>Dissocier cette station</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.brand}>KHE <Text style={styles.gold}>Booth</Text></Text>
        <Text style={styles.title}>Activer la tablette Capture</Text>
        <Text style={styles.muted}>Saisissez le code temporaire généré depuis le portail opérateur.</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Code événement</Text>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            maxLength={10}
            onChangeText={setCode}
            placeholder="KHE-123456"
            placeholderTextColor="#6f7782"
            style={styles.input}
            value={code}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primaryButton} disabled={busy} onPress={() => void activate()}>
            {busy ? <ActivityIndicator /> : <Text style={styles.primaryButtonText}>Activer et télécharger l’événement</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#090b0f' },
  container: { flex: 1, padding: 28, justifyContent: 'center', gap: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  brand: { color: '#f7f7f8', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  gold: { color: '#d6af52' },
  title: { color: '#f7f7f8', fontSize: 30, fontWeight: '800' },
  muted: { color: '#9aa4b2', fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: '#12161d', borderColor: '#27303d', borderWidth: 1, borderRadius: 18, padding: 20, gap: 12 },
  label: { color: '#9aa4b2', fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  value: { color: '#f7f7f8', fontSize: 17, fontWeight: '700' },
  input: { borderColor: '#27303d', borderWidth: 1, borderRadius: 12, backgroundColor: '#0d1118', color: '#f7f7f8', fontSize: 22, fontWeight: '800', letterSpacing: 2, padding: 14 },
  primaryButton: { minHeight: 50, borderRadius: 12, backgroundColor: '#d6af52', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#16120a', fontWeight: '800', textAlign: 'center' },
  secondaryButton: { minHeight: 48, borderRadius: 12, borderColor: '#27303d', borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: '#f7f7f8', fontWeight: '700' },
  error: { color: '#f16d7a', lineHeight: 20 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#181e27' },
  badgeText: { color: '#d6af52', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: '#27303d', marginVertical: 4 },
  status: { borderRadius: 12, borderWidth: 1, padding: 13 },
  statusOnline: { borderColor: '#315b45', backgroundColor: '#102219' },
  statusOffline: { borderColor: '#67522c', backgroundColor: '#241d10' },
  statusText: { color: '#f7f7f8', fontWeight: '700' },
});
