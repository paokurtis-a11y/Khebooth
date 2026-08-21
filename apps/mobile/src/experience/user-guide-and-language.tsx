import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, type AppLanguage } from './i18n';

export type { AppLanguage } from './i18n';

const LANGUAGE_KEY = 'khe.language.preference.v1';
const DEVICE_ONLY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type LanguageOption = {
  code: AppLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
  colors: [string, string, string];
  foreground: string;
};

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'fr', label: 'Français', nativeLabel: 'Français', flag: '🇫🇷', colors: ['#1d3f91', '#ffffff', '#e33a3a'], foreground: '#111111' },
  { code: 'en', label: 'Anglais', nativeLabel: 'English', flag: '🇬🇧', colors: ['#17346f', '#ffffff', '#cf2435'], foreground: '#111111' },
  { code: 'de', label: 'Allemand', nativeLabel: 'Deutsch', flag: '🇩🇪', colors: ['#151515', '#d73535', '#e6bc36'], foreground: '#ffffff' },
  { code: 'it', label: 'Italien', nativeLabel: 'Italiano', flag: '🇮🇹', colors: ['#1f8b4c', '#ffffff', '#d93d49'], foreground: '#111111' },
  { code: 'es', label: 'Espagnol', nativeLabel: 'Español', flag: '🇪🇸', colors: ['#c62b39', '#f2c94c', '#c62b39'], foreground: '#111111' },
  { code: 'pt', label: 'Portugais', nativeLabel: 'Português', flag: '🇵🇹', colors: ['#197346', '#d8b342', '#c62b39'], foreground: '#ffffff' },
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
        <Text style={styles.title}>Mode d’emploi • 0.3.0</Text>
        <Text style={styles.intro}>Ce guide fait partie de l’application et évolue avec les fonctions importantes de KHE Booth.</Text>

        <GuideSection title="1. Activer une station" body="Choisissez CAPTURE ou SHARING, saisissez uniquement le code d’activation puis validez. L’Event ID est retrouvé automatiquement. Une station peut être désactivée depuis Menu sans effacer les médias locaux." />
        <GuideSection title="2. Station CAPTURE" body="Ouvrez la caméra puis choisissez PHOTO ou VIDÉO. Sélectionnez le format 9:16 ou 1:1. En vidéo, choisissez aussi la durée maximum. Le décompte de 5 secondes précède la prise. Les médias sont conservés localement avant synchronisation." />
        <GuideSection title="3. Station SHARING" body="Appuyez sur « Connectez-vous à la station CAPTURE ». Le point vert « Connecté » signifie qu’une présence CAPTURE récente est réellement détectée ; le point rouge « Déconnecté » indique qu’elle n’est pas joignable. L’étoile filante signale une connexion en cours. Une fois connectée, SHARING peut piloter les commandes autorisées et suivre le minuteur." />
        <GuideSection title="4. Galerie interactive" body="La galerie regroupe photos et vidéos. Les aperçus vidéo bougent silencieusement dans « Tous les moments ». Utilisez Tous, Vidéos ou Photos pour filtrer, ouvrez un média pour le visualiser et vérifiez son état de synchronisation avant suppression." />
        <GuideSection title="5. Photos et impression" body="En mode PHOTO, KHE conserve un JPEG local après le décompte. Ouvrez Galerie ou Menu → Imprimer • Photos, sélectionnez une photo puis utilisez « Imprimer cette photo ». Android ouvre ensuite son interface d’impression afin de choisir une imprimante compatible et ses réglages." />
        <GuideSection title="6. Studio créatif" body="Menu → Design • Studio créatif permet de préparer un modèle, des textes, un cadre, un effet couleur, une vitesse et des effets vidéo. Jusqu’à trois musiques peuvent être importées. En mode musique, KHE sélectionne automatiquement une piste selon la rotation configurée. Le fichier source reste conservé séparément du futur rendu final." />
        <GuideSection title="7. Audio" body="Le Studio permet de choisir Micro ou Musique. Le rendu final doit utiliser l’un ou l’autre afin d’éviter de superposer automatiquement le son micro et la musique. Les fichiers musicaux importés restent sous la responsabilité de l’utilisateur, notamment pour les droits d’utilisation." />
        <GuideSection title="8. Profil" body="Menu → Profil permet d’ajouter facultativement une photo de profil, un nom affiché, une entreprise, un rôle, des coordonnées et une présentation. Ces informations sont modifiables et ne sont pas nécessaires pour utiliser CAPTURE ou SHARING." />
        <GuideSection title="9. Offline-first" body="Une coupure Internet ne doit pas supprimer les prises locales. Évitez de désinstaller l’application, vider ses données ou supprimer un média non synchronisé tant que vous n’avez pas vérifié sa sauvegarde. La synchronisation peut reprendre après le retour du réseau." />
        <GuideSection title="10. Veille et sécurité" body="L’anti-veille et le verrouillage KHE sont des options de confort et de sécurité. Ils peuvent être ignorés. Si vous activez la veille sécurisée, configurez un mot de passe de secours et utilisez la biométrie ou la sécurité Android compatible si vous le souhaitez." />
        <GuideSection title="11. Langues et région" body="KHE propose une langue à partir de la langue/région de la tablette sans GPS obligatoire. Vous restez libre de la modifier depuis le menu. Une localisation précise ne doit jamais être nécessaire pour prendre des photos ou vidéos." />
        <GuideSection title="12. Réseau et données mobiles" body="Le Wi-Fi peut être privilégié pour les transferts lourds. Lorsque l’utilisation des données mobiles nécessite une confirmation, KHE doit demander l’accord avant le téléchargement ou l’envoi concerné. Refuser ne doit pas supprimer les médias locaux." />
        <GuideSection title="13. Mises à jour" body="Consultez Menu → Version. Lorsqu’une nouvelle version modifie les fonctions ou les conditions d’utilisation, KHE peut demander une nouvelle lecture et acceptation avant de continuer. Le numéro de version affiché doit correspondre à la version réellement installée." />
      </ScrollView>
    </View>
  );
}

function GuideSection({ title, body }: { title: string; body: string }) {
  return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{body}</Text></View>;
}

function FlagCard({ language, selected, onPress }: { language: LanguageOption; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.languageButton, selected && styles.languageButtonActive]}>
      <View style={styles.flagBand}>
        {language.colors.map((color, index) => <View key={`${language.code}-${index}`} style={[styles.flagStripe, { backgroundColor: color }]} />)}
      </View>
      <View style={styles.languageCopy}>
        <Text style={styles.flagEmoji}>{language.flag}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.languageText}>{language.nativeLabel}</Text>
          <Text style={styles.languageSmall}>{language.label}</Text>
        </View>
        {selected ? <View style={styles.selectedBadge}><Text style={styles.selectedBadgeText}>✓</Text></View> : null}
      </View>
    </Pressable>
  );
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
          <View style={{ flex: 1 }}><Text style={styles.brand}>{t(selected, 'languageTitle')}</Text><Text style={styles.slogan}>{t(selected, 'languageSubtitle')}</Text></View>
          <Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>{t(selected, 'close')}</Text></Pressable>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t(selected, 'detectedRegion')}</Text>
          <Text style={styles.infoValue}>{device.locale}{device.region ? ` • ${device.region}` : ''}</Text>
          <Text style={styles.body}>{t(selected, 'suggestedLanguage')} : {languageLabel(device.suggestedLanguage)}. {t(selected, 'noGps')}</Text>
        </View>
        <View style={styles.languageGrid}>
          {SUPPORTED_LANGUAGES.map((language) => <FlagCard key={language.code} language={language} selected={selected === language.code} onPress={() => void choose(language.code)} />)}
        </View>
        {saved ? <Text style={styles.saved}>{t(selected, 'languageSaved')}</Text> : null}
        <Text style={styles.privacy}>{t(selected, 'preciseOptional')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' },
  scroll: { padding: 22, paddingBottom: 60, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { color: '#d2ad4f', fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  slogan: { color: '#c8c8c8', marginTop: 4, fontWeight: '700' },
  close: { borderWidth: 1, borderColor: '#d2ad4f', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  closeText: { color: '#ffffff', fontWeight: '900' },
  title: { color: '#ffffff', fontSize: 32, fontWeight: '900' },
  intro: { color: '#bdbdbd', lineHeight: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, gap: 7 },
  cardTitle: { color: '#111111', fontSize: 17, fontWeight: '900' },
  body: { color: '#555555', lineHeight: 19, fontSize: 13 },
  infoCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, gap: 5, borderWidth: 1, borderColor: '#d2ad4f' },
  infoLabel: { color: '#777777', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  infoValue: { color: '#111111', fontSize: 22, fontWeight: '900' },
  languageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  languageButton: { width: '48%', minWidth: 145, borderWidth: 2, borderColor: '#343434', borderRadius: 18, backgroundColor: '#18181b', overflow: 'hidden' },
  languageButtonActive: { borderColor: '#d2ad4f', backgroundColor: '#241f15' },
  flagBand: { height: 9, flexDirection: 'row' },
  flagStripe: { flex: 1 },
  languageCopy: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  flagEmoji: { fontSize: 25 },
  languageText: { color: '#ffffff', fontWeight: '900', fontSize: 16 },
  languageSmall: { color: '#a8a8a8', fontSize: 11, marginTop: 3 },
  selectedBadge: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#d2ad4f', alignItems: 'center', justifyContent: 'center' },
  selectedBadgeText: { color: '#111111', fontWeight: '900' },
  saved: { color: '#b9efbd', fontWeight: '800', lineHeight: 19 },
  privacy: { color: '#aaaaaa', fontSize: 11, lineHeight: 17 },
});
