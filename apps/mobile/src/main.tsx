import type { AspectRatio, StationMode } from '@khe/contracts';
import { registerRootComponent } from 'expo';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { HttpStationApi } from './api/station-api';
import { CameraCapture } from './capture/camera-capture';
import { API_BASE_URL } from './config';
import { t } from './experience/i18n';
import { LanguageAndRegion, UserGuide, getDeviceLocaleInfo, languageLabel, loadLanguagePreference, type AppLanguage } from './experience/user-guide-and-language';
import { MediaGallery } from './gallery/media-gallery';
import { APP_VERSION, AboutAndTerms, TermsGate, fetchReleaseInfo, type ReleaseInfo } from './legal/legal-and-info';
import { StationNotificationCenter } from './notifications/station-notification-center';
import { SQLiteLocalStore } from './offline/sqlite-store';
import type { LocalMediaRecord, PersistedStationContext } from './offline/types';
import { UserProfile } from './profile/user-profile';
import { EventReadyScreen } from './readiness/event-ready-screen';
import { SecurePasswordField } from './security/secure-password-field';
import { SecureStoreCredentialVault } from './security/secure-store-vault';
import { StandbyScreen } from './security/standby-screen';
import { SettingsScreen } from './settings/app-settings';
import { SharingStationPanel } from './sharing/sharing-station-panel';
import { SharingErrorBoundary } from './sharing/sharing-error-boundary';
import { StationBootstrapService } from './station/station-bootstrap';
import { CreativeStudio } from './studio/creative-studio';
import { useCaptureSync } from './sync/capture-sync-runner';

const EVENT_KEEP_AWAKE_TAG = 'khe-booth-event';
const CREATIVE_PLAN_KEY='khe.creative.plan.v1';

type MenuSection='home'|'ready'|'profile'|'gallery'|'settings'|'studio'|'guide'|'language'|'terms'|'version';

function makeInstallationId(): string {
  return `khe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function kheEventNumber(eventId:string):string{return`KHE-EVT-${eventId.replace(/-/g,'').slice(0,8).toUpperCase()}`;}

function refreshErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  if (/fetch failed|network request failed|unknownhost|unable to resolve host|timed?\s*out/i.test(detail)) return `Réseau indisponible : le cache local reste conservé. ${detail}`.trim();
  if (/NativeDatabase|prepareAsync|SQLite|NullPointerException|database/i.test(detail)) return `Stockage local indisponible : le cache existant reste conservé. ${detail}`.trim();
  return `Actualisation impossible : le cache local reste conservé. ${detail}`.trim();
}

function BackPage({ onBack, children, language }: { onBack: () => void; children: ReactNode; language: AppLanguage }) {
  return (
    <SafeAreaView style={styles.backPage}>
      <View style={styles.backBar}>
        <Pressable style={styles.backButton} onPress={onBack}><Text style={styles.backText}>← {t(language,'back')}</Text></Pressable>
      </View>
      <View style={styles.backContent}>{children}</View>
    </SafeAreaView>
  );
}

function App() {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const store = useMemo(() => new SQLiteLocalStore(), []);
  const vault = useMemo(() => new SecureStoreCredentialVault(), []);
  const api = useMemo(() => new HttpStationApi(API_BASE_URL), []);
  const bootstrap = useMemo(() => new StationBootstrapService(api, store, vault), [api, store, vault]);
  const menuAnim=useRef(new Animated.Value(0)).current;

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
  const [activeMenu,setActiveMenu]=useState<MenuSection>('home');
  const [readyOpen,setReadyOpen]=useState(false);
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

  useEffect(()=>{
    if(!menuOpen){menuAnim.setValue(0);return;}
    menuAnim.setValue(0);
    Animated.spring(menuAnim,{toValue:1,useNativeDriver:true,tension:72,friction:9}).start();
  },[menuAnim,menuOpen]);

  useEffect(()=>{
    if(!station||!stationToken||cameraOpen)return;
    let cancelled=false;let running=false;
    const synchronize=async()=>{
      if(running)return;running=true;
      try{
        const workspace=await api.clientWorkspace(stationToken);
        if(!workspace.shouldSwitch||!workspace.selectedEvent)return;
        const response=await api.switchClientEvent(stationToken,workspace.selectedEvent.id);
        const persisted:PersistedStationContext={session:response.session,installationId:station.installationId,mode:station.mode,savedAt:new Date().toISOString()};
        await vault.saveStationToken(response.stationToken);
        await store.saveStation(persisted);
        await store.saveManifest(response.session.eventId,response.manifest);
        if(response.designConfig&&Object.keys(response.designConfig).length){await SecureStore.setItemAsync(CREATIVE_PLAN_KEY,JSON.stringify(response.designConfig),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
        if(cancelled)return;
        setStation(persisted);setStationToken(response.stationToken);setEventName(response.manifest.event.name);
        setMessage(`✓ Nouvel événement « ${response.manifest.event.name} » synchronisé automatiquement sur ${station.mode}.`);
      }catch{
        // Les stations sans client ou temporairement hors ligne conservent leur contexte local.
      }finally{running=false;}
    };
    void synchronize();const timer=setInterval(()=>void synchronize(),5000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[api,cameraOpen,station,stationToken,store,vault]);

  async function activate(): Promise<void> {
    setBusy(true); setMessage('');
    try {
      let installationId = await vault.getInstallationId();
      if (!installationId) { installationId = makeInstallationId(); await vault.saveInstallationId(installationId); }
      const response = await bootstrap.redeem({ code: code.trim().toUpperCase(), installationId, mode, platform: 'react-native', deviceName: mode === 'CAPTURE' ? 'KHE Booth Capture' : 'KHE Booth Sharing' });
      const cached = await bootstrap.getCachedContext();
      setStation(cached); setStationToken(response.stationToken); setEventName(response.manifest.event.name);
      setKeepAwakeEnabled(true); setStandbyLocked(false); setCode(''); setSecurityOptionsHidden(false);setActiveMenu('home');
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
      setCameraOpen(false); setGalleryOpen(false); setMenuOpen(false); setReadyOpen(false); setAboutOpen(false); setGuideOpen(false); setLanguageOpen(false); setSettingsOpen(false); setStudioOpen(false); setProfileOpen(false);setActiveMenu('home');
      await vault.clearStationToken();
      await vault.saveStandbyLocked(false);
      await store.clearStation();
      setStation(null); setStationToken(null); setEventName(null); setStandbyLocked(false); setKeepAwakeEnabled(false);
      setMessage('Station désactivée sur cette tablette. Les médias locaux ont été conservés. Entrez un code d’activation pour ouvrir une nouvelle session.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de fermer la station.'); }
    finally { setBusy(false); }
  }

  function confirmDeactivate(): void {
    Alert.alert(t(appLanguage,'deactivate'), 'Le token et la session active seront retirés de cette tablette. Les médias locaux ne seront pas supprimés.', [
      { text: appLanguage === 'en' ? 'Cancel' : 'Annuler', style: 'cancel' },
      { text: t(appLanguage,'deactivate'), style: 'destructive', onPress: () => void deactivateStation() },
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

  function enableEventScreen():void{
    setKeepAwakeEnabled(true);
    setStandbyLocked(false);
    void vault.saveStandbyLocked(false);
  }

  function openMenuSection(section:MenuSection,action:()=>void){setActiveMenu(section);setMenuOpen(false);action();}
  const returnToMenu=()=>setMenuOpen(true);
  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Initialisation du stockage offline…</Text></SafeAreaView>;
  if (station && standbyLocked) return <StandbyScreen verifyPassword={verifyLockPassword} onUnlocked={unlockStandby} />;
  if (readyOpen && station && stationToken) return <BackPage language={appLanguage} onBack={() => setReadyOpen(false)}><EventReadyScreen api={api} store={store} station={station} stationToken={stationToken} eventName={eventName ?? station.session.eventId} language={appLanguage} keepAwakeEnabled={keepAwakeEnabled} onEnableKeepAwake={enableEventScreen} onClose={() => {setReadyOpen(false);returnToMenu();}} /></BackPage>;
  if (aboutOpen) return <BackPage language={appLanguage} onBack={() => setAboutOpen(false)}><AboutAndTerms onClose={() => {setAboutOpen(false);returnToMenu();}} /></BackPage>;
  if (guideOpen) return <BackPage language={appLanguage} onBack={() => setGuideOpen(false)}><UserGuide onClose={() => {setGuideOpen(false);returnToMenu();}} /></BackPage>;
  if (languageOpen) return <BackPage language={appLanguage} onBack={() => setLanguageOpen(false)}><LanguageAndRegion onClose={() => {setLanguageOpen(false);returnToMenu();}} onChanged={setAppLanguage} /></BackPage>;
  if (settingsOpen) return <BackPage language={appLanguage} onBack={() => setSettingsOpen(false)}><SettingsScreen language={appLanguage} onClose={() => {setSettingsOpen(false);returnToMenu();}} /></BackPage>;
  if (studioOpen && station && stationToken) return <BackPage language={appLanguage} onBack={() => setStudioOpen(false)}><CreativeStudio api={api} stationToken={stationToken} eventId={station.session.eventId} onSaved={(plan)=>api.markClientEventDesignReady(stationToken,station.session.eventId,plan as unknown as Record<string,unknown>)} onClose={() => {setStudioOpen(false);returnToMenu();}} /></BackPage>;
  if (profileOpen) return <BackPage language={appLanguage} onBack={() => setProfileOpen(false)}><UserProfile onClose={() => {setProfileOpen(false);returnToMenu();}} /></BackPage>;
  if (cameraOpen && station?.mode === 'CAPTURE' && stationToken) return <BackPage language={appLanguage} onBack={() => setCameraOpen(false)}><CameraCapture eventId={station.session.eventId} store={store} api={api} stationToken={stationToken} onClose={() => setCameraOpen(false)} onCaptured={handleCaptured} /></BackPage>;
  if (galleryOpen && station?.mode === 'CAPTURE') return <BackPage language={appLanguage} onBack={() => setGalleryOpen(false)}><MediaGallery eventId={station.session.eventId} eventName={eventName ?? station.session.eventId} store={store} onClose={() => setGalleryOpen(false)} /></BackPage>;

  const menuItemStyle=(section:MenuSection)=>[styles.menuItem,activeMenu===section&&styles.menuItemActive];
  const menuTextStyle=(section:MenuSection)=>[styles.menuItemText,activeMenu===section&&styles.menuItemTextActive];

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView style={styles.pageScroll} contentContainerStyle={[styles.pageContent, landscape && styles.pageContentLandscape]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
        <View style={[styles.card, landscape && styles.cardLandscape]}>
          {station ? (
            <View style={styles.headerTools}>
              <View style={styles.menuAnchor}>
                <Pressable style={[styles.menuButton,menuOpen&&styles.menuButtonOpen]} onPress={() => setMenuOpen((current) => !current)}><Text style={styles.menuButtonText}>☰</Text><Text style={styles.menuButtonLabel}>{t(appLanguage,'menu')}</Text>{release.updateAvailable ? <View style={styles.updateDot} /> : null}</Pressable>
                {menuOpen ? (
                  <Animated.View style={[styles.menuPanel,{opacity:menuAnim,transform:[{translateY:menuAnim.interpolate({inputRange:[0,1],outputRange:[-10,0]})},{scale:menuAnim.interpolate({inputRange:[0,1],outputRange:[.96,1]})}]}]}>
                    <Text style={styles.menuBrand}>KHE BOOTH</Text><Text style={styles.menuSession}>{station.mode} • {eventName ?? t(appLanguage,'event')}</Text>
                    <Pressable style={menuItemStyle('home')} onPress={()=>{setActiveMenu('home');setMenuOpen(false);}}><Text style={menuTextStyle('home')}>⌂ {t(appLanguage,'home')}</Text></Pressable>
                    <Pressable style={menuItemStyle('ready')} onPress={() => openMenuSection('ready',()=>setReadyOpen(true))}><Text style={menuTextStyle('ready')}>★ KHE EVENT READY</Text></Pressable>
                    <Pressable style={menuItemStyle('profile')} onPress={() => openMenuSection('profile',()=>setProfileOpen(true))}><Text style={menuTextStyle('profile')}>👤 {t(appLanguage,'profile')}</Text></Pressable>
                    {station.mode === 'CAPTURE' ? <Pressable style={menuItemStyle('gallery')} onPress={() => openMenuSection('gallery',()=>setGalleryOpen(true))}><Text style={menuTextStyle('gallery')}>🖨 {t(appLanguage,'printPhotos')}</Text></Pressable> : null}
                    <Pressable style={menuItemStyle('settings')} onPress={() => openMenuSection('settings',()=>setSettingsOpen(true))}><Text style={menuTextStyle('settings')}>⚙ {t(appLanguage,'settings')}</Text></Pressable>
                    <Pressable style={menuItemStyle('studio')} onPress={() => openMenuSection('studio',()=>setStudioOpen(true))}><Text style={menuTextStyle('studio')}>✦ {t(appLanguage,'creativeStudio')}</Text></Pressable>
                    <Pressable style={menuItemStyle('guide')} onPress={() => openMenuSection('guide',()=>setGuideOpen(true))}><Text style={menuTextStyle('guide')}>{t(appLanguage,'guide')}</Text></Pressable>
                    <Pressable style={menuItemStyle('language')} onPress={() => openMenuSection('language',()=>setLanguageOpen(true))}><Text style={menuTextStyle('language')}>{t(appLanguage,'languages')} • {languageLabel(appLanguage)}</Text></Pressable>
                    <Pressable style={menuItemStyle('terms')} onPress={() => openMenuSection('terms',()=>setAboutOpen(true))}><Text style={menuTextStyle('terms')}>{t(appLanguage,'terms')}</Text></Pressable>
                    <Pressable style={menuItemStyle('version')} onPress={() => openMenuSection('version',()=>setAboutOpen(true))}><Text style={menuTextStyle('version')}>{t(appLanguage,'version')} {APP_VERSION}{release.updateAvailable ? ` • ${t(appLanguage,'update')} ${release.latestVersion}` : ` • ${t(appLanguage,'upToDate')}`}</Text></Pressable>
                    {station.mode === 'SHARING' && securityOptionsHidden ? <Pressable style={styles.menuItem} onPress={() => { setSecurityOptionsHidden(false); setMenuOpen(false); }}><Text style={styles.menuItemText}>{t(appLanguage,'showSecurity')}</Text></Pressable> : null}
                    <Pressable style={styles.menuItemDanger} onPress={confirmDeactivate}><Text style={styles.menuItemDangerText}>{t(appLanguage,'deactivate')}</Text></Pressable>
                  </Animated.View>
                ) : null}
              </View>
              {stationToken?<StationNotificationCenter api={api} stationToken={stationToken} release={release}/>:null}
            </View>
          ) : null}

          <Text style={styles.brand}>KHE BOOTH</Text><Text style={styles.title}>{t(appLanguage,'stationEvent')}</Text><Text style={styles.muted}>{t(appLanguage,'offlineSeparated')}</Text>
          {release.updateAvailable ? <View style={styles.updateBanner}><Text style={styles.updateBannerText}>{t(appLanguage,'updateAvailable',{version:release.latestVersion})}</Text></View> : null}

          {station ? (
            <View style={styles.section}>
              {stationToken?<Pressable style={styles.eventReadyCard} onPress={()=>{setActiveMenu('ready');setReadyOpen(true);}}><View style={styles.eventReadyStar}><Text style={styles.eventReadyStarText}>★</Text></View><View style={styles.eventReadyCopy}><Text style={styles.eventReadyTitle}>KHE EVENT READY</Text><Text style={styles.eventReadyText}>CAPTURE • SHARING • CLOUD • SYNC • QR</Text></View><Text style={styles.eventReadyArrow}>›</Text></Pressable>:null}

              {!securityOptionsHidden ? <View style={styles.awakeCard}><View style={styles.awakeCopy}><Text style={styles.awakeTitle}>{t(appLanguage,'awakeOptional')}</Text><Text style={styles.awakeStatus}>{keepAwakeEnabled ? t(appLanguage,'screenAlwaysOn') : t(appLanguage,'standbyAllowed')}</Text><Text style={styles.awakeHelp}>{station.mode === 'SHARING' ? t(appLanguage,'sharingStandbyHelp') : t(appLanguage,'captureStandbyHelp')}</Text></View>{station.mode === 'SHARING' ? <Pressable onPress={() => void allowSecureStandby()} style={[styles.awakeButton, styles.awakeButtonActive]}><Text style={styles.awakeButtonTextActive}>{t(appLanguage,'secureStandby')}</Text></Pressable> : null}{station.mode === 'SHARING' ? <Pressable style={styles.skipButton} onPress={() => setSecurityOptionsHidden(true)}><Text style={styles.skipButtonText}>{t(appLanguage,'ignoreOptions')}</Text></Pressable> : null}</View> : null}

              {station.mode === 'SHARING' && !securityOptionsHidden ? <View style={styles.securityCard}><Text style={styles.awakeTitle}>{t(appLanguage,'securityOptional')}</Text><Text style={styles.securityTitle}>{lockConfigured ? t(appLanguage,'passwordConfigured') : t(appLanguage,'createPassword')}</Text><Text style={styles.awakeHelp}>{lockConfigured ? t(appLanguage,'replacePasswordHelp') : t(appLanguage,'passwordOptionalHelp')}</Text><SecurePasswordField value={newLockPassword} onChangeText={setNewLockPassword} placeholder={lockConfigured ? t(appLanguage,'newPassword') : t(appLanguage,'password')} /><SecurePasswordField value={confirmLockPassword} onChangeText={setConfirmLockPassword} placeholder={t(appLanguage,'confirmPassword')} onSubmitEditing={() => void saveLockPassword()} /><Pressable disabled={!newLockPassword || !confirmLockPassword} onPress={() => void saveLockPassword()} style={styles.securityButton}><Text style={styles.securityButtonText}>{lockConfigured ? t(appLanguage,'changePassword') : t(appLanguage,'savePassword')}</Text></Pressable><Pressable style={styles.skipButton} onPress={() => setSecurityOptionsHidden(true)}><Text style={styles.skipButtonText}>{t(appLanguage,'skipConfiguration')}</Text></Pressable></View> : null}

              {station.mode === 'SHARING' && stationToken ? <SharingErrorBoundary><SharingStationPanel eventName={eventName ?? 'KHE Booth'} api={api} stationToken={stationToken} store={store} /></SharingErrorBoundary> : <><Text style={styles.label}>{t(appLanguage,'stationActive')}</Text><Text style={styles.value}>{station.mode}</Text><Text style={styles.label}>{t(appLanguage,'event')}</Text><Text style={styles.value}>{eventName ?? station.session.eventId}</Text><Text style={styles.label}>{t(appLanguage,'kheId')}</Text><Text style={styles.value}>{kheEventNumber(station.session.eventId)}</Text><Pressable disabled={busy} style={styles.primaryButton} onPress={() => void refreshManifest()}><Text style={styles.primaryButtonText}>{busy ? t(appLanguage,'syncing') : t(appLanguage,'refreshManifest')}</Text></Pressable><View style={styles.captureActions}><Pressable disabled={busy || !stationToken} style={styles.captureButton} onPress={() => setCameraOpen(true)}><Text style={styles.captureButtonText}>{t(appLanguage,'openCamera')}</Text></Pressable><Pressable disabled={busy} style={styles.galleryButton} onPress={() => setGalleryOpen(true)}><Text style={styles.galleryButtonText}>{t(appLanguage,'gallery')}</Text></Pressable></View><Text style={styles.notice}>{t(appLanguage,'studioNotice')}</Text></>}
            </View>
          ) : <View style={styles.section}><Text style={styles.label}>{t(appLanguage,'tabletMode')}</Text><View style={styles.modeRow}>{(['CAPTURE', 'SHARING'] as const).map((candidate) => <Pressable key={candidate} onPress={() => setMode(candidate)} style={[styles.modeButton, mode === candidate && styles.modeButtonActive]}><Text style={mode === candidate ? styles.modeTextActive : styles.modeText}>{candidate}</Text></Pressable>)}</View><Text style={styles.label}>{t(appLanguage,'activationCode')}</Text><TextInput autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} placeholder="KHE-123456" style={styles.input} /><Text style={styles.activationHelp}>{t(appLanguage,'noEventId')}</Text><Pressable disabled={busy || !code.trim()} style={styles.primaryButton} onPress={() => void activate()}><Text style={styles.primaryButtonText}>{busy ? t(appLanguage,'activating') : t(appLanguage,'activateStation')}</Text></Pressable><Pressable style={styles.termsLink} onPress={() => setAboutOpen(true)}><Text style={styles.termsLinkText}>{t(appLanguage,'terms')} • {t(appLanguage,'version')} {APP_VERSION}</Text></Pressable></View>}
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Root() { return <TermsGate><App /></TermsGate>; }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' }, pageScroll: { flex: 1 }, pageContent: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingBottom: 44 }, pageContentLandscape: { justifyContent: 'flex-start', paddingVertical: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  backPage: { flex: 1, backgroundColor: '#101010' }, backBar: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6, backgroundColor: '#101010' }, backButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#ffffff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 }, backText: { color: '#ffffff', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 }, backContent: { flex: 1 },
  card: { width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: '#fff', borderRadius: 24, padding: 22, gap: 8 }, cardLandscape: { maxWidth: 980 }, brand: { fontSize: 13, letterSpacing: 3, fontWeight: '800', paddingTop: 4 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '800' }, muted: { opacity: 0.6, lineHeight: 18 }, section: { marginTop: 18, gap: 10 }, label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', opacity: 0.55 }, value: { fontSize: 18, fontWeight: '700' }, small: { fontSize: 12, opacity: 0.65 },
  modeRow: { flexDirection: 'row', gap: 10 }, modeButton: { flex: 1, borderWidth: 1, borderColor: '#c9c9c9', borderRadius: 12, padding: 12, alignItems: 'center' }, modeButtonActive: { backgroundColor: '#111', borderColor: '#111' }, modeText: { fontWeight: '700' }, modeTextActive: { color: '#fff', fontWeight: '700' }, input: { borderWidth: 1, borderColor: '#d6d6d6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff' }, activationHelp: { fontSize: 12, lineHeight: 17, opacity: 0.6 }, primaryButton: { marginTop: 8, backgroundColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center' }, primaryButtonText: { color: '#fff', fontWeight: '800' },
  eventReadyCard:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#18150f',borderWidth:1,borderColor:'#d2ad4f',borderRadius:16,padding:14,shadowColor:'#d2ad4f',shadowOpacity:.16,shadowRadius:10},eventReadyStar:{width:38,height:38,borderRadius:19,backgroundColor:'#d2ad4f',alignItems:'center',justifyContent:'center'},eventReadyStarText:{color:'#111',fontSize:20,fontWeight:'900'},eventReadyCopy:{flex:1},eventReadyTitle:{fontSize:14,fontWeight:'900',color:'#d2ad4f',letterSpacing:.7},eventReadyText:{fontSize:10,fontWeight:'800',color:'#b7a97c',marginTop:3},eventReadyArrow:{fontSize:28,fontWeight:'700',color:'#d2ad4f'},
  awakeCard: { borderWidth: 1, borderColor: '#d5d5d5', borderRadius: 16, padding: 14, gap: 10 }, awakeCopy: { gap: 3 }, awakeTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, opacity: 0.55 }, awakeStatus: { fontSize: 17, fontWeight: '900' }, awakeHelp: { fontSize: 11, lineHeight: 16, opacity: 0.62 }, awakeButton: { borderWidth: 1, borderColor: '#111', borderRadius: 11, paddingVertical: 11, alignItems: 'center' }, awakeButtonActive: { backgroundColor: '#111' }, awakeButtonTextActive: { color: '#fff', fontWeight: '900', fontSize: 11 },
  securityCard: { borderWidth: 1, borderColor: '#d5d5d5', borderRadius: 16, padding: 14, gap: 9 }, securityTitle: { fontSize: 16, fontWeight: '900' }, securityButton: { backgroundColor: '#ededed', borderRadius: 11, paddingVertical: 12, alignItems: 'center' }, securityButtonText: { fontWeight: '900', fontSize: 11 }, skipButton: { paddingVertical: 9, alignItems: 'center' }, skipButtonText: { fontSize: 11, fontWeight: '800', textDecorationLine: 'underline', opacity: 0.65 },
  captureActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, captureButton: { flexGrow: 1, minWidth: 160, borderWidth: 1, borderColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center' }, captureButtonText: { color: '#111', fontWeight: '800' }, galleryButton: { flexGrow: 1, minWidth: 140, backgroundColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center' }, galleryButtonText: { color: '#fff', fontWeight: '800' }, notice: { marginTop: 8, fontSize: 12, lineHeight: 18, opacity: 0.65 }, message: { marginTop: 14, fontSize: 13, lineHeight: 18 },
  headerTools:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12,zIndex:40,marginBottom:8},menuAnchor: { alignSelf: 'flex-start', zIndex: 40 }, menuButton: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#111', borderRadius: 12, borderWidth:1,borderColor:'#111',paddingHorizontal: 12, paddingVertical: 9 },menuButtonOpen:{borderColor:'#d2ad4f',backgroundColor:'#211d14'}, menuButtonText: { color: '#fff', fontSize: 18, fontWeight: '900' }, menuButtonLabel: { color: '#fff', fontSize: 12, fontWeight: '900' }, updateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffd35c' }, menuPanel: { position: 'absolute', top: 48, left: 0, width: 300, backgroundColor: '#111', borderRadius: 16, borderWidth:1,borderColor:'#4f4328',padding: 12, gap: 5, elevation: 12,shadowColor:'#000',shadowOpacity:.35,shadowRadius:14 }, menuBrand: { color: '#fff', fontWeight: '900', letterSpacing: 2 }, menuSession: { color: '#aaa', fontSize: 11, marginBottom: 6 }, menuItem: { backgroundColor: '#222225', borderRadius: 10,borderWidth:1,borderColor:'transparent', padding: 12 }, menuItemActive:{backgroundColor:'#2a2417',borderColor:'#d2ad4f'},menuItemText: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 17 },menuItemTextActive:{color:'#e1bd63'}, menuItemDanger: { borderWidth: 1, borderColor: '#7d3d3d', borderRadius: 10, padding: 12, marginTop: 3 }, menuItemDangerText: { color: '#ffb6b6', fontSize: 12, fontWeight: '900' },
  updateBanner: { backgroundColor: '#fff1bd', borderRadius: 12, padding: 10, marginTop: 7 }, updateBannerText: { color: '#4a3900', fontSize: 11, lineHeight: 16, fontWeight: '800' }, termsLink: { alignItems: 'center', padding: 10 }, termsLinkText: { fontSize: 11, fontWeight: '700', textDecorationLine: 'underline', opacity: 0.65 },
});

registerRootComponent(Root);
