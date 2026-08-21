import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type {
  SharingBusinessSettingsContract,
  SharingGalleryLayout,
  SharingMediaFit,
  SocialProvider,
  StationExperienceApi,
} from '../api/station-api';
import { SocialConnectionsPanel } from './social-connections-panel';

const STATION_TOKEN_KEY = 'khe.station.token.v1';
const PROVIDERS: Array<{ key: SocialProvider; label: string; placeholder: string }> = [
  { key: 'WHATSAPP', label: 'WhatsApp', placeholder: 'https://wa.me/...' },
  { key: 'INSTAGRAM', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { key: 'FACEBOOK', label: 'Facebook', placeholder: 'https://facebook.com/...' },
  { key: 'TIKTOK', label: 'TikTok', placeholder: 'https://tiktok.com/@...' },
  { key: 'X', label: 'X', placeholder: 'https://x.com/...' },
  { key: 'TELEGRAM', label: 'Telegram', placeholder: 'https://t.me/...' },
  { key: 'YOUTUBE', label: 'YouTube', placeholder: 'https://youtube.com/@...' },
];

const DEFAULTS: SharingBusinessSettingsContract = {
  socialLinks: {},
  galleryLayout: 'MASONRY',
  portraitColumns: 2,
  landscapeColumns: 3,
  videoAutoplay: true,
  mediaFit: 'COVER',
  updatedAt: new Date(0).toISOString(),
};

function Choice<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (next: T) => void }) {
  return <View style={styles.choiceRow}>{options.map(([key, label]) => (
    <Pressable key={key} style={[styles.choice, value === key && styles.choiceActive]} onPress={() => onChange(key)}>
      <Text style={[styles.choiceText, value === key && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  ))}</View>;
}

function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (next: number) => void }) {
  return (
    <View style={styles.counterRow}>
      <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.help}>{value} colonne{value === 1 ? '' : 's'}</Text></View>
      <Pressable disabled={value <= min} style={styles.counterButton} onPress={() => onChange(Math.max(min, value - 1))}><Text style={styles.counterText}>−</Text></Pressable>
      <Text style={styles.counterValue}>{value}</Text>
      <Pressable disabled={value >= max} style={styles.counterButton} onPress={() => onChange(Math.min(max, value + 1))}><Text style={styles.counterText}>+</Text></Pressable>
    </View>
  );
}

export function SharingBusinessSettingsPanel({ api }: { api: StationExperienceApi }) {
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<SharingBusinessSettingsContract>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nextToken = await SecureStore.getItemAsync(STATION_TOKEN_KEY);
      if (cancelled) return;
      setToken(nextToken);
      if (!nextToken) { setLoading(false); return; }
      try {
        const remote = await api.sharingBusinessSettings(nextToken);
        if (!cancelled) setSettings({ ...DEFAULTS, ...remote, socialLinks: remote.socialLinks ?? {} });
      } catch (error) {
        if (!cancelled) {
          const text = error instanceof Error ? error.message : 'Réglages Business indisponibles.';
          setLocked(/BUSINESS|Only a Sharing station|abonnement/i.test(text));
          setMessage(text);
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [api]);

  const configuredCount = useMemo(() => PROVIDERS.filter(({ key }) => Boolean(settings.socialLinks[key])).length, [settings.socialLinks]);

  function patch(patchValue: Partial<SharingBusinessSettingsContract>) {
    setSettings((current) => ({ ...current, ...patchValue }));
  }

  function setSocialLink(provider: SocialProvider, value: string) {
    setSettings((current) => ({ ...current, socialLinks: { ...current.socialLinks, [provider]: value } }));
  }

  async function save(): Promise<void> {
    if (!token || locked) return;
    setSaving(true); setMessage('');
    try {
      const updated = await api.updateSharingBusinessSettings(token, settings);
      setSettings({ ...DEFAULTS, ...updated, socialLinks: updated.socialLinks ?? {} });
      setMessage('✓ Paramètres SHARING Business synchronisés avec KHE Booth.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer les paramètres Business.');
    } finally { setSaving(false); }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>SHARING • BUSINESS</Text>
          <Text style={styles.title}>Galerie & réseaux sociaux</Text>
          <Text style={styles.help}>Personnalisez la galerie de l’événement et reliez les pages sociales utilisées par les QR de partage.</Text>
        </View>
        <View style={styles.businessBadge}><Text style={styles.businessText}>BUSINESS</Text></View>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color="#d2ad4f" /><Text style={styles.help}>Chargement des options Business…</Text></View> : null}
      {locked ? <View style={styles.locked}><Text style={styles.lockedTitle}>Fonction Business verrouillée</Text><Text style={styles.help}>Ces options sont disponibles sur une station SHARING rattachée à un abonnement BUSINESS ou supérieur.</Text></View> : null}

      {!loading && !locked && token ? <>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mise en page des Moments</Text>
          <Text style={styles.help}>Par défaut KHE utilise une mosaïque dynamique adaptée aux médias verticaux et horizontaux.</Text>
          <Choice<SharingGalleryLayout> value={settings.galleryLayout} onChange={(galleryLayout) => patch({ galleryLayout })} options={[["MASONRY","Mosaïque"],["GRID","Grille"],["COMPACT","Compacte"]]} />
          <Counter label="Tablette verticale" value={settings.portraitColumns} min={1} max={4} onChange={(portraitColumns) => patch({ portraitColumns })} />
          <Counter label="Tablette horizontale" value={settings.landscapeColumns} min={1} max={6} onChange={(landscapeColumns) => patch({ landscapeColumns })} />
          <Text style={styles.fieldLabel}>Recadrage des médias</Text>
          <Choice<SharingMediaFit> value={settings.mediaFit} onChange={(mediaFit) => patch({ mediaFit })} options={[["COVER","Remplir"],["CONTAIN","Voir en entier"]]} />
          <Pressable style={styles.toggleRow} onPress={() => patch({ videoAutoplay: !settings.videoAutoplay })}>
            <View style={{ flex: 1 }}><Text style={styles.fieldLabel}>Vidéos animées automatiquement</Text><Text style={styles.help}>Les vidéos démarrent en boucle et sans son dans les cartes de la galerie.</Text></View>
            <View style={[styles.toggle, settings.videoAutoplay && styles.toggleActive]}><View style={[styles.knob, settings.videoAutoplay && styles.knobActive]} /></View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pages sociales de l’événement</Text>
          <Text style={styles.help}>{configuredCount}/7 réseaux configurés. Utilisez des liens HTTPS vers les comptes officiels que vous contrôlez.</Text>
          {PROVIDERS.map(({ key, label, placeholder }) => <View key={key} style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
              value={settings.socialLinks[key] ?? ''}
              onChangeText={(value) => setSocialLink(key, value)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={placeholder}
              placeholderTextColor="#6f6f74"
              style={styles.input}
            />
          </View>)}
          <Text style={styles.help}>Ces liens servent aux QR et boutons publics. La connexion API ci-dessous reste indépendante : KHE ne considérera jamais un lien comme une autorisation de publier ou d’envoyer des messages.</Text>
        </View>

        <SocialConnectionsPanel />

        <Pressable disabled={saving} style={[styles.saveButton, saving && { opacity: .55 }]} onPress={() => void save()}>
          <Text style={styles.saveText}>{saving ? 'ENREGISTREMENT…' : 'ENREGISTRER LES PARAMÈTRES BUSINESS'}</Text>
        </Pressable>
      </> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111114', borderRadius: 20, padding: 16, gap: 14, borderWidth: 1, borderColor: '#4b3e25' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrow: { color: '#d2ad4f', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#fff', fontSize: 21, fontWeight: '900', marginTop: 3 },
  help: { color: '#aaa', fontSize: 11, lineHeight: 17 },
  businessBadge: { borderRadius: 999, backgroundColor: '#d2ad4f', paddingHorizontal: 9, paddingVertical: 6 },
  businessText: { color: '#111', fontSize: 9, fontWeight: '900' },
  loading: { paddingVertical: 12, alignItems: 'center', gap: 7 },
  locked: { backgroundColor: '#1d1d22', borderRadius: 14, padding: 13, gap: 4 },
  lockedTitle: { color: '#fff', fontWeight: '900' },
  section: { gap: 10, borderTopWidth: 1, borderTopColor: '#29292f', paddingTop: 14 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { borderWidth: 1, borderColor: '#515158', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  choiceActive: { backgroundColor: '#d2ad4f', borderColor: '#d2ad4f' },
  choiceText: { color: '#ddd', fontSize: 10, fontWeight: '900' },
  choiceTextActive: { color: '#111' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#18181c', borderRadius: 13, padding: 11 },
  counterButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#2a2a30', alignItems: 'center', justifyContent: 'center' },
  counterText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  counterValue: { color: '#d2ad4f', width: 24, textAlign: 'center', fontWeight: '900' },
  field: { gap: 5 },
  fieldLabel: { color: '#fff', fontSize: 11, fontWeight: '900' },
  input: { color: '#fff', backgroundColor: '#1a1a1f', borderWidth: 1, borderColor: '#393940', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181c', borderRadius: 13, padding: 12 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#3b3b40', padding: 3 },
  toggleActive: { backgroundColor: '#d2ad4f' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#aaa' },
  knobActive: { marginLeft: 20, backgroundColor: '#111' },
  saveButton: { backgroundColor: '#b31520', borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: .5 },
  message: { color: '#d8c69b', fontSize: 11, lineHeight: 17, fontWeight: '700' },
});
