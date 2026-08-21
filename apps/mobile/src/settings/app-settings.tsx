import * as Location from 'expo-location';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HttpStationApi } from '../api/station-api';
import { API_BASE_URL } from '../config';
import { t, type AppLanguage } from '../experience/i18n';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  playNotificationFeedback,
  saveNotificationPreferences,
  type NotificationPreferences,
} from './notification-feedback';
import { SharingBusinessSettingsPanel } from './sharing-business-settings';

export type TextScalePreference='SMALL'|'NORMAL'|'LARGE'|'XLARGE';
export type TextStylePreference='CLASSIC'|'MODERN'|'ELEGANT'|'COMFORT';

export interface AppSettings {
  wifiPreferred: boolean;
  askBeforeMobileData: boolean;
  confirmBeforeDelete: boolean;
  autoReconnectStations: boolean;
  animatedGalleryPreviews: boolean;
  keepScreenAwakeDuringEvent: boolean;
  preciseLocationEnabled: boolean;
  textScale: TextScalePreference;
  textStyle: TextStylePreference;
}

const SETTINGS_KEY = 'khe.app.settings.v1';
const STATION_TOKEN_KEY = 'khe.station.token.v1';
const NOTIFICATION_VALIDATED_KEY = 'khe.notification.validated.v1';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  wifiPreferred: true,
  askBeforeMobileData: true,
  confirmBeforeDelete: true,
  autoReconnectStations: true,
  animatedGalleryPreviews: true,
  keepScreenAwakeDuringEvent: true,
  preciseLocationEnabled: false,
  textScale:'NORMAL',
  textStyle:'MODERN',
};

export const TEXT_SCALE_MULTIPLIER:Record<TextScalePreference,number>={SMALL:.9,NORMAL:1,LARGE:1.16,XLARGE:1.34};
export const TEXT_STYLE_FONT:Record<TextStylePreference,string|undefined>={CLASSIC:'serif',MODERN:'sans-serif-medium',ELEGANT:'serif',COMFORT:'sans-serif'};

export async function loadAppSettings(): Promise<AppSettings> {
  const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
  if (!raw) return DEFAULT_APP_SETTINGS;
  try {
    return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function confirmNetworkTransferIfNeeded(settings: AppSettings, label = 'ce téléchargement'): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  if (state.type !== Network.NetworkStateType.CELLULAR || !settings.askBeforeMobileData) return true;
  return await new Promise((resolve) => {
    Alert.alert(
      'Utiliser les données mobiles ?',
      `Vous êtes actuellement connecté avec les données mobiles. ${label} peut consommer votre forfait. Voulez-vous continuer ?`,
      [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continuer', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

function ToggleRow({ title, help, value, onChange }: { title: string; help: string; value: boolean; onChange: (next: boolean) => void }) {
  return (
    <Pressable style={styles.row} onPress={() => onChange(!value)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.help}>{help}</Text>
      </View>
      <View style={[styles.toggle, value && styles.toggleActive]}>
        <View style={[styles.knob, value && styles.knobActive]} />
      </View>
    </Pressable>
  );
}

function ChoiceRow({ label, values, value, onChange }: { label: string; values: Array<[string, string]>; value: string; onChange: (next: string) => void }) {
  return (
    <View style={styles.choiceSection}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choiceWrap}>
        {values.map(([key, title]) => (
          <Pressable key={key} onPress={() => onChange(key)} style={[styles.choice, value === key && styles.choiceActive]}>
            <Text style={[styles.choiceText, value === key && styles.choiceTextActive]}>{title}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function permissionAccuracyLabel(permission: Location.LocationPermissionResponse | null, language: AppLanguage): string {
  const labels: Record<AppLanguage, { denied: string; blocked: string; precise: string; approximate: string; allowed: string }> = {
    fr: { denied: 'Non autorisée', blocked: 'Refusée — réglages système requis', precise: 'Précise', approximate: 'Approximative', allowed: 'Autorisée' },
    en: { denied: 'Not allowed', blocked: 'Denied — device settings required', precise: 'Precise', approximate: 'Approximate', allowed: 'Allowed' },
    de: { denied: 'Nicht erlaubt', blocked: 'Abgelehnt — Geräteeinstellungen erforderlich', precise: 'Genau', approximate: 'Ungefähr', allowed: 'Erlaubt' },
    it: { denied: 'Non autorizzata', blocked: 'Rifiutata — servono le impostazioni dispositivo', precise: 'Precisa', approximate: 'Approssimativa', allowed: 'Autorizzata' },
    es: { denied: 'No autorizada', blocked: 'Rechazada — requiere ajustes del dispositivo', precise: 'Precisa', approximate: 'Aproximada', allowed: 'Autorizada' },
    pt: { denied: 'Não autorizada', blocked: 'Recusada — requer definições do dispositivo', precise: 'Precisa', approximate: 'Aproximada', allowed: 'Autorizada' },
  };
  const copy=labels[language];
  if (!permission?.granted) return permission?.canAskAgain === false ? copy.blocked : copy.denied;
  if (permission.android?.accuracy === 'fine' || permission.ios?.accuracy === 'full') return copy.precise;
  if (permission.android?.accuracy === 'coarse' || permission.ios?.accuracy === 'reduced') return copy.approximate;
  return copy.allowed;
}

export function SettingsScreen({ onClose, language='fr' }: { onClose: () => void; language?: AppLanguage }) {
  const api = useMemo(() => new HttpStationApi(API_BASE_URL), []);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [networkType, setNetworkType] = useState<string>('UNKNOWN');
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationValidated, setNotificationValidated] = useState(false);
  const [notificationEditing, setNotificationEditing] = useState(true);
  const [notificationTested, setNotificationTested] = useState(false);
  const [locationPermission, setLocationPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [locationMessage, setLocationMessage] = useState('');

  useEffect(() => {
    void loadAppSettings().then(setSettings);
    void Network.getNetworkStateAsync().then((state) => setNetworkType(String(state.type ?? 'UNKNOWN')));
    void Location.getForegroundPermissionsAsync().then(setLocationPermission).catch(() => undefined);
    void (async () => {
      const local = await loadNotificationPreferences();
      setNotificationPreferences(local);
      const validated = (await SecureStore.getItemAsync(NOTIFICATION_VALIDATED_KEY)) === 'true';
      setNotificationValidated(validated);
      setNotificationEditing(!validated);
      const token = await SecureStore.getItemAsync(STATION_TOKEN_KEY);
      if (!token) return;
      try {
        const remote = await api.notificationPreferences(token);
        const next = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...remote };
        setNotificationPreferences(next);
        await saveNotificationPreferences(next);
      } catch {
        // Le réglage local reste disponible hors ligne.
      }
    })();
  }, [api]);

  function update(patch: Partial<AppSettings>): void {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void saveAppSettings(next);
      return next;
    });
  }

  async function setPreciseLocation(enabled: boolean): Promise<void> {
    setLocationMessage('');
    if (!enabled) {
      update({ preciseLocationEnabled: false });
      setLocationMessage(language === 'en' ? 'Location disabled in KHE Booth. The app will not request your position.' : 'Localisation désactivée dans KHE Booth. L’application ne demandera pas votre position.');
      return;
    }
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(permission);
      const precise = permission.granted && (
        permission.android?.accuracy === 'fine' ||
        permission.ios?.accuracy === 'full' ||
        (!permission.android && !permission.ios)
      );
      if (!permission.granted) {
        update({ preciseLocationEnabled: false });
        setLocationMessage(language === 'en' ? 'Permission denied. You can enable it later; KHE Booth remains usable.' : 'Autorisation refusée. Vous pourrez la réactiver plus tard.');
        return;
      }
      if (!precise) {
        update({ preciseLocationEnabled: false });
        setLocationMessage(language === 'en' ? 'Only approximate location is allowed. Enable precise location in device settings if you want this option.' : 'La localisation accordée est approximative. Activez « position précise » dans les réglages système si vous souhaitez utiliser cette option.');
        return;
      }
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      update({ preciseLocationEnabled: true });
      setLocationMessage(language === 'en' ? '✓ Precise location enabled only when KHE Booth needs it.' : '✓ Localisation précise activée uniquement lorsque KHE Booth en a besoin.');
    } catch (error) {
      update({ preciseLocationEnabled: false });
      setLocationMessage(error instanceof Error ? error.message : 'Impossible d’activer la localisation précise.');
    }
  }

  function changeNotificationDraft(patch: Partial<NotificationPreferences>): void {
    setNotificationPreferences((current) => ({ ...current, ...patch }));
    setNotificationTested(false);
    setNotificationValidated(false);
    setNotificationMessage('Réglage modifié. Testez-le avant de le valider.');
  }

  async function testNotifications(): Promise<void> {
    await playNotificationFeedback(notificationPreferences);
    setNotificationTested(true);
    setNotificationMessage('✓ Test effectué. Si le résultat vous convient, validez ce réglage.');
  }

  async function validateNotifications(): Promise<void> {
    if (!notificationTested) {
      setNotificationMessage('Testez d’abord la notification avant de valider.');
      return;
    }
    await saveNotificationPreferences(notificationPreferences);
    const token = await SecureStore.getItemAsync(STATION_TOKEN_KEY);
    try {
      if (token) await api.updateNotificationPreferences(token, notificationPreferences);
      await SecureStore.setItemAsync(NOTIFICATION_VALIDATED_KEY, 'true', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      setNotificationValidated(true);
      setNotificationEditing(false);
      setNotificationMessage('✓ Notification validée et synchronisée.');
    } catch (error) {
      await SecureStore.setItemAsync(NOTIFICATION_VALIDATED_KEY, 'true', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      setNotificationValidated(true);
      setNotificationEditing(false);
      setNotificationMessage(`✓ Réglage validé sur cette tablette. Synchronisation Cloud à reprendre plus tard. ${error instanceof Error ? error.message : ''}`.trim());
    }
  }

  const previewMultiplier=TEXT_SCALE_MULTIPLIER[settings.textScale];
  const previewFont=TEXT_STYLE_FONT[settings.textStyle];

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>KHE BOOTH</Text>
            <Text style={styles.title}>{t(language,'settings')}</Text>
            <Text style={styles.help}>{t(language,'settingsSubtitle')}</Text>
          </View>
          <Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>{t(language,'close')}</Text></Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>{t(language,'displayReadability')}</Text>
          <Text style={styles.sectionTitle}>{t(language,'textSizeStyle')}</Text>
          <Text style={styles.help}>{t(language,'displayHelp')}</Text>
          <ChoiceRow label={t(language,'textSize')} value={settings.textScale} onChange={(textScale)=>update({textScale:textScale as TextScalePreference})} values={[["SMALL",t(language,'small')],["NORMAL",t(language,'normal')],["LARGE",t(language,'large')],["XLARGE",t(language,'xlarge')]]} />
          <ChoiceRow label={t(language,'textStyle')} value={settings.textStyle} onChange={(textStyle)=>update({textStyle:textStyle as TextStylePreference})} values={[["CLASSIC",t(language,'classic')],["MODERN",t(language,'modern')],["ELEGANT",t(language,'elegant')],["COMFORT",t(language,'comfort')]]} />
          <View style={styles.previewCard}>
            <Text style={[styles.previewLabel,{fontFamily:previewFont}]}>{t(language,'livePreview')}</Text>
            <Text style={[styles.previewTitle,{fontFamily:previewFont,fontSize:22*previewMultiplier,lineHeight:28*previewMultiplier}]}>{t(language,'previewTitle')}</Text>
            <Text style={[styles.previewBody,{fontFamily:previewFont,fontSize:13*previewMultiplier,lineHeight:19*previewMultiplier}]}>{t(language,'previewBody')}</Text>
          </View>
        </View>

        <View style={styles.networkCard}>
          <Text style={styles.cardTitle}>{t(language,'currentNetwork')}</Text>
          <Text style={styles.networkType}>{networkType}</Text>
          <Text style={styles.help}>{t(language,'networkHelp')}</Text>
        </View>
        <ToggleRow title={t(language,'wifiPreferred')} help={t(language,'wifiHelp')} value={settings.wifiPreferred} onChange={(wifiPreferred) => update({ wifiPreferred })} />
        <ToggleRow title={t(language,'mobileAsk')} help={t(language,'mobileHelp')} value={settings.askBeforeMobileData} onChange={(askBeforeMobileData) => update({ askBeforeMobileData })} />
        <ToggleRow title={t(language,'reconnect')} help={t(language,'reconnectHelp')} value={settings.autoReconnectStations} onChange={(autoReconnectStations) => update({ autoReconnectStations })} />
        <ToggleRow title={t(language,'animatedPreview')} help={t(language,'animatedPreviewHelp')} value={settings.animatedGalleryPreviews} onChange={(animatedGalleryPreviews) => update({ animatedGalleryPreviews })} />
        <ToggleRow title={t(language,'keepAwake')} help={t(language,'keepAwakeHelp')} value={settings.keepScreenAwakeDuringEvent} onChange={(keepScreenAwakeDuringEvent) => update({ keepScreenAwakeDuringEvent })} />
        <ToggleRow title={t(language,'confirmDelete')} help={t(language,'confirmDeleteHelp')} value={settings.confirmBeforeDelete} onChange={(confirmBeforeDelete) => update({ confirmBeforeDelete })} />

        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>{t(language,'location')}</Text>
          <Text style={styles.sectionTitle}>{t(language,'preciseLocation')}</Text>
          <Text style={styles.help}>{t(language,'systemState')} : {permissionAccuracyLabel(locationPermission,language)}. {t(language,'preciseOptional')}</Text>
          <ToggleRow title={t(language,'preciseLocationToggle')} help={t(language,'preciseLocationHelp')} value={settings.preciseLocationEnabled} onChange={(value) => void setPreciseLocation(value)} />
          {locationMessage ? <Text style={styles.inlineMessage}>{locationMessage}</Text> : null}
          <Pressable style={styles.outlineButton} onPress={() => void Linking.openSettings()}><Text style={styles.outlineText}>{t(language,'openSystemSettings')}</Text></Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>{t(language,'notifications')}</Text>
          <View style={styles.notificationHeading}><View style={{flex:1}}><Text style={styles.sectionTitle}>{t(language,'soundVibration')}</Text><Text style={styles.help}>{notificationValidated && !notificationEditing ? 'Réglage validé. Appuyez sur Modifier pour effectuer un nouveau test.' : 'Configurez, testez puis validez votre notification KHE.'}</Text></View>{notificationValidated && !notificationEditing ? <View style={styles.validBadge}><Text style={styles.validBadgeText}>VALIDÉ ✓</Text></View> : null}</View>
          <View pointerEvents={notificationValidated && !notificationEditing ? 'none' : 'auto'} style={notificationValidated && !notificationEditing ? styles.settingsLocked : undefined}>
            <View style={styles.notificationControls}>
              <ToggleRow title="Notifications KHE" help="Active ou coupe les retours sonores et vibratoires de KHE Booth." value={notificationPreferences.enabled} onChange={(enabled) => changeNotificationDraft({ enabled })} />
              <ToggleRow title="Son" help="Vous pouvez choisir un son KHE ou garder l’application silencieuse." value={notificationPreferences.soundEnabled && notificationPreferences.sound !== 'silent'} onChange={(soundEnabled) => changeNotificationDraft({ soundEnabled, sound: soundEnabled ? (notificationPreferences.sound === 'silent' ? 'khe_chime' : notificationPreferences.sound) : 'silent' })} />
              <ChoiceRow label="Son" value={notificationPreferences.sound} onChange={(sound) => changeNotificationDraft({ sound, soundEnabled: sound !== 'silent' })} values={[["khe_chime", "KHE Chime"], ["khe_gold", "KHE Gold"], ["khe_pulse", "KHE Pulse"], ["khe_flash", "KHE Flash"], ["khe_velvet", "KHE Velvet"], ["khe_victory", "KHE Victory"], ["khe_night", "KHE Night"], ["default", "Classique"], ["silent", "Silencieux"]]} />
              <ChoiceRow label="Volume" value={String(notificationPreferences.soundVolume)} onChange={(value) => changeNotificationDraft({ soundVolume: Number(value) })} values={[["25", "25%"], ["50", "50%"], ["70", "70%"], ["100", "100%"]]} />
              <ToggleRow title="Vibration" help="Utilise la vibration de l’appareil lorsqu’elle est disponible." value={notificationPreferences.vibrationEnabled} onChange={(vibrationEnabled) => changeNotificationDraft({ vibrationEnabled, vibrationMode: vibrationEnabled ? (notificationPreferences.vibrationMode === 'off' ? 'double' : notificationPreferences.vibrationMode) : 'off' })} />
              <ChoiceRow label="Mode de vibration" value={notificationPreferences.vibrationMode} onChange={(vibrationMode) => changeNotificationDraft({ vibrationMode, vibrationEnabled: vibrationMode !== 'off' })} values={[["short", "Courte"], ["double", "Double"], ["triple", "Triple"], ["heartbeat", "Battement KHE"], ["long", "Longue"], ["off", "Aucune"]]} />
              <ChoiceRow label="Intensité souhaitée" value={notificationPreferences.vibrationIntensity} onChange={(vibrationIntensity) => changeNotificationDraft({ vibrationIntensity })} values={[["light", "Légère"], ["medium", "Moyenne"], ["strong", "Forte"]]} />
              <Text style={styles.help}>Selon Android/iOS et le matériel, KHE peut contrôler le motif mais pas toujours la puissance physique du moteur de vibration. Les réglages système restent prioritaires.</Text>
            </View>
          </View>
          {notificationValidated && !notificationEditing ? <Pressable style={styles.modifyNotificationButton} onPress={() => {setNotificationEditing(true);setNotificationTested(false);setNotificationMessage('Vous pouvez modifier le réglage. Testez-le avant la prochaine validation.');}}><Text style={styles.modifyNotificationText}>MODIFIER LA NOTIFICATION</Text></Pressable> : <View style={styles.notificationActions}><Pressable style={styles.testButton} onPress={() => void testNotifications()}><Text style={styles.testText}>TESTER LA NOTIFICATION</Text></Pressable><Pressable style={[styles.validateButton,!notificationTested&&styles.validateDisabled]} onPress={() => void validateNotifications()}><Text style={styles.validateText}>VALIDER LE RÉGLAGE</Text></Pressable></View>}
          {notificationMessage ? <Text style={styles.inlineMessage}>{notificationMessage}</Text> : null}
        </View>

        <SharingBusinessSettingsPanel api={api} />

        <View style={styles.note}>
          <Text style={styles.noteTitle}>{t(language,'mobileData')}</Text>
          <Text style={styles.noteText}>{t(language,'mobileDataNote')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' },
  scroll: { padding: 20, paddingBottom: 60, gap: 12 },
  header: { flexDirection: 'row', gap: 12 },
  brand: { color: '#d2ad4f', fontSize: 12, letterSpacing: 3, fontWeight: '900' },
  title: { color: '#fff', fontSize: 30, fontWeight: '900' },
  help: { color: '#aaa', fontSize: 12, lineHeight: 18 },
  close: { borderWidth: 1, borderColor: '#555', borderRadius: 12, padding: 10, alignSelf: 'flex-start' },
  closeText: { color: '#fff', fontWeight: '800' },
  networkCard: { backgroundColor: '#1b1b1f', borderRadius: 16, padding: 16, gap: 5 },
  cardTitle: { color: '#d2ad4f', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  networkType: { color: '#fff', fontSize: 24, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181c', padding: 15, borderRadius: 16 },
  rowTitle: { color: '#fff', fontWeight: '900', marginBottom: 3 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#3b3b40', padding: 3 },
  toggleActive: { backgroundColor: '#d2ad4f' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#aaa' },
  knobActive: { marginLeft: 20, backgroundColor: '#111' },
  note: { backgroundColor: '#20262a', borderRadius: 16, padding: 15, gap: 4 },
  noteTitle: { color: '#fff', fontWeight: '900' },
  noteText: { color: '#bdc7cb', fontSize: 11, lineHeight: 17 },
  sectionCard: { backgroundColor: '#171719', borderRadius: 18, padding: 16, gap: 11, borderWidth: 1, borderColor: '#332b20' },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  choiceSection: { gap: 7 },
  choiceLabel: { color: '#fff', fontSize: 11, fontWeight: '900' },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { borderWidth: 1, borderColor: '#4c4c51', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  choiceActive: { backgroundColor: '#d2ad4f', borderColor: '#d2ad4f' },
  choiceText: { color: '#ddd', fontSize: 11, fontWeight: '800' },
  choiceTextActive: { color: '#111' },
  previewCard:{backgroundColor:'#f5fbff',borderWidth:1,borderColor:'#8ad9f5',borderRadius:16,padding:16,gap:7},previewLabel:{fontSize:9,fontWeight:'900',letterSpacing:1.5,color:'#8b6819'},previewTitle:{color:'#17242b',fontWeight:'900'},previewBody:{color:'#4f6672'},
  notificationHeading:{flexDirection:'row',alignItems:'flex-start',gap:10},validBadge:{backgroundColor:'#d2ad4f',borderRadius:999,paddingHorizontal:9,paddingVertical:6},validBadgeText:{color:'#111',fontSize:9,fontWeight:'900'},notificationControls:{gap:10},settingsLocked:{opacity:.58},notificationActions:{flexDirection:'row',flexWrap:'wrap',gap:8},
  testButton: { flexGrow:1,minWidth:150,backgroundColor: '#b31520', borderRadius: 12, padding: 12, alignItems: 'center' },
  testText: { color: '#fff', fontWeight: '900',fontSize:10 },validateButton:{flexGrow:1,minWidth:150,backgroundColor:'#d2ad4f',borderRadius:12,padding:12,alignItems:'center'},validateDisabled:{opacity:.45},validateText:{color:'#111',fontWeight:'900',fontSize:10},modifyNotificationButton:{backgroundColor:'#d2ad4f',borderRadius:12,padding:13,alignItems:'center'},modifyNotificationText:{color:'#111',fontWeight:'900',fontSize:10,letterSpacing:.4},
  outlineButton: { borderWidth: 1, borderColor: '#d2ad4f', borderRadius: 12, padding: 11, alignItems: 'center' },
  outlineText: { color: '#d2ad4f', fontWeight: '900' },
  inlineMessage: { color: '#d8c69b', fontSize: 11, lineHeight: 17 },
});