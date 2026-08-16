import type { AspectRatio } from '@khe/contracts';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';
import { planCaptureRender, renderSummary } from '../studio/render-plan';

interface PhotoCaptureProps {
  eventId: string;
  store: LocalStore;
  onClose: () => void;
  onCaptured: (media: LocalMediaRecord, format: AspectRatio) => void;
}

function makeLocalId(): string {
  return `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function PhotoCapture({ eventId, store, onClose, onCaptured }: PhotoCaptureProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [format, setFormat] = useState<AspectRatio>('9:16');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  async function persistPhoto(uri: string): Promise<LocalMediaRecord> {
    const localId = makeLocalId();
    const capturedAt = new Date().toISOString();
    const directory = new Directory(Paths.document, 'captures', eventId);
    await directory.create({ idempotent: true, intermediates: true });
    const source = new File(uri);
    const destination = new File(directory, `${localId}.jpg`);
    await source.copy(destination);
    if (!destination.exists || destination.size <= 0) throw new Error('La photo n’a pas pu être conservée dans le stockage permanent.');
    if (!destination.md5) throw new Error('La photo est conservée localement mais son empreinte n’a pas pu être calculée.');
    const media: LocalMediaRecord = {
      localId,
      eventId,
      idempotencyKey: `${eventId}:${localId}`,
      contentHash: destination.md5,
      byteSize: destination.size,
      mimeType: 'image/jpeg',
      localUri: destination.uri,
      capturedAt,
      syncState: 'QUEUED',
      remoteId: null,
      uploadedBytes: 0,
      acknowledgedAt: null,
      retryCount: 0,
      lastError: null,
      updatedAt: capturedAt,
    };
    await store.upsertMedia(media);
    await store.enqueue({ localId, nextAttemptAt: capturedAt, retryCount: 0, lastError: null });
    return media;
  }

  async function takePhoto(): Promise<void> {
    if (!cameraRef.current || !ready || busy) return;
    setBusy(true);
    setMessage('');
    try {
      for (let value = 3; value >= 1; value -= 1) {
        setCountdown(value);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdown(null);
      const result = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (!result?.uri) throw new Error('La caméra n’a pas retourné de photo.');
      const media = await persistPhoto(result.uri);
      try {
        const renderJob = await planCaptureRender(media.localId, media.localUri);
        setMessage(`Photo conservée hors ligne • ${renderSummary(renderJob)}. Elle apparaît maintenant dans Galerie.`);
      } catch {
        setMessage('Photo conservée hors ligne et ajoutée à Galerie. Le plan créatif sera appliqué lors du rendu.');
      }
      onCaptured(media, format);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de prendre la photo.');
    } finally {
      setCountdown(null);
      setBusy(false);
    }
  }

  if (!permission?.granted) {
    return (
      <View style={styles.permissionPage}>
        <Text style={styles.brand}>KHE BOOTH</Text>
        <Text style={styles.title}>Mode Photo</Text>
        <Text style={styles.help}>Autorisez la caméra pour prendre les photos de l’événement. Le microphone n’est pas nécessaire en mode photo.</Text>
        <Pressable style={styles.primary} onPress={() => void requestPermission()}><Text style={styles.primaryText}>Autoriser la caméra</Text></Pressable>
        <Pressable style={styles.secondary} onPress={onClose}><Text style={styles.secondaryText}>Retour</Text></Pressable>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="picture" onCameraReady={() => setReady(true)} onMountError={(event) => setMessage(event.message)} />
      <View style={styles.topBar}>
        <Pressable disabled={busy} style={styles.glassButton} onPress={onClose}><Text style={styles.glassText}>Fermer</Text></Pressable>
        <Pressable disabled={busy} style={styles.glassButton} onPress={() => setFacing((value) => value === 'back' ? 'front' : 'back')}><Text style={styles.glassText}>Retourner</Text></Pressable>
      </View>
      {countdown !== null ? <View pointerEvents="none" style={styles.countdown}><Text style={styles.countdownText}>{countdown}</Text><Text style={styles.countdownHelp}>Souriez !</Text></View> : null}
      <View style={styles.bottomPanel}>
        <View style={styles.formatRow}>
          {(['9:16', '1:1'] as const).map((candidate) => (
            <Pressable key={candidate} disabled={busy} onPress={() => setFormat(candidate)} style={[styles.formatButton, format === candidate && styles.formatActive]}>
              <Text style={format === candidate ? styles.formatTextActive : styles.formatText}>{candidate}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.status}>{ready ? `PHOTO • ${format} • prêt` : 'Initialisation caméra…'}</Text>
        <Pressable disabled={!ready || busy} style={[styles.shutter, (!ready || busy) && styles.disabled]} onPress={() => void takePhoto()}>
          <View style={styles.shutterInner} />
        </Pressable>
        <Text style={styles.helpSmall}>La photo est enregistrée localement immédiatement, ajoutée à Galerie et placée en attente de synchronisation.</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  permissionPage: { flex: 1, backgroundColor: '#101010', padding: 28, justifyContent: 'center', gap: 16 },
  brand: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 3 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900' },
  help: { color: '#d3d3d3', fontSize: 16, lineHeight: 23 },
  primary: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryText: { color: '#111', fontWeight: '900' },
  secondary: { borderWidth: 1, borderColor: '#777', borderRadius: 14, padding: 14, alignItems: 'center' },
  secondaryText: { color: '#fff', fontWeight: '800' },
  topBar: { position: 'absolute', top: 22, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  glassButton: { backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  glassText: { color: '#fff', fontWeight: '900' },
  countdown: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.16)' },
  countdownText: { color: '#fff', fontSize: 92, fontWeight: '900' },
  countdownHelp: { color: '#fff', fontSize: 20, fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 },
  bottomPanel: { position: 'absolute', bottom: 12, left: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.82)', borderRadius: 22, padding: 14, gap: 10, alignItems: 'center' },
  formatRow: { flexDirection: 'row', gap: 8, width: '100%' },
  formatButton: { flex: 1, borderWidth: 1, borderColor: '#777', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  formatActive: { backgroundColor: '#fff', borderColor: '#fff' },
  formatText: { color: '#fff', fontWeight: '900' },
  formatTextActive: { color: '#111', fontWeight: '900' },
  status: { color: '#fff', fontWeight: '900' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  disabled: { opacity: 0.45 },
  helpSmall: { color: '#d2d2d2', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  message: { color: '#fff', fontSize: 12, lineHeight: 17, textAlign: 'center' },
});