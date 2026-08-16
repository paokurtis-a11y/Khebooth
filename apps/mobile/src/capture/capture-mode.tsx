import type { AspectRatio } from '@khe/contracts';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationApi } from '../api/station-api';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord } from '../offline/types';
import { CameraCapture } from './camera-capture';
import { PhotoCapture } from './photo-capture';

type CaptureMode = 'CHOOSER' | 'VIDEO' | 'PHOTO';

interface CaptureModeScreenProps {
  eventId: string;
  store: LocalStore;
  api: StationApi;
  stationToken: string;
  onClose: () => void;
  onCaptured: (media: LocalMediaRecord, format: AspectRatio) => void;
}

export function CaptureModeScreen(props: CaptureModeScreenProps) {
  const [mode, setMode] = useState<CaptureMode>('CHOOSER');

  if (mode === 'VIDEO') {
    return <CameraCapture {...props} onClose={() => setMode('CHOOSER')} />;
  }

  if (mode === 'PHOTO') {
    return <PhotoCapture eventId={props.eventId} store={props.store} onCaptured={props.onCaptured} onClose={() => setMode('CHOOSER')} />;
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.brand}>KHE BOOTH</Text>
        <Text style={styles.title}>Que voulez-vous capturer ?</Text>
        <Text style={styles.subtitle}>Choisissez le mode pour cette prise. Vous pourrez revenir ici après chaque photo ou vidéo.</Text>
      </View>

      <View style={styles.cards}>
        <Pressable style={styles.card} onPress={() => setMode('PHOTO')}>
          <Text style={styles.icon}>◎</Text>
          <Text style={styles.cardTitle}>PHOTO</Text>
          <Text style={styles.cardHelp}>Photo haute qualité, galerie immédiate, design créatif et impression.</Text>
          <View style={styles.cardAction}><Text style={styles.cardActionText}>OUVRIR PHOTO</Text></View>
        </Pressable>

        <Pressable style={styles.card} onPress={() => setMode('VIDEO')}>
          <Text style={styles.icon}>▶</Text>
          <Text style={styles.cardTitle}>VIDÉO 360</Text>
          <Text style={styles.cardHelp}>Décompte, minuteur, effets, régie SHARING, audio et rendu créatif.</Text>
          <View style={styles.cardAction}><Text style={styles.cardActionText}>OUVRIR VIDÉO</Text></View>
        </Pressable>
      </View>

      <Text style={styles.note}>Les deux modes sont offline-first : le média est d’abord conservé sur cette tablette avant synchronisation.</Text>
      <Pressable style={styles.close} onPress={props.onClose}><Text style={styles.closeText}>Fermer la caméra</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0b0b0c', padding: 24, justifyContent: 'center', gap: 22 },
  header: { gap: 7 },
  brand: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  title: { color: '#fff', fontSize: 30, lineHeight: 36, fontWeight: '900' },
  subtitle: { color: '#aaa', fontSize: 15, lineHeight: 22 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { flexGrow: 1, flexBasis: 260, minHeight: 250, borderRadius: 24, backgroundColor: '#18181a', padding: 22, gap: 10, justifyContent: 'flex-end', borderWidth: 1, borderColor: '#29292c' },
  icon: { color: '#111', backgroundColor: '#fff', width: 54, height: 54, borderRadius: 27, fontSize: 24, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden' },
  cardTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  cardHelp: { color: '#b5b5b5', lineHeight: 20 },
  cardAction: { marginTop: 8, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cardActionText: { color: '#111', fontWeight: '900', letterSpacing: 0.7 },
  note: { color: '#929292', fontSize: 12, lineHeight: 18 },
  close: { borderWidth: 1, borderColor: '#57575b', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeText: { color: '#fff', fontWeight: '800' },
});