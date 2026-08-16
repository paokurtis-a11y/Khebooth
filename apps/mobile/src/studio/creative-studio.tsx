import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export type AudioMode = 'MUSIC_ONLY' | 'MIC_ONLY';
export type SpeedEffect = '0.5x' | '0.75x' | '1x' | '1.25x' | '1.5x' | '2x';
export type DesignTemplate = 'NONE' | 'WEDDING' | 'BIRTHDAY' | 'GALA' | 'BABY' | 'CUSTOM';

export interface MusicAsset {
  id: string;
  name: string;
  uri: string;
  mimeType?: string;
}

export interface CreativePlan {
  template: DesignTemplate;
  title: string;
  subtitle: string;
  frameStyle: 'NONE' | 'CLASSIC' | 'GOLD' | 'NEON' | 'POLAROID';
  textPosition: 'TOP' | 'CENTER' | 'BOTTOM';
  speed: SpeedEffect;
  boomerang: boolean;
  reverse: boolean;
  freezeFrame: boolean;
  colorEffect: 'NONE' | 'WARM' | 'COOL' | 'GOLD' | 'MONO' | 'PARTY';
  audioMode: AudioMode;
  musicRotationEvery: number;
  music: MusicAsset[];
}

const STORAGE_KEY = 'khe.creative.plan.v1';

export const DEFAULT_CREATIVE_PLAN: CreativePlan = {
  template: 'NONE',
  title: '',
  subtitle: '',
  frameStyle: 'NONE',
  textPosition: 'BOTTOM',
  speed: '1x',
  boomerang: false,
  reverse: false,
  freezeFrame: false,
  colorEffect: 'NONE',
  audioMode: 'MIC_ONLY',
  musicRotationEvery: 3,
  music: [],
};

const templateLabels: Record<DesignTemplate, string> = {
  NONE: 'Sans design',
  WEDDING: 'Heureux mariage',
  BIRTHDAY: 'Joyeux anniversaire',
  GALA: 'Soirée / Gala',
  BABY: 'Baby shower',
  CUSTOM: 'Création libre',
};

export async function loadCreativePlan(): Promise<CreativePlan> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return DEFAULT_CREATIVE_PLAN;
  try {
    const parsed = JSON.parse(raw) as Partial<CreativePlan>;
    return { ...DEFAULT_CREATIVE_PLAN, ...parsed, music: Array.isArray(parsed.music) ? parsed.music.slice(0, 3) : [] };
  } catch {
    return DEFAULT_CREATIVE_PLAN;
  }
}

export async function saveCreativePlan(plan: CreativePlan): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(plan), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

function MusicPreview({ asset, onRemove }: { asset: MusicAsset; onRemove: () => void }) {
  const player = useAudioPlayer(asset.uri);
  const [playing, setPlaying] = useState(false);
  function toggle(): void {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      void player.seekTo(0).then(() => { player.play(); setPlaying(true); });
    }
  }
  return (
    <View style={styles.musicCard}>
      <View style={{ flex: 1 }}><Text style={styles.musicName} numberOfLines={1}>{asset.name}</Text><Text style={styles.help}>MP3 / MP4 audio / WAV</Text></View>
      <Pressable style={styles.smallButton} onPress={toggle}><Text style={styles.smallButtonText}>{playing ? 'Pause' : 'Écouter'}</Text></Pressable>
      <Pressable style={styles.removeButton} onPress={onRemove}><Text style={styles.removeText}>×</Text></Pressable>
    </View>
  );
}

export function CreativeStudio({ onClose }: { onClose: () => void }) {
  const [plan, setPlan] = useState<CreativePlan>(DEFAULT_CREATIVE_PLAN);
  const [saved, setSaved] = useState(false);
  useEffect(() => { void loadCreativePlan().then(setPlan); }, []);

  const presetText = useMemo(() => {
    if (plan.template === 'WEDDING') return ['Heureux mariage', 'Merci de partager ce moment avec nous'];
    if (plan.template === 'BIRTHDAY') return ['Joyeux anniversaire', 'Un souvenir rien que pour vous'];
    if (plan.template === 'GALA') return ['Soirée exceptionnelle', 'KHE Booth'];
    if (plan.template === 'BABY') return ['Bienvenue bébé', 'Un joli souvenir'];
    return ['', ''];
  }, [plan.template]);

  function patch(patchValue: Partial<CreativePlan>): void {
    setSaved(false);
    setPlan((current) => ({ ...current, ...patchValue }));
  }

  function chooseTemplate(template: DesignTemplate): void {
    const defaults = template === 'CUSTOM' || template === 'NONE' ? ['', ''] : template === plan.template ? [plan.title, plan.subtitle] :
      template === 'WEDDING' ? ['Heureux mariage', 'Merci de partager ce moment avec nous'] :
      template === 'BIRTHDAY' ? ['Joyeux anniversaire', 'Un souvenir rien que pour vous'] :
      template === 'GALA' ? ['Soirée exceptionnelle', 'KHE Booth'] : ['Bienvenue bébé', 'Un joli souvenir'];
    patch({ template, title: defaults[0], subtitle: defaults[1] });
  }

  async function importMusic(): Promise<void> {
    if (plan.music.length >= 3) {
      Alert.alert('Maximum atteint', 'Vous pouvez sélectionner jusqu’à 3 musiques par événement.');
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const remaining = 3 - plan.music.length;
    const additions = result.assets.slice(0, remaining).map((asset, index) => ({
      id: `music-${Date.now()}-${index}`,
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType,
    }));
    patch({ music: [...plan.music, ...additions] });
  }

  async function persist(): Promise<void> {
    await saveCreativePlan(plan);
    setSaved(true);
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.brand}>KHE DESIGN</Text><Text style={styles.title}>Studio créatif</Text><Text style={styles.help}>Créez le style visuel et sonore de vos prises.</Text></View><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable></View>

        <View style={[styles.preview, plan.frameStyle === 'GOLD' && styles.previewGold, plan.frameStyle === 'NEON' && styles.previewNeon]}>
          <Text style={styles.previewKhe}>KHE BOOTH</Text>
          <View style={styles.previewCenter}><Text style={styles.previewTitle}>{plan.title || presetText[0] || 'Votre création'}</Text><Text style={styles.previewSub}>{plan.subtitle || presetText[1] || 'Texte, cadre et effets personnalisables'}</Text></View>
          <Text style={styles.previewFooter}>{templateLabels[plan.template]} • {plan.speed} • {plan.audioMode === 'MIC_ONLY' ? 'Micro' : 'Musique'}</Text>
        </View>

        <Text style={styles.section}>MODÈLES</Text>
        <View style={styles.wrap}>{(Object.keys(templateLabels) as DesignTemplate[]).map((template) => <Pressable key={template} style={[styles.chip, plan.template === template && styles.chipActive]} onPress={() => chooseTemplate(template)}><Text style={plan.template === template ? styles.chipTextActive : styles.chipText}>{templateLabels[template]}</Text></Pressable>)}</View>

        <Text style={styles.section}>TEXTE</Text>
        <TextInput style={styles.input} value={plan.title} onChangeText={(title) => patch({ title })} placeholder="Titre du design" />
        <TextInput style={styles.input} value={plan.subtitle} onChangeText={(subtitle) => patch({ subtitle })} placeholder="Sous-titre / noms / date" />
        <View style={styles.wrap}>{(['TOP', 'CENTER', 'BOTTOM'] as const).map((position) => <Pressable key={position} style={[styles.chip, plan.textPosition === position && styles.chipActive]} onPress={() => patch({ textPosition: position })}><Text style={plan.textPosition === position ? styles.chipTextActive : styles.chipText}>{position === 'TOP' ? 'Haut' : position === 'CENTER' ? 'Centre' : 'Bas'}</Text></Pressable>)}</View>

        <Text style={styles.section}>CADRES</Text>
        <View style={styles.wrap}>{(['NONE', 'CLASSIC', 'GOLD', 'NEON', 'POLAROID'] as const).map((frameStyle) => <Pressable key={frameStyle} style={[styles.chip, plan.frameStyle === frameStyle && styles.chipActive]} onPress={() => patch({ frameStyle })}><Text style={plan.frameStyle === frameStyle ? styles.chipTextActive : styles.chipText}>{frameStyle === 'NONE' ? 'Aucun' : frameStyle}</Text></Pressable>)}</View>

        <Text style={styles.section}>EFFETS VIDÉO 360</Text>
        <View style={styles.wrap}>{(['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x'] as SpeedEffect[]).map((speed) => <Pressable key={speed} style={[styles.chip, plan.speed === speed && styles.chipActive]} onPress={() => patch({ speed })}><Text style={plan.speed === speed ? styles.chipTextActive : styles.chipText}>{speed}</Text></Pressable>)}</View>
        <View style={styles.wrap}><Pressable style={[styles.chip, plan.boomerang && styles.chipActive]} onPress={() => patch({ boomerang: !plan.boomerang })}><Text style={plan.boomerang ? styles.chipTextActive : styles.chipText}>Boomerang</Text></Pressable><Pressable style={[styles.chip, plan.reverse && styles.chipActive]} onPress={() => patch({ reverse: !plan.reverse })}><Text style={plan.reverse ? styles.chipTextActive : styles.chipText}>Reverse</Text></Pressable><Pressable style={[styles.chip, plan.freezeFrame && styles.chipActive]} onPress={() => patch({ freezeFrame: !plan.freezeFrame })}><Text style={plan.freezeFrame ? styles.chipTextActive : styles.chipText}>Freeze frame</Text></Pressable></View>
        <View style={styles.wrap}>{(['NONE', 'WARM', 'COOL', 'GOLD', 'MONO', 'PARTY'] as const).map((colorEffect) => <Pressable key={colorEffect} style={[styles.chip, plan.colorEffect === colorEffect && styles.chipActive]} onPress={() => patch({ colorEffect })}><Text style={plan.colorEffect === colorEffect ? styles.chipTextActive : styles.chipText}>{colorEffect}</Text></Pressable>)}</View>

        <Text style={styles.section}>SON DE LA VIDÉO</Text>
        <Text style={styles.help}>Une seule source finale à la fois : musique OU microphone. Jamais les deux simultanément.</Text>
        <View style={styles.row}><Pressable style={[styles.choice, plan.audioMode === 'MIC_ONLY' && styles.chipActive]} onPress={() => patch({ audioMode: 'MIC_ONLY' })}><Text style={plan.audioMode === 'MIC_ONLY' ? styles.chipTextActive : styles.chipText}>Micro</Text></Pressable><Pressable style={[styles.choice, plan.audioMode === 'MUSIC_ONLY' && styles.chipActive]} onPress={() => patch({ audioMode: 'MUSIC_ONLY' })}><Text style={plan.audioMode === 'MUSIC_ONLY' ? styles.chipTextActive : styles.chipText}>Musique</Text></Pressable></View>

        <Text style={styles.section}>PLAYLIST • 3 MUSIQUES MAXIMUM</Text>
        <Text style={styles.help}>Rotation automatique : une musique change toutes les 3 prises. L’ordre repart ensuite au début.</Text>
        <Pressable style={styles.importButton} onPress={() => void importMusic()}><Text style={styles.importText}>＋ Ajouter MP3 / MP4 / WAV</Text></Pressable>
        {plan.music.map((asset) => <MusicPreview key={asset.id} asset={asset} onRemove={() => patch({ music: plan.music.filter((item) => item.id !== asset.id) })} />)}

        <View style={styles.renderNotice}><Text style={styles.renderTitle}>Pipeline final</Text><Text style={styles.renderText}>Le fichier source original reste intact. Le plan créatif enregistré ici est destiné au rendu final : cadre, texte, vitesse/ralenti, reverse/boomerang, filtre et piste audio sélectionnée.</Text></View>

        <Pressable style={styles.save} onPress={() => void persist()}><Text style={styles.saveText}>{saved ? '✓ DESIGN ENREGISTRÉ' : 'ENREGISTRER LE DESIGN'}</Text></Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0e0e10' }, scroll: { padding: 20, paddingBottom: 60, gap: 12 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, brand: { color: '#ffffff', fontWeight: '900', letterSpacing: 3, fontSize: 12 }, title: { color: '#ffffff', fontWeight: '900', fontSize: 30 }, help: { color: '#a9a9ad', fontSize: 12, lineHeight: 18 }, close: { borderWidth: 1, borderColor: '#555', borderRadius: 12, padding: 10 }, closeText: { color: '#fff', fontWeight: '800' },
  preview: { minHeight: 260, borderRadius: 28, padding: 22, backgroundColor: '#18181b', borderWidth: 2, borderColor: '#333', justifyContent: 'space-between' }, previewGold: { borderColor: '#d7b75c' }, previewNeon: { borderColor: '#5de8ff' }, previewKhe: { color: '#fff', letterSpacing: 4, fontWeight: '900' }, previewCenter: { alignItems: 'center', gap: 8 }, previewTitle: { color: '#fff', fontWeight: '900', fontSize: 30, textAlign: 'center' }, previewSub: { color: '#ddd', textAlign: 'center' }, previewFooter: { color: '#aaa', fontSize: 11, textAlign: 'center' },
  section: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 2, marginTop: 10 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#3a3a3e', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }, chipActive: { backgroundColor: '#fff', borderColor: '#fff' }, chipText: { color: '#ddd', fontWeight: '800', fontSize: 11 }, chipTextActive: { color: '#111', fontWeight: '900', fontSize: 11 }, input: { backgroundColor: '#1b1b1f', borderRadius: 12, padding: 13, color: '#fff', borderWidth: 1, borderColor: '#333' }, row: { flexDirection: 'row', gap: 10 }, choice: { flex: 1, borderWidth: 1, borderColor: '#3a3a3e', borderRadius: 14, padding: 14, alignItems: 'center' },
  importButton: { borderWidth: 1, borderColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center' }, importText: { color: '#fff', fontWeight: '900' }, musicCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#18181b', borderRadius: 14, padding: 12 }, musicName: { color: '#fff', fontWeight: '800' }, smallButton: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }, smallButtonText: { color: '#111', fontWeight: '900', fontSize: 10 }, removeButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#6d3b3b', alignItems: 'center', justifyContent: 'center' }, removeText: { color: '#ff9c9c', fontSize: 20 }, renderNotice: { backgroundColor: '#1a2225', borderRadius: 16, padding: 14, gap: 4 }, renderTitle: { color: '#fff', fontWeight: '900' }, renderText: { color: '#b9c9cd', fontSize: 11, lineHeight: 17 }, save: { backgroundColor: '#fff', borderRadius: 16, padding: 17, alignItems: 'center', marginTop: 8 }, saveText: { fontWeight: '900', color: '#111' },
});