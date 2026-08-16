import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface AppSettings {
  wifiPreferred: boolean;
  askBeforeMobileData: boolean;
  confirmBeforeDelete: boolean;
  autoReconnectStations: boolean;
  animatedGalleryPreviews: boolean;
  keepScreenAwakeDuringEvent: boolean;
}

const SETTINGS_KEY = 'khe.app.settings.v1';
export const DEFAULT_APP_SETTINGS: AppSettings = {
  wifiPreferred: true,
  askBeforeMobileData: true,
  confirmBeforeDelete: true,
  autoReconnectStations: true,
  animatedGalleryPreviews: true,
  keepScreenAwakeDuringEvent: true,
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
      <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.help}>{help}</Text></View>
      <View style={[styles.toggle, value && styles.toggleActive]}><View style={[styles.knob, value && styles.knobActive]} /></View>
    </Pressable>
  );
}

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [networkType, setNetworkType] = useState<string>('UNKNOWN');
  useEffect(() => {
    void loadAppSettings().then(setSettings);
    void Network.getNetworkStateAsync().then((state) => setNetworkType(String(state.type ?? 'UNKNOWN')));
  }, []);
  function update(patch: Partial<AppSettings>): void {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void saveAppSettings(next);
      return next;
    });
  }
  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.brand}>KHE BOOTH</Text><Text style={styles.title}>Paramètres</Text><Text style={styles.help}>Personnalisez le confort, le réseau et la sécurité d’utilisation.</Text></View><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable></View>
        <View style={styles.networkCard}><Text style={styles.cardTitle}>RÉSEAU ACTUEL</Text><Text style={styles.networkType}>{networkType}</Text><Text style={styles.help}>Le Wi‑Fi reste recommandé pour les médias lourds. Les données mobiles restent autorisées après confirmation.</Text></View>
        <ToggleRow title="Préférer le Wi‑Fi" help="KHE privilégie le Wi‑Fi pour les téléchargements et synchronisations lourdes." value={settings.wifiPreferred} onChange={(wifiPreferred) => update({ wifiPreferred })} />
        <ToggleRow title="Demander avant données mobiles" help="Si KHE détecte une connexion cellulaire, une confirmation sera demandée avant un transfert lourd." value={settings.askBeforeMobileData} onChange={(askBeforeMobileData) => update({ askBeforeMobileData })} />
        <ToggleRow title="Reconnexion automatique CAPTURE ↔ SHARING" help="Tente de rétablir automatiquement la liaison après une coupure réseau courte." value={settings.autoReconnectStations} onChange={(autoReconnectStations) => update({ autoReconnectStations })} />
        <ToggleRow title="Aperçus animés dans la galerie" help="Anime les moments vidéo pour une galerie plus vivante. Peut consommer davantage de batterie." value={settings.animatedGalleryPreviews} onChange={(animatedGalleryPreviews) => update({ animatedGalleryPreviews })} />
        <ToggleRow title="Écran actif pendant l’événement" help="Empêche la mise en veille pendant une station active. Cette option reste facultative." value={settings.keepScreenAwakeDuringEvent} onChange={(keepScreenAwakeDuringEvent) => update({ keepScreenAwakeDuringEvent })} />
        <ToggleRow title="Confirmation avant suppression" help="Demande une validation avant de supprimer définitivement un média local." value={settings.confirmBeforeDelete} onChange={(confirmBeforeDelete) => update({ confirmBeforeDelete })} />
        <View style={styles.note}><Text style={styles.noteTitle}>Données mobiles</Text><Text style={styles.noteText}>KHE ne bloque pas les données mobiles. Lorsqu’une opération lourde démarre sur réseau cellulaire, l’application peut demander votre accord pour cette opération avant de continuer.</Text></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101010' }, scroll: { padding: 20, paddingBottom: 60, gap: 12 }, header: { flexDirection: 'row', gap: 12 }, brand: { color: '#fff', fontSize: 12, letterSpacing: 3, fontWeight: '900' }, title: { color: '#fff', fontSize: 30, fontWeight: '900' }, help: { color: '#aaa', fontSize: 12, lineHeight: 18 }, close: { borderWidth: 1, borderColor: '#555', borderRadius: 12, padding: 10, alignSelf: 'flex-start' }, closeText: { color: '#fff', fontWeight: '800' }, networkCard: { backgroundColor: '#1b1b1f', borderRadius: 16, padding: 16, gap: 5 }, cardTitle: { color: '#aaa', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 }, networkType: { color: '#fff', fontSize: 24, fontWeight: '900' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#18181c', padding: 15, borderRadius: 16 }, rowTitle: { color: '#fff', fontWeight: '900', marginBottom: 3 }, toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#3b3b40', padding: 3 }, toggleActive: { backgroundColor: '#fff' }, knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#aaa' }, knobActive: { marginLeft: 20, backgroundColor: '#111' }, note: { backgroundColor: '#20262a', borderRadius: 16, padding: 15, gap: 4 }, noteTitle: { color: '#fff', fontWeight: '900' }, noteText: { color: '#bdc7cb', fontSize: 11, lineHeight: 17 },
});