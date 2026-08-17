import * as Location from 'expo-location';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t, type AppLanguage } from '../experience/i18n';

export interface AppSettings {
  wifiPreferred: boolean;
  askBeforeMobileData: boolean;
  confirmBeforeDelete: boolean;
  autoReconnectStations: boolean;
  animatedGalleryPreviews: boolean;
  keepScreenAwakeDuringEvent: boolean;
  preciseLocationEnabled: boolean;
}

const SETTINGS_KEY = 'khe.app.settings.v1';
export const DEFAULT_APP_SETTINGS: AppSettings = {
  wifiPreferred: true,
  askBeforeMobileData: true,
  confirmBeforeDelete: true,
  autoReconnectStations: true,
  animatedGalleryPreviews: true,
  keepScreenAwakeDuringEvent: true,
  preciseLocationEnabled: false,
};

export async function loadAppSettings(): Promise<AppSettings> {
  const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
  if (!raw) return DEFAULT_APP_SETTINGS;
  try { return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }; }
  catch { return DEFAULT_APP_SETTINGS; }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function confirmNetworkTransferIfNeeded(settings: AppSettings, label = 'ce téléchargement'): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  if (state.type !== Network.NetworkStateType.CELLULAR || !settings.askBeforeMobileData) return true;
  return await new Promise((resolve) => {
    Alert.alert('Utiliser les données mobiles ?', `Vous êtes actuellement connecté avec les données mobiles. ${label} peut consommer votre forfait. Voulez-vous continuer ?`, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continuer', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

function ToggleRow({ title, help, value, onChange }: { title: string; help: string; value: boolean; onChange: (next: boolean) => void }) {
  return <Pressable style={styles.row} onPress={() => onChange(!value)}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.help}>{help}</Text></View><View style={[styles.toggle, value && styles.toggleActive]}><View style={[styles.knob, value && styles.knobActive]} /></View></Pressable>;
}

export function SettingsScreen({ onClose, language = 'fr' }: { onClose: () => void; language?: AppLanguage }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [networkType, setNetworkType] = useState<string>('UNKNOWN');
  const [locationStatus, setLocationStatus] = useState<Location.PermissionStatus | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  useEffect(() => {
    void loadAppSettings().then(setSettings);
    void Network.getNetworkStateAsync().then((state) => setNetworkType(String(state.type ?? 'UNKNOWN')));
    void Location.getForegroundPermissionsAsync().then((permission) => setLocationStatus(permission.status));
  }, []);

  function update(patch: Partial<AppSettings>): void {
    setSettings((current) => { const next = { ...current, ...patch }; void saveAppSettings(next); return next; });
  }

  async function togglePreciseLocation(next: boolean): Promise<void> {
    setLocationBusy(true); setLocationMessage('');
    try {
      if (!next) {
        update({ preciseLocationEnabled: false });
        setLocationMessage(t(language, 'locationOff'));
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(permission.status);
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        update({ preciseLocationEnabled: false });
        setLocationMessage(t(language, 'locationDenied'));
        return;
      }
      // Verify that a precise coordinate can be obtained only after explicit opt-in.
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      update({ preciseLocationEnabled: true });
      setLocationMessage(t(language, 'locationOn'));
    } catch (error) {
      update({ preciseLocationEnabled: false });
      setLocationMessage(error instanceof Error ? error.message : t(language, 'locationDenied'));
    } finally { setLocationBusy(false); }
  }

  return <View style={styles.page}><ScrollView contentContainerStyle={styles.scroll}>
    <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.brand}>KHE BOOTH</Text><Text style={styles.title}>{t(language, 'parametersTitle')}</Text><Text style={styles.help}>{t(language, 'parametersSubtitle')}</Text></View><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>{t(language, 'close')}</Text></Pressable></View>
    <View style={styles.networkCard}><Text style={styles.cardTitle}>{t(language, 'currentNetwork')}</Text><Text style={styles.networkType}>{networkType}</Text></View>
    <ToggleRow title={t(language, 'wifiPreferred')} help={t(language, 'wifiHelp')} value={settings.wifiPreferred} onChange={(wifiPreferred) => update({ wifiPreferred })} />
    <ToggleRow title={t(language, 'mobileAsk')} help={t(language, 'mobileHelp')} value={settings.askBeforeMobileData} onChange={(askBeforeMobileData) => update({ askBeforeMobileData })} />
    <ToggleRow title={t(language, 'reconnect')} help={t(language, 'reconnectHelp')} value={settings.autoReconnectStations} onChange={(autoReconnectStations) => update({ autoReconnectStations })} />
    <ToggleRow title={t(language, 'animatedPreview')} help={t(language, 'animatedPreviewHelp')} value={settings.animatedGalleryPreviews} onChange={(animatedGalleryPreviews) => update({ animatedGalleryPreviews })} />
    <ToggleRow title={t(language, 'keepAwake')} help={t(language, 'keepAwakeHelp')} value={settings.keepScreenAwakeDuringEvent} onChange={(keepScreenAwakeDuringEvent) => update({ keepScreenAwakeDuringEvent })} />
    <ToggleRow title={t(language, 'confirmDelete')} help={t(language, 'confirmDeleteHelp')} value={settings.confirmBeforeDelete} onChange={(confirmBeforeDelete) => update({ confirmBeforeDelete })} />

    <View style={styles.locationCard}>
      <View style={{ flex: 1 }}><Text style={styles.locationTitle}>📍 {t(language, 'location')}</Text><Text style={styles.help}>{t(language, 'locationHelp')}</Text><Text style={styles.permissionText}>{settings.preciseLocationEnabled ? t(language, 'locationOn') : t(language, 'locationOff')} • OS: {locationStatus ?? 'unknown'}</Text></View>
      <Pressable disabled={locationBusy} style={[styles.locationButton, settings.preciseLocationEnabled && styles.locationButtonOn]} onPress={() => void togglePreciseLocation(!settings.preciseLocationEnabled)}><Text style={[styles.locationButtonText, settings.preciseLocationEnabled && styles.locationButtonTextOn]}>{locationBusy ? '…' : settings.preciseLocationEnabled ? t(language, 'locationDisable') : t(language, 'locationEnable')}</Text></Pressable>
      {locationStatus === Location.PermissionStatus.DENIED ? <Pressable style={styles.systemButton} onPress={() => void Linking.openSettings()}><Text style={styles.systemButtonText}>{t(language, 'openSystemSettings')}</Text></Pressable> : null}
      {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}
    </View>

    <View style={styles.note}><Text style={styles.noteTitle}>{t(language, 'mobileData')}</Text><Text style={styles.noteText}>{t(language, 'mobileDataNote')}</Text></View>
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' }, scroll: { padding: 20, paddingBottom: 60, gap: 12 }, header: { flexDirection: 'row', gap: 12 }, brand: { color: '#fff', fontSize: 12, letterSpacing: 3, fontWeight: '900' }, title: { color: '#fff', fontSize: 30, fontWeight: '900' }, help: { color: '#aaa', fontSize: 12, lineHeight: 18 }, close: { borderWidth: 1, borderColor: '#555', borderRadius: 12, padding: 10, alignSelf: 'flex-start' }, closeText: { color: '#fff', fontWeight: '800' }, networkCard: { backgroundColor: '#1b1b1f', borderRadius: 16, padding: 16, gap: 5 }, cardTitle: { color: '#aaa', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, networkType: { color: '#fff', fontSize: 24, fontWeight: '900' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181c', padding: 15, borderRadius: 16 }, rowTitle: { color: '#fff', fontWeight: '900', marginBottom: 3 }, toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#3b3b40', padding: 3 }, toggleActive: { backgroundColor: '#c7a34b' }, knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#aaa' }, knobActive: { marginLeft: 20, backgroundColor: '#111' }, note: { backgroundColor: '#20262a', borderRadius: 16, padding: 15, gap: 4 }, noteTitle: { color: '#fff', fontWeight: '900' }, noteText: { color: '#bdc7cb', fontSize: 11, lineHeight: 17 }, locationCard: { backgroundColor: '#251b1c', borderWidth: 1, borderColor: '#8e1e2d', borderRadius: 18, padding: 16, gap: 12 }, locationTitle: { color: '#f4d37a', fontSize: 18, fontWeight: '900' }, permissionText: { color: '#d8c7c7', fontSize: 10, marginTop: 7, fontWeight: '800' }, locationButton: { backgroundColor: '#8e1e2d', borderRadius: 13, padding: 13, alignItems: 'center' }, locationButtonOn: { backgroundColor: '#c7a34b' }, locationButtonText: { color: '#fff', fontWeight: '900' }, locationButtonTextOn: { color: '#111' }, systemButton: { borderWidth: 1, borderColor: '#c7a34b', borderRadius: 12, padding: 11, alignItems: 'center' }, systemButtonText: { color: '#f4d37a', fontWeight: '800' }, locationMessage: { color: '#fff', fontSize: 11, lineHeight: 16 },
});