import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../config';

export const APP_VERSION = '0.3.0';
export const LEGAL_CONTENT_REVISION = '2026-08-16.2';
const TERMS_ACCEPTED_KEY = 'khe.terms.accepted.revision.v2';
const PUBLIC_APP_CONFIG_URL = 'https://raw.githubusercontent.com/paokurtis-a11y/Khebooth/main/apps/mobile/app.json';
const EXPO_BUILDS_URL = 'https://expo.dev/accounts/kurtis-hypnotic-event/projects/kurtis-hypnotic-events/builds';

const EU_EEA_REGIONS = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']);

export interface ReleaseInfo {
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes?: string;
  installUrl?: string;
}

function deviceRegion(): string {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'fr-CH';
  const region = locale.replace('_', '-').split('-').find((part) => /^[A-Z]{2}$/.test(part));
  return region ?? 'GLOBAL';
}

function currentTermsRevision(): string {
  return `khe-terms-${LEGAL_CONTENT_REVISION}-${deviceRegion()}`;
}

function jurisdictionNotice(region: string): { title: string; body: string } {
  if (region === 'CH') {
    return {
      title: 'Avis régional — Suisse',
      body: 'Pour une utilisation en Suisse, l’utilisateur et l’organisateur doivent notamment tenir compte de la Loi fédérale sur la protection des données (LPD) et des autres règles applicables au droit à l’image, à la personnalité, aux contrats et aux événements. KHE ne remplace pas un conseil juridique adapté à votre activité.',
    };
  }
  if (EU_EEA_REGIONS.has(region)) {
    return {
      title: 'Avis régional — Union européenne / EEE',
      body: 'Pour une utilisation dans l’Union européenne ou l’EEE, l’utilisateur et l’organisateur doivent notamment tenir compte du RGPD et des règles nationales applicables au droit à l’image, aux communications électroniques, aux contrats et aux événements. KHE ne remplace pas un conseil juridique adapté à votre activité.',
    };
  }
  return {
    title: 'Avis régional — règles locales',
    body: 'Les règles applicables à la captation, au stockage, au partage et à l’impression de contenus varient selon le pays et le contexte. L’utilisateur doit vérifier les obligations locales et obtenir les autorisations nécessaires. KHE ne remplace pas un conseil juridique local.',
  };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((value) => Number.parseInt(value, 10) || 0);
  const pb = b.split('.').map((value) => Number.parseInt(value, 10) || 0);
  const length = Math.max(pa.length, pb.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (pa[index] ?? 0) - (pb[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function hasAcceptedCurrentTerms(): Promise<boolean> {
  return (await SecureStore.getItemAsync(TERMS_ACCEPTED_KEY)) === currentTermsRevision();
}

export async function acceptCurrentTerms(): Promise<void> {
  await SecureStore.setItemAsync(TERMS_ACCEPTED_KEY, currentTermsRevision(), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function fetchReleaseInfoFromGithub(): Promise<ReleaseInfo> {
  const response = await fetch(PUBLIC_APP_CONFIG_URL);
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
  const config = await response.json() as { expo?: { version?: string } };
  const latestVersion = config.expo?.version?.trim();
  if (!latestVersion) throw new Error('Version distante absente');
  return {
    latestVersion,
    updateAvailable: compareVersions(latestVersion, APP_VERSION) > 0,
    releaseNotes: compareVersions(latestVersion, APP_VERSION) > 0
      ? 'Une nouvelle version de KHE Booth est disponible. Consultez les builds Expo pour installer la dernière version validée.'
      : undefined,
    installUrl: EXPO_BUILDS_URL,
  };
}

export async function fetchReleaseInfo(): Promise<ReleaseInfo> {
  try {
    const response = await fetch(`${API_BASE_URL}/mobile/version?current=${encodeURIComponent(APP_VERSION)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as ReleaseInfo;
  } catch {
    try {
      return await fetchReleaseInfoFromGithub();
    } catch {
      return { latestVersion: APP_VERSION, updateAvailable: false, installUrl: EXPO_BUILDS_URL };
    }
  }
}

export function TermsContent() {
  const region = useMemo(() => deviceRegion(), []);
  const regional = useMemo(() => jurisdictionNotice(region), [region]);
  return (
    <View style={styles.termsBody}>
      <Text style={styles.heading}>Conditions générales d’utilisation — KHE Booth</Text>
      <Text style={styles.revision}>Version de l’application : {APP_VERSION} • Révision juridique : {LEGAL_CONTENT_REVISION} • Région : {region}</Text>

      <View style={styles.regionCard}>
        <Text style={styles.regionTitle}>{regional.title}</Text>
        <Text style={styles.regionBody}>{regional.body}</Text>
      </View>

      <Text style={styles.subheading}>1. Objet</Text>
      <Text style={styles.paragraph}>KHE Booth est une application destinée à la capture, la gestion, la synchronisation, la visualisation, l’impression et le partage de contenus photo/vidéo lors d’événements. Certaines fonctions peuvent fonctionner hors ligne et synchroniser les contenus ultérieurement.</Text>

      <Text style={styles.subheading}>2. Utilisation autorisée et responsabilité de l’utilisateur</Text>
      <Text style={styles.paragraph}>L’utilisateur est responsable de la manière dont il configure et utilise l’application, du matériel employé, des personnes filmées ou photographiées, des contenus enregistrés et des destinations de partage ou d’impression. Il doit respecter les règles applicables en matière de droit à l’image, de vie privée, de protection des données, de propriété intellectuelle, de sécurité et d’accès aux réseaux.</Text>

      <Text style={styles.subheading}>3. Consentement des personnes filmées ou photographiées</Text>
      <Text style={styles.paragraph}>Avant toute captation, impression ou diffusion, l’organisateur ou l’utilisateur doit obtenir les autorisations nécessaires des personnes concernées lorsque la loi, le règlement du lieu ou le contexte de l’événement l’exige. KHE ne collecte pas ce consentement à la place de l’utilisateur.</Text>

      <Text style={styles.subheading}>4. Contenus et usages interdits</Text>
      <Text style={styles.paragraph}>L’application ne doit pas être utilisée pour enregistrer, surveiller, imprimer, diffuser ou partager des contenus de manière illicite, trompeuse, abusive, intrusive ou contraire aux droits de tiers. Toute utilisation détournée reste sous la responsabilité de son auteur.</Text>

      <Text style={styles.subheading}>5. Données, stockage local et synchronisation</Text>
      <Text style={styles.paragraph}>Les contenus peuvent être conservés localement sur la tablette avant synchronisation. L’utilisateur doit vérifier l’espace disponible, l’état de synchronisation et ses sauvegardes avant de supprimer un média, réinitialiser une station ou modifier son environnement réseau.</Text>

      <Text style={styles.subheading}>6. Réseau, appareils et services tiers</Text>
      <Text style={styles.paragraph}>Certaines fonctions dépendent d’Android, du matériel, du réseau Internet, d’une imprimante ou de services tiers. Leur disponibilité, leurs performances et leurs limites peuvent varier. KHE ne peut pas garantir qu’un service externe ou un composant matériel sera disponible sans interruption.</Text>

      <Text style={styles.subheading}>7. Limitation de responsabilité</Text>
      <Text style={styles.paragraph}>Dans la mesure permise par la loi applicable, KHE n’est pas responsable d’une mauvaise utilisation de l’application par ses utilisateurs, d’une captation, impression ou diffusion non autorisée, d’une suppression volontaire de contenu, d’une configuration incorrecte, d’un appareil insuffisamment sécurisé ou d’un usage contraire aux présentes conditions. Cette clause ne limite pas les responsabilités qui ne peuvent légalement être exclues.</Text>

      <Text style={styles.subheading}>8. Sécurité et fonctions facultatives</Text>
      <Text style={styles.paragraph}>Les options d’anti-veille, mot de passe KHE, biométrie ou verrouillage système sont proposées comme fonctions de confort et de sécurité. Sauf nécessité particulière indiquée dans l’application, elles sont facultatives et leur refus ne doit pas empêcher la capture normale des médias.</Text>

      <Text style={styles.subheading}>9. Langue, région et localisation</Text>
      <Text style={styles.paragraph}>KHE peut proposer une langue et un avis juridique régional à partir des réglages de langue/région de la tablette. Toute localisation plus précise doit rester facultative et soumise à permission. L’utilisateur peut modifier sa langue dans le menu.</Text>

      <Text style={styles.subheading}>10. Mises à jour juridiques et fonctionnelles</Text>
      <Text style={styles.paragraph}>KHE peut faire évoluer l’application, le mode d’emploi et les présentes conditions. Lorsqu’une révision juridique, une nouvelle version ou un changement de région modifie la version applicable des conditions, l’application peut demander une nouvelle acceptation. Les textes régionaux disponibles doivent être maintenus à jour ; KHE ne garantit pas qu’un texte automatisé couvre toutes les obligations particulières d’un utilisateur professionnel.</Text>

      <Text style={styles.subheading}>11. Acceptation</Text>
      <Text style={styles.paragraph}>En appuyant sur « J’accepte », l’utilisateur confirme avoir lu et compris les conditions affichées pour la région détectée et accepter de les respecter.</Text>
    </View>
  );
}

export function TermsGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    void hasAcceptedCurrentTerms().then((value) => {
      setAccepted(value);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return <View style={styles.center}><ActivityIndicator /><Text>Vérification des conditions d’utilisation…</Text></View>;
  }

  if (!accepted) {
    return (
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.brand}>KHE</Text>
          <Text style={styles.slogan}>Votre événement, notre expertise !</Text>
          <TermsContent />
          <Pressable style={styles.acceptButton} onPress={() => void acceptCurrentTerms().then(() => setAccepted(true))}>
            <Text style={styles.acceptText}>J’ACCEPTE ET JE CONTINUE</Text>
          </Pressable>
          <Text style={styles.required}>L’acceptation de la version affichée des conditions est nécessaire pour utiliser KHE Booth.</Text>
        </ScrollView>
      </View>
    );
  }

  return <>{children}</>;
}

export function AboutAndTerms({ onClose }: { onClose: () => void }) {
  const [release, setRelease] = useState<ReleaseInfo>({ latestVersion: APP_VERSION, updateAvailable: false });
  useEffect(() => { void fetchReleaseInfo().then(setRelease); }, []);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}><Text style={styles.brand}>KHE BOOTH</Text><Text style={styles.slogan}>Votre événement, notre expertise !</Text></View>
          <Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>
        <View style={styles.versionCard}>
          <Text style={styles.versionTitle}>Version installée</Text>
          <Text style={styles.versionNumber}>{APP_VERSION}</Text>
          <Text style={styles.versionStatus}>{release.updateAvailable ? `Nouvelle version disponible : ${release.latestVersion}` : 'Application à jour'}</Text>
          <Text style={styles.releaseNotes}>Révision juridique intégrée : {LEGAL_CONTENT_REVISION}</Text>
          {release.releaseNotes ? <Text style={styles.releaseNotes}>{release.releaseNotes}</Text> : null}
        </View>
        <TermsContent />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' },
  scroll: { padding: 24, paddingBottom: 60, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  brand: { color: '#ffffff', fontSize: 28, fontWeight: '900', letterSpacing: 4 },
  slogan: { color: '#d6d6d6', fontSize: 16, fontWeight: '700', marginTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeButton: { borderWidth: 1, borderColor: '#555555', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  closeText: { color: '#ffffff', fontWeight: '800' },
  termsBody: { backgroundColor: '#ffffff', borderRadius: 22, padding: 22, gap: 9 },
  heading: { fontSize: 24, fontWeight: '900', color: '#111111' },
  revision: { fontSize: 11, lineHeight: 16, color: '#666666' },
  regionCard: { backgroundColor: '#f3f3f3', borderRadius: 14, padding: 14, gap: 5 },
  regionTitle: { fontSize: 13, fontWeight: '900', color: '#111111' },
  regionBody: { fontSize: 11, lineHeight: 17, color: '#555555' },
  subheading: { marginTop: 7, fontSize: 15, fontWeight: '900', color: '#111111' },
  paragraph: { fontSize: 13, lineHeight: 20, color: '#333333' },
  acceptButton: { backgroundColor: '#ffffff', borderRadius: 16, padding: 17, alignItems: 'center' },
  acceptText: { color: '#111111', fontWeight: '900' },
  required: { color: '#aaaaaa', textAlign: 'center', fontSize: 11 },
  versionCard: { backgroundColor: '#1c1c1f', borderRadius: 18, padding: 18, gap: 5 },
  versionTitle: { color: '#aaaaaa', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  versionNumber: { color: '#ffffff', fontSize: 28, fontWeight: '900' },
  versionStatus: { color: '#ffffff', fontWeight: '800' },
  releaseNotes: { color: '#c9c9c9', lineHeight: 18, marginTop: 4 },
});