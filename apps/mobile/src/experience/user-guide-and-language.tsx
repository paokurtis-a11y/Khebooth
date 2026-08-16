import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type AppLanguage = 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt';

const LANGUAGE_KEY = 'khe.language.preference.v1';
const DEVICE_ONLY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const SUPPORTED_LANGUAGES: Array<{ code: AppLanguage; label: string; nativeLabel: string }> = [
  { code: 'fr', label: 'Français', nativeLabel: 'Français' },
  { code: 'en', label: 'Anglais', nativeLabel: 'English' },
  { code: 'de', label: 'Allemand', nativeLabel: 'Deutsch' },
  { code: 'it', label: 'Italien', nativeLabel: 'Italiano' },
  { code: 'es', label: 'Espagnol', nativeLabel: 'Español' },
  { code: 'pt', label: 'Portugais', nativeLabel: 'Português' },
];

export function getDeviceLocaleInfo(): { locale: string; region: string | null; suggestedLanguage: AppLanguage } {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'fr-CH';
  const parts = locale.replace('_', '-').split('-');
  const language = parts[0]?.toLowerCase();
  const region = parts.find((part) => /^[A-Z]{2}$/.test(part)) ?? null;
  const supported = SUPPORTED_LANGUAGES.some((candidate) => candidate.code === language);
  return { locale, region, suggestedLanguage: supported ? language as AppLanguage : 'fr' };
}

export async function loadLanguagePreference(): Promise<AppLanguage | null> {
  const value = await SecureStore.getItemAsync(LANGUAGE_KEY);
  return SUPPORTED_LANGUAGES.some((candidate) => candidate.code === value) ? value as AppLanguage : null;
}

export async function saveLanguagePreference(language: AppLanguage): Promise<void> {
  await SecureStore.setItemAsync(LANGUAGE_KEY, language, DEVICE_ONLY_OPTIONS);
}

export function languageLabel(language: AppLanguage): string {
  return SUPPORTED_LANGUAGES.find((candidate) => candidate.code === language)?.nativeLabel ?? language;
}

export function UserGuide({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={styles.brand}>KHE BOOTH</Text><Text style={styles.slogan}>Votre événement, notre expertise !</Text></View>
          <Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>
        <Text style={styles.title}>Mode d’emploi</Text>
        <Text style={styles.intro}>Ce guide fait partie de l’application et doit évoluer avec chaque fonction importante de KHE Booth.</Text>

        <GuideSection title="1. Activer une station" body="Choisissez CAPTURE ou SHARING, saisissez uniquement le code d’activation puis validez. L’Event ID est retrouvé automatiquement. Une station peut être désactivée depuis Menu sans effacer les médias locaux." />
        <GuideSection title="2. Station CAPTURE" body="Ouvrez la caméra, choisissez PHOTO ou VIDÉO selon les fonctions disponibles, sélectionnez le format et la durée puis lancez la prise. Les médias sont conservés localement avant synchronisation. Gardez CAPTURE ouverte pendant la prestation pour le pilotage SHARING." />
        <GuideSection title="3. Station SHARING" body="Utilisez le bouton de connexion à CAPTURE. Le point vert signifie qu’une présence CAPTURE récente est réellement détectée ; le rouge signifie qu’elle n’est pas joignable. SHARING peut piloter les commandes autorisées et suivre le minuteur." />
        <GuideSection title="4. Galerie" body="La galerie regroupe les moments de l’événement. Touchez un média pour le lire ou l’ouvrir, vérifiez son état de synchronisation avant suppression, et utilisez les fonctions d’impression lorsqu’elles sont proposées pour les photos." />
        <GuideSection title="5. Offline-first" body="Une coupure Internet ne doit pas supprimer les prises locales. Évitez de désinstaller l’application, vider ses données ou supprimer un média non synchronisé tant que vous n’avez pas vérifié sa sauvegarde." />
        <GuideSection title="6. Veille et sécurité" body="L’anti-veille et le verrouillage KHE sont des options de confort et de sécurité. Ils peuvent être ignorés. Si vous activez la veille sécurisée, configurez un mot de passe de secours et utilisez la biométrie ou la sécurité Android compatible si vous le souhaitez." />
        <GuideSection title="7. Langues et région" body="KHE propose une langue à partir de la langue/région de la tablette. Vous restez libre de la modifier. Une localisation précise ne doit jamais être nécessaire pour prendre des photos ou vidéos." />
        <GuideSection title="8. Mises à jour" body="Consultez régulièrement Menu → Version. Lorsqu’une nouvelle version modifie les fonctions ou les conditions d’utilisation, KHE peut demander une nouvelle lecture et acceptation avant de continuer." />
      </ScrollView>
    </View>
  );
}

function GuideSection({ title, body }: { title: string; body: string }) {
  return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{body}</Text></View>;
}

export function LanguageAndRegion({ onClose, onChanged }: { onClose: () => void; onChanged?: (language: AppLanguage) => void }) {
  const device = useMemo(() => getDeviceLocaleInfo(), []);
  const [selected, setSelected] = useState<AppLanguage>(device.suggestedLanguage);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadLanguagePreference().then((value) => { if (value) setSelected(value); });
  }, []);

  async function choose(language: AppLanguage): Promise<void> {
    setSelected(language);
    await saveLanguagePreference(language);
    setSaved(true);
    onChanged?.(language);
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={styles.brand}>LANGUES</Text><Text style={styles.slogan}>Choisissez la langue qui vous convient.</Text></View>
          <Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Région détectée depuis la tablette</Text>
          <Text style={styles.infoValue}>{device.locale}{device.region ? ` • ${device.region}` : ''}</Text>
          <Text style={styles.body}>Langue suggérée : {languageLabel(device.suggestedLanguage)}. Cette détection utilise les réglages régionaux de la tablette et ne nécessite pas le GPS.</Text>
        </View>
        <View style={styles.languageGrid}>
          {SUPPORTED_LANGUAGES.map((language) => (
            <Pressable key={language.code} onPress={() => void choose(language.code)} style={[styles.languageButton, selected === language.code && styles.languageButtonActive]}>
              <Text style={selected === language.code ? styles.languageTextActive : styles.languageText}>{language.nativeLabel}</Text>
              <Text style={selected === language.code ? styles.languageSmallActive : styles.languageSmall}>{language.label}</Text>
            </Pressable>
          ))}
        </View>
        {saved ? <Text style={styles.saved}>Langue enregistrée. Les écrans traduits utiliseront progressivement cette préférence.</Text> : null}
        <Text style={styles.privacy}>La localisation précise reste facultative. KHE ne doit jamais bloquer CAPTURE ou SHARING parce qu’un utilisateur refuse la localisation.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' },
  scroll: { padding: 22, paddingBottom: 60, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { color: '#ffffff', fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  slogan: { color: '#c8c8c8', marginTop: 4, fontWeight: '700' },
  close: { borderWidth: 1, borderColor: '#4d4d4d', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  closeText: { color: '#ffffff', fontWeight: '900' },
  title: { color: '#ffffff', fontSize: 32, fontWeight: '900' },
  intro: { color: '#bdbdbd', lineHeight: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, gap: 7 },
  cardTitle: { color: '#111111', fontSize: 17, fontWeight: '900' },
  body: { color: '#555555', lineHeight: 19, fontSize: 13 },
  infoCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, gap: 5 },
  infoLabel: { color: '#777777', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  infoValue: { color: '#111111', fontSize: 22, fontWeight: '900' },
  languageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  languageButton: { width: '48%', minWidth: 140, borderWidth: 1, borderColor: '#555555', borderRadius: 16, padding: 15, backgroundColor: '#1a1a1a' },
  languageButtonActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  languageText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  languageTextActive: { color: '#111111', fontWeight: '900', fontSize: 16 },
  languageSmall: { color: '#999999', fontSize: 11, marginTop: 3 },
  languageSmallActive: { color: '#666666', fontSize: 11, marginTop: 3 },
  saved: { color: '#b9efbd', fontWeight: '800' },
  privacy: { color: '#aaaaaa', fontSize: 11, lineHeight: 17 },
});