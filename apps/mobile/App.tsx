import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { EventManifestContract } from '@khe/contracts';
import { activateCaptureStation, fetchStationManifest } from './src/api/station-api';
import { readNonPermissionDeviceChecks } from './src/device/device-state';
import {
  isCaptureReady,
  permissionCheck,
  type DeviceCheck,
} from './src/device/device-readiness';
import {
  clearStationSession,
  loadCachedManifest,
  loadStationToken,
  saveStationSession,
} from './src/storage/station-cache';

export default function App() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [code, setCode] = useState('');
  const [manifest, setManifest] = useState<EventManifestContract | null>(null);
  const [checks, setChecks] = useState<DeviceCheck[]>([]);
  const [onlineFresh, setOnlineFresh] = useState(false);
  const [busy, setBusy] = useState(true);
  const [checkingDevice, setCheckingDevice] = useState(false);
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
      setChecks([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Activation impossible');
    } finally {
      setBusy(false);
    }
  }

  async function verifyDevice() {
    setCheckingDevice(true);
    setError('');
    try {
      const camera = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      const microphone = microphonePermission?.granted
        ? microphonePermission
        : await requestMicrophonePermission();
      const hardwareChecks = await readNonPermissionDeviceChecks();
      setChecks([
        permissionCheck('camera', camera.granted),
        permissionCheck('microphone', microphone.granted),
        ...hardwareChecks,
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Vérification de l’appareil impossible');
    } finally {
      setCheckingDevice(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError('');
    try {
      await clearStationSession();
      setManifest(null);
      setChecks([]);
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
    const captureReady = checks.length > 0 && isCaptureReady(checks);
    return (
      <SafeAreaView style={styles.page}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
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

          <View style={styles.card}>
            <Text style={styles.label}>Assistant de vérification</Text>
            <Text style={styles.sectionTitle}>Avant la capture</Text>
            <Text style={styles.muted}>La caméra, le microphone, le stockage, la batterie et l’orientation doivent être prêts. Le réseau reste facultatif.</Text>

            {checks.length === 0 ? (
              <Text style={styles.muted}>Aucune vérification effectuée.</Text>
            ) : (
              <View style={styles.checkList}>
                {checks.map((check) => (
                  <View key={check.id} style={styles.checkRow}>
                    <View style={[styles.checkDot, check.level === 'ready' ? styles.dotReady : check.level === 'warning' ? styles.dotWarning : styles.dotBlocked]} />
                    <View style={styles.checkText}>
                      <Text style={styles.value}>{check.label}</Text>
                      <Text style={styles.muted}>{check.detail}</Text>
                    </View>
                    <Text style={check.level === 'ready' ? styles.readyText : check.level === 'warning' ? styles.warningText : styles.blockedText}>
                      {check.level === 'ready' ? 'PRÊT' : check.level === 'warning' ? 'ATTENTION' : 'BLOQUÉ'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.primaryButton} disabled={checkingDevice} onPress={() => void verifyDevice()}>
              {checkingDevice ? <ActivityIndicator /> : <Text style={styles.primaryButtonText}>{checks.length ? 'Revérifier l’appareil' : 'Vérifier l’appareil'}</Text>}
            </Pressable>

            {captureReady ? (
              <View style={styles.readyPanel}>
                <Text style={styles.readyTitle}>Appareil prêt pour la capture</Text>
                <Text style={styles.muted}>La prochaine tranche ouvrira l’aperçu caméra, le compte à rebours et l’enregistrement local.</Text>
              </View>
            ) : null}
          </View>

          <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => void reset()}>
            <Text style={styles.secondaryButtonText}>Dissocier cette station</Text>
          </Pressable>
        </ScrollView>
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
  scrollContent: { padding: 28, gap: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  brand: { color: '#f7f7f8', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  gold: { color: '#d6af52' },
  title: { color: '#f7f7f8', fontSize: 30, fontWeight: '800' },
  sectionTitle: { color: '#f7f7f8', fontSize: 22, fontWeight: '800' },
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
  checkList: { gap: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopColor: '#27303d', borderTopWidth: 1, paddingTop: 10 },
  checkDot: { width: 10, height: 10, borderRadius: 5 },
  dotReady: { backgroundColor: '#79d6a3' },
  dotWarning: { backgroundColor: '#f0c36a' },
  dotBlocked: { backgroundColor: '#f16d7a' },
  checkText: { flex: 1 },
  readyText: { color: '#79d6a3', fontSize: 11, fontWeight: '900' },
  warningText: { color: '#f0c36a', fontSize: 11, fontWeight: '900' },
  blockedText: { color: '#f16d7a', fontSize: 11, fontWeight: '900' },
  readyPanel: { borderRadius: 12, borderColor: '#315b45', borderWidth: 1, backgroundColor: '#102219', padding: 14, gap: 5 },
  readyTitle: { color: '#79d6a3', fontSize: 17, fontWeight: '800' },
});
