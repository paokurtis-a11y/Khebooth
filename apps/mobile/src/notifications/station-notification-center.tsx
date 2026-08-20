import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StationExperienceApi, StationNotificationContract } from '../api/station-api';
import type { ReleaseInfo } from '../legal/legal-and-info';

const READ_KEY = 'khe.station.notifications.read.v1';
const POLL_MS = 60_000;
const KHE_GOLD = '#d2ad4f';
const KHE_RED = '#b31520';

type CenterItem = StationNotificationContract & { syntheticUpdate?: boolean };

async function loadReadIds(): Promise<Set<string>> {
  const raw = await SecureStore.getItemAsync(READ_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

async function saveReadIds(ids: Set<string>): Promise<void> {
  await SecureStore.setItemAsync(READ_KEY, JSON.stringify([...ids].slice(-300)), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

function safeActionUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

function kindLabel(kind: string): string {
  if (kind === 'UPDATE') return 'MISE À JOUR';
  if (kind === 'SUPPORT') return 'SUPPORT';
  if (kind === 'SECURITY') return 'SÉCURITÉ';
  return 'KHE NEWS';
}

export function StationNotificationCenter({
  api,
  stationToken,
  release,
}: {
  api: StationExperienceApi;
  stationToken: string;
  release: ReleaseInfo;
}) {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<StationNotificationContract[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  useEffect(() => { void loadReadIds().then(setReadIds); }, []);

  const refresh = useCallback(async () => {
    try {
      const items = await api.stationNotifications(stationToken);
      setRemote(items);
    } catch {
      // La cloche reste utilisable hors ligne avec les éléments déjà chargés.
    }
  }, [api, stationToken]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const items = useMemo<CenterItem[]>(() => {
    const result: CenterItem[] = [...remote];
    if (release.updateAvailable) {
      result.unshift({
        id: `mobile-update-${release.latestVersion}`,
        kind: 'UPDATE',
        title: `KHE Booth ${release.latestVersion} est disponible`,
        body: release.releaseNotes || 'Installez la nouvelle version pour profiter des nouvelles fonctionnalités et améliorations KHE Booth.',
        actionUrl: release.installUrl ?? null,
        publishedAt: new Date().toISOString(),
        syntheticUpdate: true,
      });
    }
    return result;
  }, [release, remote]);

  const unread = items.filter((item) => !readIds.has(item.id)).length;

  async function markRead(id: string): Promise<void> {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    await saveReadIds(next);
  }

  async function openItem(item: CenterItem): Promise<void> {
    await markRead(item.id);
    const url = safeActionUrl(item.actionUrl);
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      setMessage('Ce lien ne peut pas être ouvert sur cette tablette.');
      return;
    }
    await Linking.openURL(url);
  }

  async function markAllRead(): Promise<void> {
    const next = new Set(readIds);
    items.forEach((item) => next.add(item.id));
    setReadIds(next);
    await saveReadIds(next);
  }

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Notifications KHE, ${unread} non lues`} onPress={() => setOpen((value) => !value)} style={[styles.bell, open && styles.bellOpen]}>
        <Text style={styles.bellIcon}>♢</Text>
        <Text style={styles.bellGlyph}>●</Text>
        {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
      </Pressable>

      {open ? <View style={styles.panel}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={styles.eyebrow}>KHE BOOTH</Text><Text style={styles.title}>Notifications</Text><Text style={styles.help}>{unread} message{unread === 1 ? '' : 's'} non lu{unread === 1 ? '' : 's'}</Text></View>
          {unread > 0 ? <Pressable onPress={() => void markAllRead()} style={styles.markAll}><Text style={styles.markAllText}>Tout lire</Text></Pressable> : null}
        </View>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
          {items.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>Aucune nouvelle information</Text><Text style={styles.help}>Les actualités, mises à jour et informations importantes KHE apparaîtront ici.</Text></View> : items.map((item) => {
            const isRead = readIds.has(item.id);
            const actionUrl = safeActionUrl(item.actionUrl);
            return <Pressable key={item.id} onPress={() => void openItem(item)} style={[styles.item, !isRead && styles.itemUnread]}>
              <View style={styles.itemHeading}><View style={[styles.dot, isRead && styles.dotRead]} /><View style={{ flex: 1 }}><Text style={[styles.kind, !isRead && styles.kindUnread]}>{kindLabel(item.kind)}</Text><Text style={[styles.itemTitle, isRead && styles.itemTitleRead]}>{item.title}</Text></View>{!isRead ? <Text style={styles.newText}>NOUVEAU</Text> : <Text style={styles.readText}>LU</Text>}</View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.date}>{new Date(item.publishedAt).toLocaleString()}</Text>
              {actionUrl ? <View style={[styles.action, item.syntheticUpdate && styles.updateAction]}><Text style={styles.actionText}>{item.syntheticUpdate ? 'TÉLÉCHARGER LA MISE À JOUR' : 'OUVRIR'}</Text><Text style={styles.actionArrow}>→</Text></View> : null}
            </Pressable>;
          })}
        </ScrollView>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', zIndex: 50 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#171719', borderWidth: 1, borderColor: '#47423a', alignItems: 'center', justifyContent: 'center' },
  bellOpen: { borderColor: KHE_GOLD, backgroundColor: '#211d14' },
  bellIcon: { color: '#fff', fontSize: 24, transform: [{ rotate: '180deg' }] },
  bellGlyph: { position: 'absolute', color: KHE_GOLD, fontSize: 7, top: 9 },
  badge: { position: 'absolute', right: -4, top: -4, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, backgroundColor: KHE_RED, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#101010' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  panel: { position: 'absolute', right: 0, top: 52, width: 340, maxHeight: 500, borderRadius: 22, backgroundColor: '#101012', borderWidth: 1, borderColor: '#5a4926', padding: 12, gap: 10, shadowColor: '#000', shadowOpacity: .45, shadowRadius: 18, elevation: 15 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 4 },
  eyebrow: { color: KHE_GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#fff', fontSize: 21, fontWeight: '900' },
  help: { color: '#929299', fontSize: 10, lineHeight: 15 },
  markAll: { borderWidth: 1, borderColor: KHE_GOLD, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  markAllText: { color: KHE_GOLD, fontSize: 9, fontWeight: '900' },
  list: { maxHeight: 405 },
  listContent: { gap: 8, paddingBottom: 3 },
  item: { backgroundColor: '#18181c', borderRadius: 15, padding: 12, gap: 6, borderWidth: 1, borderColor: '#27272d' },
  itemUnread: { backgroundColor: '#211d14', borderColor: '#6d592e' },
  itemHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: KHE_GOLD, marginTop: 5 },
  dotRead: { backgroundColor: '#515159' },
  kind: { color: '#898990', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  kindUnread: { color: KHE_GOLD },
  itemTitle: { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 18 },
  itemTitleRead: { color: '#bebec4' },
  newText: { color: KHE_RED, fontSize: 8, fontWeight: '900' },
  readText: { color: '#707078', fontSize: 8, fontWeight: '900' },
  body: { color: '#b5b5bb', fontSize: 10, lineHeight: 15 },
  date: { color: '#686870', fontSize: 8 },
  action: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#4d4d55', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  updateAction: { backgroundColor: KHE_GOLD, borderColor: KHE_GOLD },
  actionText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: .4 },
  actionArrow: { color: '#fff', fontWeight: '900' },
  empty: { padding: 15, alignItems: 'center', gap: 5 },
  emptyTitle: { color: '#fff', fontWeight: '900' },
  message: { color: '#d8c69b', fontSize: 9, lineHeight: 14 },
});
