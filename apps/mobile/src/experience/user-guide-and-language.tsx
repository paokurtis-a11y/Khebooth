import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, type AppLanguage } from './i18n';

export type { AppLanguage } from './i18n';

const LANGUAGE_KEY = 'khe.language.preference.v1';
const DEVICE_ONLY_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const SUPPORTED_LANGUAGES: Array<{ code: AppLanguage; label: string; nativeLabel: string; colors: string[]; darkText?: boolean }> = [
  { code: 'fr', label: 'Français', nativeLabel: 'Français', colors: ['#0055A4', '#FFFFFF', '#EF4135'] },
  { code: 'en', label: 'Anglais', nativeLabel: 'English', colors: ['#012169', '#FFFFFF', '#C8102E'] },
  { code: 'de', label: 'Allemand', nativeLabel: 'Deutsch', colors: ['#000000', '#DD0000', '#FFCE00'] },
  { code: 'it', label: 'Italien', nativeLabel: 'Italiano', colors: ['#009246', '#FFFFFF', '#CE2B37'] },
  { code: 'es', label: 'Espagnol', nativeLabel: 'Español', colors: ['#AA151B', '#F1BF00', '#AA151B'], darkText: true },
  { code: 'pt', label: 'Portugais', nativeLabel: 'Português', colors: ['#046A38', '#FFCD00', '#DA291C'] },
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

const GUIDE: Record<AppLanguage, Array<[string, string]>> = {
  fr: [
    ['1. Activer une station', 'Choisissez CAPTURE ou SHARING, saisissez uniquement le code d’activation puis validez. L’Event ID est retrouvé automatiquement.'],
    ['2. Station CAPTURE', 'Ouvrez la caméra, choisissez PHOTO ou VIDÉO puis le format. Les médias restent d’abord enregistrés localement avant synchronisation.'],
    ['3. Station SHARING', 'Connectez la régie à CAPTURE. Le statut de connexion et les médias synchronisés sont actualisés automatiquement.'],
    ['4. Galerie', 'La galerie regroupe photos et vidéos. Sélectionnez un moment pour le visualiser, le partager, l’imprimer ou le supprimer.'],
    ['5. Studio créatif', 'Préparez textes, cadres, effets, vitesse et musique. Vous pouvez choisir un extrait précis et son niveau sonore.'],
    ['6. Offline-first', 'Une coupure Internet ne supprime pas les prises locales. La synchronisation reprend lorsque le réseau revient.'],
    ['7. Langue et localisation', 'La langue choisie est appliquée immédiatement. La localisation précise reste toujours facultative.'],
  ],
  en: [
    ['1. Activate a station', 'Choose CAPTURE or SHARING, enter only the activation code and confirm. The Event ID is found automatically.'],
    ['2. CAPTURE station', 'Open the camera, choose PHOTO or VIDEO and the format. Media is first stored locally before synchronization.'],
    ['3. SHARING station', 'Connect the control station to CAPTURE. Connection status and synchronized media refresh automatically.'],
    ['4. Gallery', 'The gallery contains photos and videos. Select a moment to view, share, print or delete it.'],
    ['5. Creative Studio', 'Prepare text, frames, effects, speed and music. You can choose an exact audio segment and its volume.'],
    ['6. Offline-first', 'An Internet outage does not delete local captures. Synchronization resumes when the network returns.'],
    ['7. Language and location', 'The selected language is applied immediately. Precise location always remains optional.'],
  ],
  de: [
    ['1. Station aktivieren', 'Wählen Sie CAPTURE oder SHARING, geben Sie nur den Aktivierungscode ein und bestätigen Sie. Die Event-ID wird automatisch gefunden.'],
    ['2. CAPTURE-Station', 'Öffnen Sie die Kamera, wählen Sie FOTO oder VIDEO und das Format. Medien werden vor der Synchronisierung lokal gespeichert.'],
    ['3. SHARING-Station', 'Verbinden Sie die Regie mit CAPTURE. Verbindungsstatus und synchronisierte Medien werden automatisch aktualisiert.'],
    ['4. Galerie', 'Die Galerie enthält Fotos und Videos. Wählen Sie einen Moment zum Anzeigen, Teilen, Drucken oder Löschen.'],
    ['5. Kreativstudio', 'Bereiten Sie Texte, Rahmen, Effekte, Geschwindigkeit und Musik vor. Audiobereich und Lautstärke sind wählbar.'],
    ['6. Offline-first', 'Ein Internetausfall löscht keine lokalen Aufnahmen. Die Synchronisierung wird bei Rückkehr des Netzes fortgesetzt.'],
    ['7. Sprache und Standort', 'Die gewählte Sprache wird sofort angewendet. Der genaue Standort bleibt immer freiwillig.'],
  ],
  it: [
    ['1. Attivare una stazione', 'Scegli CAPTURE o SHARING, inserisci solo il codice di attivazione e conferma. L’Event ID viene trovato automaticamente.'],
    ['2. Stazione CAPTURE', 'Apri la fotocamera, scegli FOTO o VIDEO e il formato. I media vengono salvati localmente prima della sincronizzazione.'],
    ['3. Stazione SHARING', 'Collega la regia a CAPTURE. Stato della connessione e media sincronizzati si aggiornano automaticamente.'],
    ['4. Galleria', 'La galleria contiene foto e video. Seleziona un momento per visualizzarlo, condividerlo, stamparlo o eliminarlo.'],
    ['5. Studio creativo', 'Prepara testi, cornici, effetti, velocità e musica. Puoi scegliere un segmento audio preciso e il volume.'],
    ['6. Offline-first', 'Un’interruzione Internet non elimina le acquisizioni locali. La sincronizzazione riprende al ritorno della rete.'],
    ['7. Lingua e posizione', 'La lingua selezionata viene applicata subito. La posizione precisa resta sempre facoltativa.'],
  ],
  es: [
    ['1. Activar una estación', 'Elige CAPTURE o SHARING, introduce solo el código de activación y confirma. El Event ID se encuentra automáticamente.'],
    ['2. Estación CAPTURE', 'Abre la cámara, elige FOTO o VÍDEO y el formato. Los medios se guardan localmente antes de sincronizarse.'],
    ['3. Estación SHARING', 'Conecta la regie a CAPTURE. El estado y los medios sincronizados se actualizan automáticamente.'],
    ['4. Galería', 'La galería contiene fotos y vídeos. Selecciona un momento para verlo, compartirlo, imprimirlo o eliminarlo.'],
    ['5. Estudio creativo', 'Prepara textos, marcos, efectos, velocidad y música. Puedes elegir un fragmento de audio exacto y su volumen.'],
    ['6. Offline-first', 'Un corte de Internet no elimina las capturas locales. La sincronización continúa al volver la red.'],
    ['7. Idioma y ubicación', 'El idioma seleccionado se aplica inmediatamente. La ubicación precisa siempre es opcional.'],
  ],
  pt: [
    ['1. Ativar uma estação', 'Escolha CAPTURE ou SHARING, introduza apenas o código de ativação e confirme. O Event ID é encontrado automaticamente.'],
    ['2. Estação CAPTURE', 'Abra a câmara, escolha FOTO ou VÍDEO e o formato. Os media ficam guardados localmente antes da sincronização.'],
    ['3. Estação SHARING', 'Ligue a régie ao CAPTURE. O estado da ligação e os media sincronizados atualizam-se automaticamente.'],
    ['4. Galeria', 'A galeria contém fotos e vídeos. Selecione um momento para ver, partilhar, imprimir ou eliminar.'],
    ['5. Estúdio criativo', 'Prepare textos, molduras, efeitos, velocidade e música. Pode escolher um segmento de áudio exato e o volume.'],
    ['6. Offline-first', 'Uma falha de Internet não elimina as capturas locais. A sincronização retoma quando a rede regressa.'],
    ['7. Idioma e localização', 'O idioma selecionado é aplicado imediatamente. A localização precisa é sempre facultativa.'],
  ],
};

export function UserGuide({ onClose, language = 'fr' }: { onClose: () => void; language?: AppLanguage }) {
  return <View style={styles.page}><ScrollView contentContainerStyle={styles.scroll}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.brand}>KHE BOOTH</Text><Text style={styles.slogan}>Kurtis Hypnotic Events</Text></View><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>{t(language, 'close')}</Text></Pressable></View><Text style={styles.title}>{t(language, 'guide')} • 0.3.0</Text>{GUIDE[language].map(([title, body]) => <GuideSection key={title} title={title} body={body} />)}</ScrollView></View>;
}

function GuideSection({ title, body }: { title: string; body: string }) { return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{body}</Text></View>; }

function FlagButton({ language, selected, onPress }: { language: typeof SUPPORTED_LANGUAGES[number]; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.languageButton, selected && styles.languageButtonActive]}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>{language.colors.map((color, index) => <View key={`${language.code}-${color}-${index}`} style={{ flex: 1, backgroundColor: color }} />)}</View>
    <View style={styles.flagOverlay} />
    <Text style={[styles.languageText, language.darkText && styles.languageTextDark]}>{language.nativeLabel}</Text>
    <Text style={[styles.languageSmall, language.darkText && styles.languageTextDark]}>{language.label}</Text>
    {selected ? <View style={styles.selectedBadge}><Text style={styles.selectedBadgeText}>✓</Text></View> : null}
  </Pressable>;
}

export function LanguageAndRegion({ onClose, onChanged, language: currentLanguage }: { onClose: () => void; onChanged?: (language: AppLanguage) => void; language?: AppLanguage }) {
  const device = useMemo(() => getDeviceLocaleInfo(), []);
  const [selected, setSelected] = useState<AppLanguage>(currentLanguage ?? device.suggestedLanguage);
  const [saved, setSaved] = useState(false);
  useEffect(() => { void loadLanguagePreference().then((value) => { if (value) setSelected(value); }); }, []);
  async function choose(language: AppLanguage): Promise<void> { setSelected(language); await saveLanguagePreference(language); setSaved(true); onChanged?.(language); }
  return <View style={styles.page}><ScrollView contentContainerStyle={styles.scroll}><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.brand}>{t(selected, 'languageTitle')}</Text><Text style={styles.slogan}>{t(selected, 'languageSubtitle')}</Text></View><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>{t(selected, 'close')}</Text></Pressable></View><View style={styles.infoCard}><Text style={styles.infoLabel}>{t(selected, 'detectedRegion')}</Text><Text style={styles.infoValue}>{device.locale}{device.region ? ` • ${device.region}` : ''}</Text><Text style={styles.body}>{t(selected, 'suggestedLanguage')} : {languageLabel(device.suggestedLanguage)}. {t(selected, 'noGps')}</Text></View><View style={styles.languageGrid}>{SUPPORTED_LANGUAGES.map((language) => <FlagButton key={language.code} language={language} selected={selected === language.code} onPress={() => void choose(language.code)} />)}</View>{saved ? <Text style={styles.saved}>{t(selected, 'languageSaved')}</Text> : null}<Text style={styles.privacy}>{t(selected, 'preciseOptional')}</Text></ScrollView></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' }, scroll: { padding: 22, paddingBottom: 60, gap: 14 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, brand: { color: '#ffffff', fontSize: 24, fontWeight: '900', letterSpacing: 3 }, slogan: { color: '#c8c8c8', marginTop: 4, fontWeight: '700' }, close: { borderWidth: 1, borderColor: '#4d4d4d', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }, closeText: { color: '#ffffff', fontWeight: '900' }, title: { color: '#ffffff', fontSize: 32, fontWeight: '900' }, card: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, gap: 7 }, cardTitle: { color: '#111111', fontSize: 17, fontWeight: '900' }, body: { color: '#555555', lineHeight: 19, fontSize: 13 }, infoCard: { backgroundColor: '#ffffff', borderRadius: 18, padding: 18, gap: 5 }, infoLabel: { color: '#777777', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, infoValue: { color: '#111111', fontSize: 22, fontWeight: '900' }, languageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, languageButton: { width: '48%', minWidth: 140, minHeight: 92, borderRadius: 18, padding: 15, overflow: 'hidden', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' }, languageButtonActive: { borderColor: '#ffffff', transform: [{ scale: 1.02 }] }, flagOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.20)' }, languageText: { color: '#ffffff', fontWeight: '900', fontSize: 17, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } }, languageTextDark: { color: '#111111', textShadowColor: 'rgba(255,255,255,0.8)' }, languageSmall: { color: '#ffffff', fontSize: 11, marginTop: 3, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2 }, selectedBadge: { position: 'absolute', right: 8, top: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }, selectedBadgeText: { color: '#fff', fontWeight: '900' }, saved: { color: '#b9efbd', fontWeight: '800' }, privacy: { color: '#aaaaaa', fontSize: 11, lineHeight: 17 },
});