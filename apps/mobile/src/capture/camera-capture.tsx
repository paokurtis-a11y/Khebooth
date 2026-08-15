import type { AspectRatio } from '@khe/contracts';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';

interface CameraCaptureProps {
  eventId: string;
  store: LocalStore;
  onClose: () => void;
  onCaptured: (media: LocalMediaRecord, format: AspectRatio) => void;
}

function makeLocalId(): string {
  return `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function CameraCapture({ eventId, store, onClose, onCaptured }: CameraCaptureProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [format, setFormat] = useState<AspectRatio>('9:16');
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState('');

  async function requestPermissions(): Promise<void> {
    setMessage('');
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    const microphone = microphonePermission?.granted
      ? microphonePermission
      : await requestMicrophonePermission();
    if (!camera.granted || !microphone.granted) {
      setMessage('La caméra et le microphone sont nécessaires pour enregistrer une vidéo avec son.');
    }
  }

  async function persistRecording(uri: string): Promise<LocalMediaRecord> {
    const localId = makeLocalId();
    const capturedAt = new Date().toISOString();
    const directory = new Directory(Paths.document, 'captures', eventId);
    await directory.create({ idempotent: true, intermediates: true });

    const source = new File(uri);
    const destination = new File(directory, `${localId}.mp4`);

    // expo-file-system SDK 56 performs relocation asynchronously. Waiting for
    // the copy is critical: checking destination.exists immediately after
    // starting the copy can falsely report that persistence failed on Android.
    await source.copy(destination);

    if (!destination.exists || destination.size <= 0) {
      throw new Error('La vidéo n’a pas pu être conservée dans le stockage permanent.');
    }
    if (!destination.md5) {
      throw new Error('La vidéo est conservée localement mais son empreinte n’a pas pu être calculée.');
    }

    const media: LocalMediaRecord = {
      localId,
      eventId,
      idempotencyKey: `${eventId}:${localId}`,
      contentHash: destination.md5,
      byteSize: destination.size,
      mimeType: 'video/mp4',
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
    await store.enqueue({
      localId,
      nextAttemptAt: capturedAt,
      retryCount: 0,
      lastError: null,
    });
    return media;
  }

  async function startRecording(): Promise<void> {
    if (!cameraRef.current || !ready || recording) return;
    setMessage('');
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (!result?.uri) {
        setMessage('Enregistrement interrompu avant la création du fichier vidéo.');
        return;
      }
      const media = await persistRecording(result.uri);
      onCaptured(media, format);
      setMessage(
        `Vidéo conservée hors ligne (${format}). Elle ne sera pas supprimée avant synchronisation confirmée.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Échec de l’enregistrement vidéo.');
    } finally {
      setRecording(false);
    }
  }

  function stopRecording(): void {
    cameraRef.current?.stopRecording();
  }

  if (!cameraPermission?.granted || !microphonePermission?.granted) {
    return (
      <View style={styles.permissionPage}>
        <Text style={styles.brand}>KHE BOOTH</Text>
        <Text style={styles.title}>Autorisation caméra</Text>
        <Text style={styles.help}>
          KHE Booth a besoin de la caméra et du microphone pour produire les vidéos événementielles avec son.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => void requestPermissions()}>
          <Text style={styles.primaryText}>Autoriser caméra + micro</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryText}>Retour</Text>
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="video"
        ratio={format === '1:1' ? '1:1' : '16:9'}
        videoQuality="1080p"
        onCameraReady={() => setReady(true)}
        onMountError={(event) => setMessage(event.message)}
      />
      <View style={styles.topControls}>
        <Pressable disabled={recording} style={styles.control} onPress={onClose}>
          <Text style={styles.controlText}>Fermer</Text>
        </Pressable>
        <Pressable
          disabled={recording}
          style={styles.control}
          onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
        >
          <Text style={styles.controlText}>Retourner</Text>
        </Pressable>
      </View>
      <View style={styles.bottomPanel}>
        <View style={styles.formatRow}>
          {(['9:16', '1:1'] as const).map((candidate) => (
            <Pressable
              key={candidate}
              disabled={recording}
              onPress={() => setFormat(candidate)}
              style={[styles.formatButton, format === candidate && styles.formatButtonActive]}
            >
              <Text style={format === candidate ? styles.formatTextActive : styles.formatText}>{candidate}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.status}>
          {recording ? 'Enregistrement en cours…' : ready ? `Prêt • ${format}` : 'Initialisation caméra…'}
        </Text>
        <Pressable
          disabled={!ready}
          style={[styles.recordButton, recording && styles.stopButton]}
          onPress={() => (recording ? stopRecording() : void startRecording())}
        >
          <Text style={styles.recordText}>{recording ? 'ARRÊTER' : 'ENREGISTRER'}</Text>
        </Pressable>
        <Text style={styles.policy}>
          Les vidéos sont d’abord copiées dans le stockage permanent de la tablette puis ajoutées à la file de synchronisation.
        </Text>
        {format === '1:1' ? (
          <Text style={styles.policy}>Le cadrage 1:1 sera normalisé lors du pipeline d’export MP4.</Text>
        ) : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  permissionPage: { flex: 1, backgroundColor: '#101010', padding: 28, justifyContent: 'center', gap: 16 },
  brand: { color: '#ffffff', fontSize: 14, letterSpacing: 3, fontWeight: '800' },
  title: { color: '#ffffff', fontSize: 30, fontWeight: '800' },
  help: { color: '#d3d3d3', fontSize: 16, lineHeight: 23 },
  primaryButton: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryText: { color: '#111111', fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderColor: '#777777', borderRadius: 14, padding: 14, alignItems: 'center' },
  secondaryText: { color: '#ffffff', fontWeight: '700' },
  topControls: { position: 'absolute', left: 18, right: 18, top: 28, flexDirection: 'row', justifyContent: 'space-between' },
  control: { backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  controlText: { color: '#ffffff', fontWeight: '700' },
  bottomPanel: { position: 'absolute', left: 16, right: 16, bottom: 20, backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 20, padding: 16, gap: 10 },
  formatRow: { flexDirection: 'row', gap: 10 },
  formatButton: { flex: 1, borderWidth: 1, borderColor: '#777777', borderRadius: 12, padding: 10, alignItems: 'center' },
  formatButtonActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  formatText: { color: '#ffffff', fontWeight: '800' },
  formatTextActive: { color: '#111111', fontWeight: '800' },
  status: { color: '#ffffff', textAlign: 'center', fontWeight: '700' },
  recordButton: { backgroundColor: '#ffffff', borderRadius: 16, padding: 18, alignItems: 'center' },
  stopButton: { backgroundColor: '#d9d9d9' },
  recordText: { color: '#111111', fontWeight: '900', letterSpacing: 1 },
  policy: { color: '#c9c9c9', fontSize: 12, lineHeight: 17 },
  message: { color: '#ffffff', fontSize: 13, lineHeight: 18 },
});
