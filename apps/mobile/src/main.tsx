import type { AspectRatio, StationMode } from '@khe/contracts';
import { registerRootComponent } from 'expo';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { HttpStationApi } from './api/station-api';
import { CameraCapture } from './capture/camera-capture';
import { API_BASE_URL } from './config';
import { LanguageAndRegion, UserGuide, getDeviceLocaleInfo, languageLabel, loadLanguagePreference, type AppLanguage } from './experience/user-guide-and-language';
import { MediaGallery } from './gallery/media-gallery';
import { APP_VERSION, AboutAndTerms, TermsGate, fetchReleaseInfo, type ReleaseInfo } from './legal/legal-and-info';
import { SQLiteLocalStore } from './offline/sqlite-store';
import type { LocalMediaRecord, PersistedStationContext } from './offline/types';
import { UserProfile } from './profile/user-profile';
import { SecureStoreCredentialVault } from './security/secure-store-vault';
import { StandbyScreen } from './security/standby-screen';
import { SettingsScreen } from './settings/app-settings';
import { RemoteControlPanel } from './sharing/remote-control-panel';
import { StationBootstrapService } from './station/station-bootstrap';
import { CreativeStudio } from './studio/creative-studio';
import { useCaptureSync } from './sync/capture-sync-runner';

const EVENT_KEEP_AWAKE_TAG = 'khe-booth-event';

function makeInstallationId(): string {
  return `khe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function refreshErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  if (/fetch failed|network request failed|unknownhost|unable to resolve host|timed?\s*out/i.test(detail)) return `Réseau indisponible : le cache local reste conservé. ${detail}`.trim();
  if (/NativeDatabase|prepareAsync|SQLite|NullPointerException|database/i.test(detail)) return `Stockage local indisponible : le cache existant reste conservé. ${detail}`.trim();
  return `Actualisation impossible : le cache local reste conservé. ${detail}`.trim();
}

function App() {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const store = useMemo(() => new SQLiteLocalStore(), []);
  const vault = useMemo(() => new SecureStoreCredentialVault(), []);
  const api = useMemo(() => new HttpStationApi(API_BASE_URL), []);
  const bootstrap = useMemo(() => new StationBootstrapService(api, store, vault), [api, store, vault]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [station, setStation] = useState<PersistedStationContext | null>(null);
  const [stationToken, setStationToken] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<StationMode>('CAPTURE');
  const [message, setMessage] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(getDeviceLocaleInfo().suggestedLanguage);
  const [release, setRelease] = useState<ReleaseInfo>({ latestVersion: APP_VERSION, updateAvailable: false });
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(true);
  const [standbyLocked, setStandbyLocked] = useState(false);
  const [lockConfigured, setLockConfigured] = useState(false);
  const [newLockPassword, setNewLockPassword] = useState('');
  const [confirmLockPassword, setConfirmLockPassword] = useState('');
  const [showLockPassword, setShowLockPassword] = useState(false);
  const [securityOptionsHidden, setSecurityOptionsHidden] = useState(false);

  useCaptureSync(api, store, vault, station?.mode === 'CAPTURE' && Boolean(stationToken));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await store.init();
        const cached = await bootstrap.getCachedContext();
        const cachedToken = await vault.getStationToken();
        const savedPassword = await vault.getEventLockPassword();
        const savedStandbyLocked = await vault.getStandbyLocked();
        const savedLanguage = await loadLanguagePreference();
        if (cached && !(await vault.getInstallationId())) await vault.saveInstallationId(cached.installationId);
        if (cancelled) return;
        setStation(cached);
        setStationToken(cachedToken);
        setLockConfigured(Boolean(savedPassword));
        setStandbyLocked(Boolean(cached && savedPassword && savedStandbyLocked));
        setKeepAwakeEnabled(!(cached && savedPassword && savedStandbyLocked));
        if (savedLanguage) setAppLanguage(savedLanguage);
        if (cached) {
          const manifest = await store.getManifest(cached.session.eventId);
          if (!cancelled) setEventName(manifest?.event.name ?? null);
        }
        const releaseInfo = await fetchReleaseInfo();
        if (!cancelled) setRelease(releaseInfo);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : 'Impossible d’ouvrir le stockage local.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [bootstrap, store, vault]);

  useEffect(() => {
    if (!station || !keepAwakeEnabled) {
      void deactivateKeepAwake(EVENT_KEEP_AWAKE_TAG).catch(() => undefined);
      return;
    }
    void activateKeepAwakeAsync(EVENT_KEEP_AWAKE_TAG).catch(() => setMessage('Impossible d’empêcher automatiquement la mise en veille sur cette tablette.'));
    return () => { void deactivateKeepAwake(EVENT_KEEP_AWAKE_TAG).catch(() => undefined); };
  }, [keepAwakeEnabled, station]);

  async function activate(): Promise<void> {
    setBusy(true); setMessage('');
    try {
      let installationId = await vault.getInstallationId();
      if (!installationId) { installationId = makeInstallationId(); await vault.saveInstallationId(installationId); }
      const response = await bootstrap.redeem({ code: code.trim().toUpperCase(), installationId, mode, platform: 'react-native', deviceName: mode === 'CAPTURE' ? 'KHE Booth Capture' : 'KHE Booth Sharing' });
      const cached = await bootstrap.getCachedContext();
      setStation(cached); setStationToken(response.stationToken); setEventName(response.manifest.event.name);
      setKeepAwakeEnabled(true); setStandbyLocked(false); setCode(''); setSecurityOptionsHidden(false);
      await vault.saveStandbyLocked(false);
      setMessage(`Station activée pour « ${response.manifest.event.name} ». L’événement a été identifié automatiquement.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Activation impossible.'); }
    finally { setBusy(false); }
  }

  async function refreshManifest(): Promise<void> {
    setBusy(true); setMessage('');
    try {
      await bootstrap.refreshManifest();
      if (station) {
        const manifest = await store.getManifest(station.session.eventId);
        setEventName(manifest?.event.name ?? null);
      }
      setMessage('Manifest actualisé et remis en cache.');
    } catch (error) { setMessage(refreshErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function deactivateStation(): Promise<void> {
    setBusy(true);
    try {
      setCameraOpen(false); setGalleryOpen(false); setMenuOpen(false); setAboutOpen(false); setGuideOpen(false); setLanguageOpen(false); setSettingsOpen(false); setStudioOpen(false); setProfileOpen(false);
      await vault.clearStationToken();
      await vault.saveStandbyLocked(false);
      await store.clearStation();
      setStation(null); setStationToken(null); setEventName(null); setStandbyLocked(false); setKeepAwakeEnabled(false);
      setMessage('Station désactivée sur cette tablette. Les médias locaux ont été conservés. Entrez un code d’activation pour ouvrir une nouvelle session.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de fermer la station.'); }
    finally { setBusy(false); }
  }

  function confirmDeactivate(): void {
    Alert.alert('Désactiver cette station ?', 'Le token et la session active seront retirés de cette tablette. Les médias locaux ne seront pas supprimés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Désactiver', style: 'destructive', onPress: () => void deactivateStation() },
    ]);
  }

  async function saveLockPassword(): Promise<void> {
    if (station?.mode !== 'SHARING') return;
    const password = newLockPassword.trim();
    if (password.length < 4) { setMessage('Le mot de passe KHE doit contenir au minimum 4 caractères.'); return; }
    if (password !== confirmLockPassword.trim()) { setMessage('Les deux saisies du mot de passe KHE ne correspondent pas.'); return; }
    await vault.saveEventLockPassword(password);
    setLockConfigured(true); setNewLockPassword(''); setConfirmLockPassword('');
    setMessage('Mot de passe de veille KHE enregistré. Cette option reste facultative et peut être ignorée.');
  }

  async function allowSecureStandby(): Promise<void> {
    if (station?.mode !== 'SHARING') { setMessage('La veille sécurisée est administrée depuis la régie SHARING.'); return; }
    if (!(await vault.getEventLockPassword())) { setLockConfigured(false); setSecurityOptionsHidden(false); setMessage('Si vous souhaitez utiliser la veille sécurisée, définissez d’abord un mot de passe KHE. Vous pouvez aussi ignorer cette option.'); return; }
    setKeepAwakeEnabled(false); setStandbyLocked(true); await vault.saveStandbyLocked(true);
  }

  async function unlockStandby(): Promise<void> {
    await vault.saveStandbyLocked(false); setStandbyLocked(false); setKeepAwakeEnabled(true);
    setMessage('Régie KHE déverrouillée. Écran toujours actif rétabli.');
  }

  async function verifyLockPassword(password: string): Promise<boolean> {
    const expected = await vault.getEventLockPassword();
    return Boolean(expected && expected === password);
  }

  function handleCaptured(media: LocalMediaRecord, format: AspectRatio): void {
    setMessage(`Capture ${format} conservée localement (${Math.max(1, Math.round(media.byteSize / 1024 / 1024))} Mo) et placée en attente de synchronisation.`);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Initialisation du stockage offline…</Text></SafeAreaView>;
  if (station && standbyLocked) return <StandbyScreen verifyPassword={verifyLockPassword} onUnlocked={unlockStandby} />;
  if (aboutOpen) return <AboutAndTerms onClose={() => setAboutOpen(false)} />;
  if (guideOpen) return <UserGuide onClose={() => setGuideOpen(false)} />;
  if (languageOpen) return <LanguageAndRegion onClose={() => setLanguageOpen(false)} onChanged={setAppLanguage} />;
  if (settingsOpen) return <SettingsScreen onClose={() => setSettingsOpen(false)} />;
  if (studioOpen) return <CreativeStudio onClose={() => setStudioOpen(false)} />;
  if (profileOpen) return <UserProfile onClose={() => setProfileOpen(false)} />;
  if (cameraOpen && station?.mode === 'CAPTURE' && stationToken) return <CameraCapture eventId={station.session.eventId} store={store} api={api} stationToken={stationToken} onClose={() => setCameraOpen(false)} onCaptured={handleCaptured} />;
  if (galleryOpen && station?.mode === 'CAPTURE') return <MediaGallery eventId={station.session.eventId} eventName={eventName ?? station.session.eventId} store={store} onClose={() => setGalleryOpen(false)} />;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView style={styles.pageScroll} contentContainerStyle={[styles.pageContent, landscape && styles.pageContentLandscape]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
        <View style={[styles.card, landscape && styles.cardLandscape]}>
          {station ? (
            <View style={styles.menuAnchor}>
              <Pressable style={styles.menuButton} onPress={() => setMenuOpen((current) => !current)}><Text style={styles.menuButtonText}>☰</Text><Text style={styles.menuButtonLabel}>Menu</Text>{release.updateAvailable ? <View style={styles.updateDot} /> : null}</Pressable>
              {menuOpen ? (
                <View style={styles.menuPanel}>
                  <Text style={styles.menuBrand}>KHE BOOTH</Text><Text style={styles.menuSession}>{station.mode} • {eventName ?? 'Événement'}</Text>
                  <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setProfileOpen(true); }}><Text style={styles.menuItemText}>👤 Profil</Text></Pressable>
                  {station.mode === 'CAPTURE' ? <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setGalleryOpen(true); }}><Text style={styles.menuItemText}>🖨 Imprimer • Photos</Text></Pressable> : null}
                  <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setSettingsOpen(true); }}><Text style={styles.menuItemText}>⚙ Paramètres</Text></Pressable>
                  <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setStudioOpen(true); }}><Text style={styles.menuItemText}>✦ Design • Studio créatif</Text></Pressable>
                  <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setGuideOpen(true); }}><Text style={styles.menuItemText}>Mode d’emploi</Text></Pressable>
                  <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setLanguageOpen(true); }}><Text style={styles.menuItemText}>Langues • {languageLabel(appLanguage)}</Text></Pressable>
                  <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setAboutOpen(true); }}><Text style={styles.menuItemText}>Conditions d’utilisation</Text></Pressable>
                  <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setAboutOpen(true); }}><Text style={styles.menuItemText}>Version {APP_VERSION}{release.updateAvailable ? ` • Mise à jour ${release.latestVersion}` : ' • À jour'}</Text></Pressable>
                  {station.mode === 'SHARING' && securityOptionsHidden ? <Pressable style={styles.menuItem} onPress={() => { setSecurityOptionsHidden(false); setMenuOpen(false); }}><Text style={styles.menuItemText}>Afficher veille & sécurité</Text></Pressable> : null}
                  <Pressable style={styles.menuItemDanger} onPress={confirmDeactivate}><Text style={styles.menuItemDangerText}>Désactiver / fermer la session</Text></Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.brand}>KHE BOOTH</Text><Text style={styles.title}>Station événement</Text><Text style={styles.muted}>Offline-first • Capture et Sharing séparés</Text>
          {release.updateAvailable ? <View style={styles.updateBanner}><Text style={styles.updateBannerText}>Mise à jour KHE Booth {release.latestVersion} disponible. Ouvrez Menu → Version.</Text></View> : null}

          {station ? (
            <View style={styles.section}>
              {!securityOptionsHidden ? <View style={styles.awakeCard}><View style={styles.awakeCopy}><Text style={styles.awakeTitle}>ÉTAT DE VEILLE • FACULTATIF</Text><Text style={styles.awakeStatus}>{keepAwakeEnabled ? 'Écran toujours actif' : 'Veille autorisée'}</Text><Text style={styles.awakeHelp}>{station.mode === 'SHARING' ? 'Vous pouvez utiliser la veille sécurisée ou ignorer entièrement cette configuration.' : 'La station CAPTURE reste éveillée pendant l’événement.'}</Text></View>{station.mode === 'SHARING' ? <Pressable onPress={() => void allowSecureStandby()} style={[styles.awakeButton, styles.awakeButtonActive]}><Text style={styles.awakeButtonTextActive}>AUTORISER VEILLE SÉCURISÉE</Text></Pressable> : null}{station.mode === 'SHARING' ? <Pressable style={styles.skipButton} onPress={() => setSecurityOptionsHidden(true)}><Text style={styles.skipButtonText}>Ignorer ces options pour l’instant</Text></Pressable> : null}</View> : null}

              {station.mode === 'SHARING' && !securityOptionsHidden ? <View style={styles.securityCard}><Text style={styles.awakeTitle}>SÉCURITÉ DE LA RÉGIE • FACULTATIF</Text><Text style={styles.securityTitle}>{lockConfigured ? 'Mot de passe KHE configuré' : 'Créer un mot de passe KHE'}</Text><Text style={styles.awakeHelp}>{lockConfigured ? 'Vous pouvez le remplacer ou ignorer cette section.' : 'Le mot de passe n’est nécessaire que si vous souhaitez utiliser la veille sécurisée KHE.'}</Text><TextInput value={newLockPassword} onChangeText={setNewLockPassword} secureTextEntry={!showLockPassword} autoCapitalize="none" autoCorrect={false} placeholder={lockConfigured ? 'Nouveau mot de passe' : 'Mot de passe KHE'} style={styles.input} /><TextInput value={confirmLockPassword} onChangeText={setConfirmLockPassword} secureTextEntry={!showLockPassword} autoCapitalize="none" autoCorrect={false} placeholder="Confirmer le mot de passe" style={styles.input} /><Pressable style={styles.visibilityButton} onPress={() => setShowLockPassword((current) => !current)}><Text style={styles.visibilityText}>{showLockPassword ? '🙈 Masquer les mots de passe' : '👁 Afficher les mots de passe'}</Text></Pressable><Pressable disabled={!newLockPassword || !confirmLockPassword} onPress={() => void saveLockPassword()} style={styles.securityButton}><Text style={styles.securityButtonText}>{lockConfigured ? 'MODIFIER LE MOT DE PASSE' : 'ENREGISTRER LE MOT DE PASSE'}</Text></Pressable><Pressable style={styles.skipButton} onPress={() => setSecurityOptionsHidden(true)}><Text style={styles.skipButtonText}>Passer cette configuration</Text></Pressable></View> : null}

              {station.mode === 'SHARING' && stationToken ? <RemoteControlPanel eventName={eventName ?? 'Événement KHE Booth'} api={api} stationToken={stationToken} /> : <><Text style={styles.label}>Station active</Text><Text style={styles.value}>{station.mode}</Text><Text style={styles.label}>Événement</Text><Text style={styles.value}>{eventName ?? station.session.eventId}</Text><Text style={styles.label}>Session</Text><Text style={styles.small}>{station.session.id}</Text><Pressable disabled={busy} style={styles.primaryButton} onPress={() => void refreshManifest()}><Text style={styles.primaryButtonText}>{busy ? 'Synchronisation…' : 'Actualiser le manifest'}</Text></Pressable><View style={styles.captureActions}><Pressable disabled={busy || !stationToken} style={styles.captureButton} onPress={() => setCameraOpen(true)}><Text style={styles.captureButtonText}>Ouvrir la caméra</Text></Pressable><Pressable disabled={busy} style={styles.galleryButton} onPress={() => setGalleryOpen(true)}><Text style={styles.galleryButtonText}>Galerie</Text></Pressable></View><Text style={styles.notice}>Le Studio créatif du menu définit les textes, cadres, effets et la musique destinés au rendu des prochaines prises.</Text></>}
            </View>
          ) : <View style={styles.section}><Text style={styles.label}>Mode de la tablette</Text><View style={styles.modeRow}>{(['CAPTURE', 'SHARING'] as const).map((candidate) => <Pressable key={candidate} onPress={() => setMode(candidate)} style={[styles.modeButton, mode === candidate && styles.modeButtonActive]}><Text style={mode === candidate ? styles.modeTextActive : styles.modeText}>{candidate}</Text></Pressable>)}</View><Text style={styles.label}>Code d’activation</Text><TextInput autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} placeholder="KHE-123456" style={styles.input} /><Text style={styles.activationHelp}>Aucun Event ID à saisir : KHE Booth retrouve automatiquement l’événement lié à ce code.</Text><Pressable disabled={busy || !code.trim()} style={styles.primaryButton} onPress={() => void activate()}><Text style={styles.primaryButtonText}>{busy ? 'Activation…' : 'Activer cette station'}</Text></Pressable><Pressable style={styles.termsLink} onPress={() => setAboutOpen(true)}><Text style={styles.termsLinkText}>Conditions d’utilisation • Version {APP_VERSION}</Text></Pressable></View>}
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Root() { return <TermsGate><App /></TermsGate>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' }, pageScroll: { flex: 1 }, pageContent: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingBottom: 44 }, pageContentLandscape: { justifyContent: 'flex-start', paddingVertical: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  card: { width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 22, gap: 8 }, cardLandscape: { maxWidth: 980 }, brand: { fontSize: 13, letterSpacing: 3, fontWeight: '800', paddingTop: 4 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '800' }, muted: { opacity: 0.6, lineHeight: 18 }, section: { marginTop: 18, gap: 10 }, label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', opacity: 0.55 }, value: { fontSize: 18, fontWeight: '700' }, small: { fontSize: 12, opacity: 0.65 },
  modeRow: { flexDirection: 'row', gap: 10 }, modeButton: { flex: 1, borderWidth: 1, borderColor: '#c9c9c9', borderRadius: 12, padding: 12, alignItems: 'center' }, modeButtonActive: { backgroundColor: '#111', borderColor: '#111' }, modeText: { fontWeight: '700' }, modeTextActive: { color: '#fff', fontWeight: '700' }, input: { borderWidth: 1, borderColor: '#d6d6d6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff' }, activationHelp: { fontSize: 12, lineHeight: 17, opacity: 0.6 }, primaryButton: { marginTop: 8, backgroundColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center' }, primaryButtonText: { color: '#fff', fontWeight: '800' },
  awakeCard: { borderWidth: 1, borderColor: '#d5d5d5', borderRadius: 16, padding: 14, gap: 10 }, awakeCopy: { gap: 3 }, awakeTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, opacity: 0.55 }, awakeStatus: { fontSize: 17, fontWeight: '900' }, awakeHelp: { fontSize: 11, lineHeight: 16, opacity: 0.62 }, awakeButton: { borderWidth: 1, borderColor: '#111', borderRadius: 11, paddingVertical: 11, alignItems: 'center' }, awakeButtonActive: { backgroundColor: '#111' }, awakeButtonTextActive: { color: '#fff', fontWeight: '900', fontSize: 11 },
  securityCard: { borderWidth: 1, borderColor: '#d5d5d5', borderRadius: 16, padding: 14, gap: 9 }, securityTitle: { fontSize: 16, fontWeight: '900' }, securityButton: { backgroundColor: '#ededed', borderRadius: 11, paddingVertical: 12, alignItems: 'center' }, securityButtonText: { fontWeight: '900', fontSize: 11 }, visibilityButton: { borderWidth: 1, borderColor: '#d6d6d6', borderRadius: 10, padding: 10, alignItems: 'center' }, visibilityText: { fontWeight: '800', fontSize: 11 }, skipButton: { paddingVertical: 9, alignItems: 'center' }, skipButtonText: { fontSize: 11, fontWeight: '800', textDecorationLine: 'underline', opacity: 0.65 },
  captureActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, captureButton: { flexGrow: 1, minWidth: 160, borderWidth: 1, borderColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center' }, captureButtonText: { color: '#111', fontWeight: '800' }, galleryButton: { flexGrow: 1, minWidth: 140, backgroundColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center' }, galleryButtonText: { color: '#fff', fontWeight: '800' }, notice: { marginTop: 8, fontSize: 12, lineHeight: 18, opacity: 0.65 }, message: { marginTop: 14, fontSize: 13, lineHeight: 18 },
  menuAnchor: { alignSelf: 'flex-start', zIndex: 20, marginBottom: 8 }, menuButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }, menuButtonText: { color: '#fff', fontSize: 18, fontWeight: '900' }, menuButtonLabel: { color: '#fff', fontSize: 12, fontWeight: '900' }, updateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffd35c' }, menuPanel: { position: 'absolute', top: 48, left: 0, width: 300, backgroundColor: '#111', borderRadius: 16, padding: 12, gap: 5, elevation: 10 }, menuBrand: { color: '#fff', fontWeight: '900', letterSpacing: 2 }, menuSession: { color: '#aaa', fontSize: 11, marginBottom: 6 }, menuItem: { backgroundColor: '#222225', borderRadius: 10, padding: 12 }, menuItemText: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 17 }, menuItemDanger: { borderWidth: 1, borderColor: '#7d3d3d', borderRadius: 10, padding: 12, marginTop: 3 }, menuItemDangerText: { color: '#ffb6b6', fontSize: 12, fontWeight: '900' },
  updateBanner: { backgroundColor: '#fff1bd', borderRadius: 12, padding: 10, marginTop: 7 }, updateBannerText: { color: '#4a3900', fontSize: 11, lineHeight: 16, fontWeight: '800' }, termsLink: { alignItems: 'center', padding: 10 }, termsLinkText: { fontSize: 11, fontWeight: '700', textDecorationLine: 'underline', opacity: 0.65 },
});

registerRootComponent(Root);