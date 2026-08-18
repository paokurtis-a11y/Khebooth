import * as Location from 'expo-location';
import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HttpStationApi } from '../api/station-api';
import { API_BASE_URL } from '../config';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  playNotificationFeedback,
  saveNotificationPreferences,
  type NotificationPreferences,
} from './notification-feedback';

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
const STATION_TOKEN_KEY = 'khe.station.token.v1';

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

function permissionAccuracyLabel(permission: Location.LocationPermissionResponse | null): string {
  if (!permission?.granted) return permission?.canAskAgain === false ? 'Refusée — réglages système requis' : 'Non autorisée';
  if (permission.android?.accuracy === 'fine' || permission.ios?.accuracy === 'full') return 'Précise';
  if (permission.android?.accuracy === 'coarse' || permission.ios?.accuracy === 'reduced') return 'Approximative';
  return 'Autorisée';
}

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const api = useMemo(() => new HttpStationApi(API_BASE_URL), []);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [networkType, setNetworkType] = useState<string>('UNKNOWN');
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [locationPermission, setLocationPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [locationMessage, setLocationMessage] = useState('');

  useEffect(() => {
    void loadAppSettings().then(setSettings);
    void Network.getNetworkStateAsync().then((state) => setNetworkType(String(state.type ?? 'UNKNOWN')));
    void Location.getForegroundPermissionsAsync().then(setLocationPermission).catch(() => undefined);
    void (async () => {
      const local = await loadNotificationPreferences();
      setNotificationPreferences(local);
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
      setLocationMessage('Localisation désactivée dans KHE Booth. L’application ne demandera pas votre position.');
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
        setLocationMessage('Autorisation refusée. Vous pourrez la réactiver plus tard.');
        return;
      }
      if (!precise) {
        update({ preciseLocationEnabled: false });
        setLocationMessage('La localisation accordée est approximative. Activez « position précise » dans les réglages système si vous souhaitez utiliser cette option.');
        return;
      }
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      update({ preciseLocationEnabled: true });
      setLocationMessage('✓ Localisation précise activée uniquement lorsque KHE Booth en a besoin.');
    } catch (error) {
      update({ preciseLocationEnabled: false });
      setLocationMessage(error instanceof Error ? error.message : 'Impossible d’activer la localisation précise.');
    }
  }

  async function updateNotifications(patch: Partial<NotificationPreferences>): Promise<void> {
    const next = { ...notificationPreferences, ...patch };
    setNotificationPreferences(next);
    await saveNotificationPreferences(next);
    setNotificationMessage('Réglage enregistré localement.');
    const token = await SecureStore.getItemAsync(STATION_TOKEN_KEY);
    if (!token) return;
    try {
      await api.updateNotificationPreferences(token, next);
      setNotificationMessage('✓ Réglage synchronisé entre CAPTURE et SHARING.');
    } catch (error) {
      setNotificationMessage(`Réglage local conservé. ${error instanceof Error ? error.message : ''}`.trim());
    }
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>KHE BOOTH</Text>
            <Text style={styles.title}>Paramètres</Text>
            <Text style={styles.help}>Personnalisez le confort, le réseau, la localisation et les notifications.</Text>
          </View>
          <Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>

        <View style={styles.networkCard}>
          <Text style={styles.cardTitle}>RÉSEAU ACTUEL</Text>
          <Text style={styles.networkType}>{networkType}</Text>
          <Text style={styles.help}>Le Wi‑Fi reste recommandé pour les médias lourds. Les données mobiles restent autorisées après confirmation.</Text>
        </View>
        <ToggleRow title="Préférer le Wi‑Fi" help="KHE privilégie le Wi‑Fi pour les téléchargements et synchronisations lourdes." value={settings.wifiPreferred} onChange={(wifiPreferred) => update({ wifiPreferred })} />
        <ToggleRow title="Demander avant données mobiles" help="Si KHE détecte une connexion cellulaire, une confirmation sera demandée avant un transfert lourd." value={settings.askBeforeMobileData} onChange={(askBeforeMobileData) => update({ askBeforeMobileData })} />
        <ToggleRow title="Reconnexion automatique CAPTURE ↔ SHARING" help="Tente de rétablir automatiquement la liaison après une coupure réseau courte." value={settings.autoReconnectStations} onChange={(autoReconnectStations) => update({ autoReconnectStations })} />
        <ToggleRow title="Aperçus animés dans la galerie" help="Anime les moments vidéo pour une galerie plus vivante. Peut consommer davantage de batterie." value={settings.animatedGalleryPreviews} onChange={(animatedGalleryPreviews) => update({ animatedGalleryPreviews })} />
        <ToggleRow title="Écran actif pendant l’événement" help="Empêche la mise en veille pendant une station active. Cette option reste facultative." value={settings.keepScreenAwakeDuringEvent} onChange={(keepScreenAwakeDuringEvent) => update({ keepScreenAwakeDuringEvent })} />
        <ToggleRow title="Confirmation avant suppression" help="Demande une validation avant de supprimer définitivement un média local." value={settings.confirmBeforeDelete} onChange={(confirmBeforeDelete) => update({ confirmBeforeDelete })} />

        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>LOCALISATION</Text>
          <Text style={styles.sectionTitle}>Localisation précise</Text>
          <Text style={styles.help}>État système : {permissionAccuracyLabel(locationPermission)}. KHE Booth n’utilise pas la position si cette option est désactivée.</Text>
          <ToggleRow title="Utiliser ma localisation précise" help="Active la position de haute précision uniquement pour les fonctions KHE qui en ont besoin." value={settings.preciseLocationEnabled} onChange={(value) => void setPreciseLocation(value)} />
          {locationMessage ? <Text style={styles.inlineMessage}>{locationMessage}</Text> : null}
          <Pressable style={styles.outlineButton} onPress={() => void Linking.openSettings()}><Text style={styles.outlineText}>Ouvrir les réglages de l’appareil</Text></Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>NOTIFICATIONS</Text>
          <Text style={styles.sectionTitle}>Son et vibration</Text>
          <ToggleRow title="Notifications KHE" help="Active ou coupe les retours sonores et vibratoires de KHE Booth." value={notificationPreferences.enabled} onChange={(enabled) => void updateNotifications({ enabled })} />
          <ToggleRow title="Son" help="Vous pouvez choisir un son KHE ou garder l’application silencieuse." value={notificationPreferences.soundEnabled && notificationPreferences.sound !== 'silent'} onChange={(soundEnabled) => void updateNotifications({ soundEnabled, sound: soundEnabled ? (notificationPreferences.sound === 'silent' ? 'khe_chime' : notificationPreferences.sound) : 'silent' })} />
          <ChoiceRow label="Son" value={notificationPreferences.sound} onChange={(sound) => void updateNotifications({ sound, soundEnabled: sound !== 'silent' })} values={[["khe_chime", "KHE Chime"], ["khe_gold", "KHE Gold"], ["khe_pulse", "KHE Pulse"], ["default", "Classique"], ["silent", "Silencieux"]]} />
          <ChoiceRow label="Volume" value={String(notificationPreferences.soundVolume)} onChange={(value) => void updateNotifications({ soundVolume: Number(value) })} values={[["25", "25%"], ["50", "50%"], ["70", "70%"], ["100", "100%"]]} />
          <ToggleRow title="Vibration" help="Utilise la vibration de l’appareil lorsqu’elle est disponible." value={notificationPreferences.vibrationEnabled} onChange={(vibrationEnabled) => void updateNotifications({ vibrationEnabled, vibrationMode: vibrationEnabled ? (notificationPreferences.vibrationMode === 'off' ? 'double' : notificationPreferences.vibrationMode) : 'off' })} />
          <ChoiceRow label="Mode de vibration" value={notificationPreferences.vibrationMode} onChange={(vibrationMode) => void updateNotifications({ vibrationMode, vibrationEnabled: vibrationMode !== 'off' })} values={[["short", "Courte"], ["double", "Double"], ["triple", "Triple"], ["long", "Longue"], ["off", "Aucune"]]} />
          <ChoiceRow label="Intensité souhaitée" value={notificationPreferences.vibrationIntensity} onChange={(vibrationIntensity) => void updateNotifications({ vibrationIntensity })} values={[["light", "Légère"], ["medium", "Moyenne"], ["strong", "Forte"]]} />
          <Text style={styles.help}>Selon Android/iOS et le matériel, KHE peut contrôler le motif mais pas toujours la puissance physique du moteur de vibration. Les réglages système restent prioritaires.</Text>
          <Pressable style={styles.testButton} onPress={() => void playNotificationFeedback(notificationPreferences)}><Text style={styles.testText}>Tester la notification</Text></Pressable>
          {notificationMessage ? <Text style={styles.inlineMessage}>{notificationMessage}</Text> : null}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Données mobiles</Text>
          <Text style={styles.noteText}>KHE ne bloque pas les données mobiles. Lorsqu’une opération lourde démarre sur réseau cellulaire, l’application peut demander votre accord avant de continuer.</Text>
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
  testButton: { backgroundColor: '#b31520', borderRadius: 12, padding: 12, alignItems: 'center' },
  testText: { color: '#fff', fontWeight: '900' },
  outlineButton: { borderWidth: 1, borderColor: '#d2ad4f', borderRadius: 12, padding: 11, alignItems: 'center' },
  outlineText: { color: '#d2ad4f', fontWeight: '900' },
  inlineMessage: { color: '#d8c69b', fontSize: 11, lineHeight: 17 },
});
