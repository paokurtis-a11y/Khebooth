import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CREATIVE_PRESETS, type CreativePreset, type CreativePresetCategory } from './creative-presets';

const FILTERS: Array<{ id: 'ALL' | CreativePresetCategory; label: string }> = [
  { id: 'ALL', label: 'Tous' },
  { id: 'SIGNATURE', label: 'Signature' },
  { id: 'MARIAGE', label: 'Mariage' },
  { id: 'FETE', label: 'Fête' },
  { id: 'GALA', label: 'Gala' },
  { id: 'ENTREPRISE', label: 'Entreprise' },
  { id: 'DOUX', label: 'Doux' },
];

function PresetArtwork({ preset }: { preset: CreativePreset }) {
  return <View style={[styles.artwork, { backgroundColor: preset.backdrop }]}>
    <View style={[styles.orbitLarge, { borderColor: preset.accent }]} />
    <View style={[styles.orbitSmall, { borderColor: preset.secondary }]} />
    <View style={[styles.lightBeam, { backgroundColor: preset.secondary }]} />
    <Text style={[styles.artworkStar, { color: preset.accent }]}>✦</Text>
    <View style={styles.artworkCopy}><Text style={styles.artworkKhe}>KHE BOOTH</Text><Text style={styles.artworkTitle}>{preset.name}</Text><Text style={[styles.artworkLine, { backgroundColor: preset.accent }]} /></View>
    <View style={[styles.intensityBadge, { borderColor: preset.accent }]}><Text style={[styles.intensityText, { color: preset.accent }]}>{preset.intensity}</Text></View>
  </View>;
}

export function CreativePresetLibrary({ selectedPresetId, disabled, onSelect }: { selectedPresetId?: string | null; disabled: boolean; onSelect: (preset: CreativePreset) => void }) {
  const [filter, setFilter] = useState<'ALL' | CreativePresetCategory>('ALL');
  const visible = useMemo(() => filter === 'ALL' ? CREATIVE_PRESETS : CREATIVE_PRESETS.filter((preset) => preset.category === filter), [filter]);

  return <View style={styles.library}>
    <View style={styles.headingRow}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>BIBLIOTHÈQUE KHE • PRÊT À L’EMPLOI</Text><Text style={styles.heading}>Choisissez votre ambiance</Text><Text style={styles.help}>Un toucher applique immédiatement toute la composition. Vous pourrez ensuite modifier chaque détail.</Text></View><View style={styles.countBadge}><Text style={styles.count}>{CREATIVE_PRESETS.length}</Text><Text style={styles.countLabel}>MODÈLES</Text></View></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{FILTERS.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: filter === item.id }} style={[styles.filter, filter === item.id && styles.filterActive]} onPress={() => setFilter(item.id)}><Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={276} decelerationRate="fast" contentContainerStyle={styles.cards}>{visible.map((preset) => {
      const selected = selectedPresetId === preset.id;
      return <View key={preset.id} style={[styles.card, selected && { borderColor: preset.accent, borderWidth: 2 }]}>
        <PresetArtwork preset={preset} />
        <View style={styles.cardBody}><Text style={[styles.cardEyebrow, { color: preset.accent }]}>{preset.eyebrow}</Text><Text style={styles.cardTitle}>{preset.name}</Text><Text style={styles.cardDescription}>{preset.description}</Text><View style={styles.effectList}>{preset.effects.map((effect) => <View key={effect} style={styles.effectChip}><Text style={styles.effectText}>{effect}</Text></View>)}</View><Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Utiliser le modèle ${preset.name}`} style={[styles.useButton, { backgroundColor: preset.accent }, disabled && styles.disabled]} onPress={() => onSelect(preset)}><Text style={styles.useText}>{selected ? '✓ MODÈLE SÉLECTIONNÉ' : 'UTILISER CE MODÈLE'}</Text></Pressable></View>
      </View>;
    })}</ScrollView>
    <Text style={styles.footerHint}>Glissez horizontalement pour découvrir les modèles • Le modèle choisi est synchronisé avec CAPTURE et SHARING.</Text>
  </View>;
}

const styles = StyleSheet.create({
  library: { backgroundColor: '#111114', borderRadius: 24, borderWidth: 1, borderColor: '#3c3424', paddingVertical: 18, gap: 14, overflow: 'hidden' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 }, eyebrow: { color: '#d2ad4f', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }, heading: { color: '#fff', fontSize: 23, fontWeight: '900', marginTop: 4 }, help: { color: '#aaa6a2', fontSize: 11, lineHeight: 17, marginTop: 4 }, countBadge: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#d2ad4f', alignItems: 'center', justifyContent: 'center' }, count: { color: '#111', fontSize: 21, fontWeight: '900', lineHeight: 23 }, countLabel: { color: '#111', fontSize: 7, fontWeight: '900', letterSpacing: .8 },
  filters: { gap: 7, paddingHorizontal: 18 }, filter: { borderWidth: 1, borderColor: '#47474d', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#18181c' }, filterActive: { backgroundColor: '#d2ad4f', borderColor: '#d2ad4f' }, filterText: { color: '#d7d7dc', fontSize: 10, fontWeight: '900' }, filterTextActive: { color: '#151109' },
  cards: { gap: 12, paddingHorizontal: 18, paddingBottom: 2 }, card: { width: 264, borderRadius: 20, backgroundColor: '#1a1a1f', borderWidth: 1, borderColor: '#34343a', overflow: 'hidden' }, artwork: { height: 166, overflow: 'hidden', justifyContent: 'flex-end', padding: 15 }, orbitLarge: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 2, opacity: .72, right: -54, top: -52 }, orbitSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 10, opacity: .2, right: -12, top: 22 }, lightBeam: { position: 'absolute', width: 240, height: 34, opacity: .13, transform: [{ rotate: '-24deg' }], left: -35, top: 56 }, artworkStar: { position: 'absolute', right: 22, top: 18, fontSize: 31, fontWeight: '900' }, artworkCopy: { gap: 4 }, artworkKhe: { color: '#ffffffaa', fontSize: 8, fontWeight: '900', letterSpacing: 2.4 }, artworkTitle: { color: '#fff', fontSize: 21, lineHeight: 24, fontWeight: '900', width: '80%' }, artworkLine: { width: 54, height: 4, borderRadius: 2, marginTop: 3 }, intensityBadge: { position: 'absolute', left: 14, top: 14, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#0b0b0ca8' }, intensityText: { fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  cardBody: { padding: 15, gap: 8 }, cardEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 1.4 }, cardTitle: { color: '#fff', fontSize: 17, fontWeight: '900' }, cardDescription: { color: '#b7b7bc', fontSize: 10, lineHeight: 15, minHeight: 45 }, effectList: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, effectChip: { backgroundColor: '#29292f', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 5 }, effectText: { color: '#dddde2', fontSize: 7, fontWeight: '800' }, useButton: { borderRadius: 11, paddingVertical: 11, alignItems: 'center', marginTop: 3 }, useText: { color: '#151109', fontSize: 9, fontWeight: '900', letterSpacing: .4 }, disabled: { opacity: .4 }, footerHint: { color: '#837d72', fontSize: 8, lineHeight: 13, paddingHorizontal: 18, fontWeight: '700' },
});
