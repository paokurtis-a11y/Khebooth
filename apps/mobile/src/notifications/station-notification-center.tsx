import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  StationExperienceApi,
  StationNotificationContract,
  StationNotificationMailboxAction,
  StationNotificationMailboxState,
} from '../api/station-api';
import type { ReleaseInfo } from '../legal/legal-and-info';

const LEGACY_READ_KEY = 'khe.station.notifications.read.v1';
const MAILBOX_KEY = 'khe.station.notifications.mailbox.v2';
const POLL_MS = 60_000;
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const KHE_GOLD = '#d2ad4f';
const KHE_RED = '#b31520';

type Folder = StationNotificationMailboxState;
type LocalMailboxState = StationNotificationMailboxState | 'PURGED';
type CenterItem = StationNotificationContract & { syntheticUpdate?: boolean };
type LocalMailboxRecord = {
  state: LocalMailboxState;
  readAt: string | null;
  archivedAt: string | null;
  trashedAt: string | null;
  updatedAt: string;
  dirty: boolean;
};
type LocalMailbox = Record<string, LocalMailboxRecord>;

function nowIso(): string { return new Date().toISOString(); }

function normalizeLocalRecord(value: unknown): LocalMailboxRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const state = String(record.state ?? 'ACTIVE') as LocalMailboxState;
  if (!['ACTIVE', 'ARCHIVED', 'TRASHED', 'PURGED'].includes(state)) return null;
  const trashedAt = typeof record.trashedAt === 'string' ? record.trashedAt : null;
  const shouldPurge = state === 'TRASHED' && trashedAt && Date.now() - new Date(trashedAt).getTime() >= TRASH_RETENTION_MS;
  return {
    state: shouldPurge ? 'PURGED' : state,
    readAt: typeof record.readAt === 'string' ? record.readAt : null,
    archivedAt: typeof record.archivedAt === 'string' ? record.archivedAt : null,
    trashedAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : nowIso(),
    dirty: record.dirty === true && !shouldPurge,
  };
}

async function loadLocalMailbox(): Promise<LocalMailbox> {
  const raw = await SecureStore.getItemAsync(MAILBOX_KEY);
  const result: LocalMailbox = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
          const record = normalizeLocalRecord(value);
          if (record) result[id] = record;
        }
      }
    } catch {}
  }

  if (!raw) {
    const legacy = await SecureStore.getItemAsync(LEGACY_READ_KEY);
    if (legacy) {
      try {
        const ids = JSON.parse(legacy) as unknown;
        if (Array.isArray(ids)) {
          for (const id of ids) {
            if (typeof id !== 'string') continue;
            result[id] = { state: 'ACTIVE', readAt: nowIso(), archivedAt: null, trashedAt: null, updatedAt: nowIso(), dirty: false };
          }
        }
      } catch {}
    }
  }
  return result;
}

async function saveLocalMailbox(mailbox: LocalMailbox): Promise<void> {
  const limited = Object.fromEntries(
    Object.entries(mailbox)
      .sort((a, b) => new Date(a[1].updatedAt).getTime() - new Date(b[1].updatedAt).getTime())
      .slice(-500),
  );
  await SecureStore.setItemAsync(MAILBOX_KEY, JSON.stringify(limited), {
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
  if (kind === 'SYSTEM') return 'SYSTÈME';
  return 'KHE NEWS';
}

function stateLabel(state: LocalMailboxState): string {
  if (state === 'ARCHIVED') return 'ARCHIVÉ';
  if (state === 'TRASHED') return 'CORBEILLE';
  return 'CONSERVÉ';
}

function recordFromServer(item: StationNotificationContract): LocalMailboxRecord {
  return {
    state: item.mailboxState ?? 'ACTIVE',
    readAt: item.readAt ? new Date(item.readAt).toISOString() : null,
    archivedAt: item.archivedAt ? new Date(item.archivedAt).toISOString() : null,
    trashedAt: item.trashedAt ? new Date(item.trashedAt).toISOString() : null,
    updatedAt: nowIso(),
    dirty: false,
  };
}

function actionForRecord(record: LocalMailboxRecord): StationNotificationMailboxAction {
  if (record.state === 'TRASHED') return 'TRASH';
  if (record.state === 'ARCHIVED') return 'ARCHIVE';
  if (record.state === 'ACTIVE') return record.readAt ? 'KEEP' : 'READ';
  return 'READ';
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
  const [mailbox, setMailbox] = useState<LocalMailbox>({});
  const [folder, setFolder] = useState<Folder>('ACTIVE');
  const [selected, setSelected] = useState<CenterItem | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { void loadLocalMailbox().then(setMailbox); }, []);

  const refresh = useCallback(async () => {
    try {
      let items = await api.stationNotificationMailbox(stationToken);
      const local = await loadLocalMailbox();
      let changed = false;

      for (const item of items) {
        const pending = local[item.id];
        if (pending?.dirty && pending.state !== 'PURGED') {
          try {
            const synced = await api.updateStationNotification(stationToken, item.id, actionForRecord(pending));
            items = items.map((candidate) => candidate.id === item.id ? synced : candidate);
            local[item.id] = recordFromServer(synced);
            changed = true;
          } catch {
            continue;
          }
        } else if (!pending?.dirty) {
          local[item.id] = recordFromServer(item);
          changed = true;
        }
      }

      if (changed) await saveLocalMailbox(local);
      setMailbox(local);
      setRemote(items);
    } catch {
      // La boîte reste utilisable hors ligne avec les éléments déjà chargés.
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
        mailboxState: 'ACTIVE',
        syntheticUpdate: true,
      });
    }
    return result;
  }, [release, remote]);

  function localRecord(item: CenterItem): LocalMailboxRecord | null {
    return mailbox[item.id] ?? null;
  }

  function effectiveState(item: CenterItem): LocalMailboxState {
    const local = localRecord(item);
    if (item.syntheticUpdate) return local?.state ?? 'ACTIVE';
    if (local?.dirty) return local.state;
    return item.mailboxState ?? local?.state ?? 'ACTIVE';
  }

  function isRead(item: CenterItem): boolean {
    const local = localRecord(item);
    return Boolean(item.readAt || local?.readAt);
  }

  function trashDeadline(item: CenterItem): Date | null {
    if (item.purgeAt) return new Date(item.purgeAt);
    const trashedAt = localRecord(item)?.trashedAt ?? (item.trashedAt ? new Date(item.trashedAt).toISOString() : null);
    return trashedAt ? new Date(new Date(trashedAt).getTime() + TRASH_RETENTION_MS) : null;
  }

  const visibleItems = items.filter((item) => effectiveState(item) === folder);
  const unread = items.filter((item) => effectiveState(item) === 'ACTIVE' && !isRead(item)).length;
  const archivedCount = items.filter((item) => effectiveState(item) === 'ARCHIVED').length;
  const trashCount = items.filter((item) => effectiveState(item) === 'TRASHED').length;

  async function persistLocal(id: string, record: LocalMailboxRecord): Promise<void> {
    const next = { ...mailbox, [id]: record };
    setMailbox(next);
    await saveLocalMailbox(next);
  }

  async function applyAction(item: CenterItem, action: StationNotificationMailboxAction): Promise<void> {
    const previous = localRecord(item) ?? recordFromServer(item);
    const now = nowIso();
    let next: LocalMailboxRecord = { ...previous, updatedAt: now, dirty: !item.syntheticUpdate };

    if (action === 'READ') next = { ...next, readAt: previous.readAt ?? now };
    if (action === 'KEEP' || action === 'RESTORE') next = { ...next, state: 'ACTIVE', readAt: previous.readAt ?? now, archivedAt: null, trashedAt: null };
    if (action === 'ARCHIVE') next = { ...next, state: 'ARCHIVED', readAt: previous.readAt ?? now, archivedAt: now, trashedAt: null };
    if (action === 'TRASH') next = { ...next, state: 'TRASHED', readAt: previous.readAt ?? now, archivedAt: null, trashedAt: now };

    await persistLocal(item.id, next);

    if (!item.syntheticUpdate) {
      try {
        const synced = await api.updateStationNotification(stationToken, item.id, action);
        const serverRecord = recordFromServer(synced);
        await persistLocal(item.id, serverRecord);
        setRemote((current) => current.map((candidate) => candidate.id === item.id ? synced : candidate));
      } catch {
        setMessage('Action conservée sur cette tablette. KHE la synchronisera dès que le réseau sera disponible.');
      }
    }

    if (action !== 'READ') setSelected(null);
  }

  async function openItem(item: CenterItem): Promise<void> {
    setSelected(item);
    if (!isRead(item)) await applyAction(item, 'READ');
  }

  async function openAction(item: CenterItem): Promise<void> {
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
    const active = items.filter((item) => effectiveState(item) === 'ACTIVE' && !isRead(item));
    for (const item of active) await applyAction(item, 'READ');
  }

  const selectedState = selected ? effectiveState(selected) : 'ACTIVE';
  const selectedDeadline = selected ? trashDeadline(selected) : null;
  const remainingDays = selectedDeadline ? Math.max(0, Math.ceil((selectedDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null;

  return (
    <View style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Notifications KHE, ${unread} non lues`} onPress={() => setOpen((value) => !value)} style={[styles.bell, open && styles.bellOpen]}>
        <Text style={styles.bellIcon}>♢</Text>
        <Text style={styles.bellGlyph}>●</Text>
        {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
      </Pressable>

      <Modal transparent visible={open} animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={styles.centerRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer les notifications" style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} />
          <View style={styles.panel}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text style={styles.eyebrow}>KHE BOOTH</Text><Text style={styles.title}>Notifications</Text><Text style={styles.help}>{unread} message{unread === 1 ? '' : 's'} non lu{unread === 1 ? '' : 's'}</Text></View>
          {unread > 0 ? <Pressable onPress={() => void markAllRead()} style={styles.markAll}><Text style={styles.markAllText}>Tout lire</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setOpen(false)} style={styles.panelClose}><Text style={styles.panelCloseText}>×</Text></Pressable>
        </View>

        <View style={styles.tabs}>
          <Pressable onPress={() => setFolder('ACTIVE')} style={[styles.tab, folder === 'ACTIVE' && styles.tabActive]}><Text style={[styles.tabText, folder === 'ACTIVE' && styles.tabTextActive]}>Boîte</Text></Pressable>
          <Pressable onPress={() => setFolder('ARCHIVED')} style={[styles.tab, folder === 'ARCHIVED' && styles.tabActive]}><Text style={[styles.tabText, folder === 'ARCHIVED' && styles.tabTextActive]}>Archives {archivedCount ? `(${archivedCount})` : ''}</Text></Pressable>
          <Pressable onPress={() => setFolder('TRASHED')} style={[styles.tab, folder === 'TRASHED' && styles.tabActive]}><Text style={[styles.tabText, folder === 'TRASHED' && styles.tabTextActive]}>Corbeille {trashCount ? `(${trashCount})` : ''}</Text></Pressable>
        </View>

        {folder === 'TRASHED' ? <Text style={styles.trashHint}>Les messages placés ici sont supprimés définitivement après 30 jours.</Text> : null}

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
          {visibleItems.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>{folder === 'ACTIVE' ? 'Aucune nouvelle information' : folder === 'ARCHIVED' ? 'Aucun message archivé' : 'La corbeille est vide'}</Text><Text style={styles.help}>{folder === 'ACTIVE' ? 'Les actualités, mises à jour et informations importantes KHE apparaîtront ici.' : folder === 'ARCHIVED' ? 'Les messages que vous souhaitez conserver à part apparaîtront ici.' : 'Les messages supprimés restent récupérables pendant 30 jours.'}</Text></View> : visibleItems.map((item) => {
            const read = isRead(item);
            const deadline = folder === 'TRASHED' ? trashDeadline(item) : null;
            const days = deadline ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : null;
            return <Pressable key={item.id} onPress={() => void openItem(item)} style={[styles.item, !read && styles.itemUnread]}>
              <View style={styles.itemHeading}><View style={[styles.dot, read && styles.dotRead]} /><View style={{ flex: 1 }}><Text style={[styles.kind, !read && styles.kindUnread]}>{kindLabel(item.kind)}</Text><Text style={[styles.itemTitle, read && styles.itemTitleRead]}>{item.title}</Text></View>{!read ? <Text style={styles.newText}>NOUVEAU</Text> : <Text style={styles.readText}>LU</Text>}</View>
              <Text numberOfLines={3} style={styles.body}>{item.body}</Text>
              <View style={styles.itemFooter}><Text style={styles.date}>{new Date(item.publishedAt).toLocaleString()}</Text>{days !== null ? <Text style={styles.purgeMini}>Suppression dans {days} j</Text> : <Text style={styles.openHint}>Touchez pour ouvrir</Text>}</View>
            </Pressable>;
          })}
        </ScrollView>
        {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>
        </View>
      </Modal>

      <Modal transparent visible={Boolean(selected)} animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSelected(null)} />
          {selected ? <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}><Text style={styles.eyebrow}>{kindLabel(selected.kind)}</Text><Text style={styles.modalTitle}>{selected.title}</Text></View>
              <Pressable onPress={() => setSelected(null)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <View style={styles.stateRow}><Text style={styles.statePill}>{stateLabel(selectedState)}</Text><Text style={styles.modalDate}>{new Date(selected.publishedAt).toLocaleString()}</Text></View>
            <ScrollView style={styles.modalScroll}><Text style={styles.modalBody}>{selected.body}</Text></ScrollView>
            {selectedState === 'TRASHED' && remainingDays !== null ? <View style={styles.retention}><Text style={styles.retentionTitle}>Corbeille KHE</Text><Text style={styles.retentionText}>Ce message sera supprimé définitivement dans {remainingDays} jour{remainingDays === 1 ? '' : 's'}. Vous pouvez encore le restaurer.</Text></View> : null}
            {safeActionUrl(selected.actionUrl) ? <Pressable style={[styles.primaryAction, selected.kind === 'UPDATE' && styles.downloadAction]} onPress={() => void openAction(selected)}><Text style={styles.primaryActionText}>{selected.kind === 'UPDATE' ? 'TÉLÉCHARGER LA MISE À JOUR' : 'OUVRIR LE LIEN'}</Text><Text style={styles.primaryActionText}>→</Text></Pressable> : null}
            <View style={styles.modalActions}>
              {selectedState === 'TRASHED' ? <Pressable style={styles.keepButton} onPress={() => void applyAction(selected, 'RESTORE')}><Text style={styles.keepText}>RESTAURER</Text></Pressable> : <Pressable style={styles.keepButton} onPress={() => void applyAction(selected, 'KEEP')}><Text style={styles.keepText}>CONSERVER</Text></Pressable>}
              {selectedState === 'ACTIVE' ? <Pressable style={styles.archiveButton} onPress={() => void applyAction(selected, 'ARCHIVE')}><Text style={styles.archiveText}>ARCHIVER</Text></Pressable> : null}
              {selectedState !== 'TRASHED' ? <Pressable style={styles.deleteButton} onPress={() => void applyAction(selected, 'TRASH')}><Text style={styles.deleteText}>SUPPRIMER</Text></Pressable> : null}
            </View>
          </View> : null}
        </View>
      </Modal>
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
  centerRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 28 },
  panel: { width: '100%', maxWidth: 640, maxHeight: '90%', borderRadius: 22, backgroundColor: '#101012', borderWidth: 1, borderColor: '#5a4926', padding: 14, gap: 9, shadowColor: '#000', shadowOpacity: .45, shadowRadius: 18, elevation: 15 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 4 },
  eyebrow: { color: KHE_GOLD, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#fff', fontSize: 21, fontWeight: '900' },
  help: { color: '#929299', fontSize: 10, lineHeight: 15 },
  markAll: { borderWidth: 1, borderColor: KHE_GOLD, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  markAllText: { color: KHE_GOLD, fontSize: 9, fontWeight: '900' },
  panelClose: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#44444a', alignItems: 'center', justifyContent: 'center' },
  panelCloseText: { color: '#fff', fontSize: 21, lineHeight: 23 },
  tabs: { flexDirection: 'row', gap: 5, backgroundColor: '#171719', borderRadius: 12, padding: 4 },
  tab: { flex: 1, minHeight: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabActive: { backgroundColor: '#332913', borderWidth: 1, borderColor: '#665126' },
  tabText: { color: '#7f7f86', fontSize: 8, fontWeight: '900' },
  tabTextActive: { color: KHE_GOLD },
  trashHint: { color: '#9b8f7b', fontSize: 9, lineHeight: 14, paddingHorizontal: 4 },
  list: { flexShrink: 1 },
  listContent: { gap: 8, paddingBottom: 3 },
  item: { backgroundColor: '#18181c', borderRadius: 15, padding: 12, gap: 6, borderWidth: 1, borderColor: '#27272d' },
  itemUnread: { backgroundColor: '#211d14', borderColor: '#6d592e' },
  itemHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, minWidth: 0 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: KHE_GOLD, marginTop: 5 },
  dotRead: { backgroundColor: '#515159' },
  kind: { color: '#898990', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  kindUnread: { color: KHE_GOLD },
  itemTitle: { color: '#fff', fontSize: 13, fontWeight: '900', lineHeight: 18 },
  itemTitleRead: { color: '#bebec4' },
  newText: { color: KHE_RED, fontSize: 8, fontWeight: '900', flexShrink: 0 },
  readText: { color: '#707078', fontSize: 8, fontWeight: '900', flexShrink: 0 },
  body: { color: '#b5b5bb', fontSize: 10, lineHeight: 15 },
  itemFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { color: '#686870', fontSize: 8 },
  openHint: { color: '#8e7b50', fontSize: 8, fontWeight: '800' },
  purgeMini: { color: '#c17676', fontSize: 8, fontWeight: '800' },
  empty: { padding: 15, alignItems: 'center', gap: 5 },
  emptyTitle: { color: '#fff', fontWeight: '900' },
  message: { color: '#d8c69b', fontSize: 9, lineHeight: 14 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 560, maxHeight: '82%', borderRadius: 24, backgroundColor: '#121214', borderWidth: 1, borderColor: '#6c5629', padding: 20, gap: 14, shadowColor: '#000', shadowOpacity: .65, shadowRadius: 28, elevation: 25 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  modalTitle: { color: '#fff', fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 3 },
  close: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#44444a', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 22, lineHeight: 24 },
  stateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statePill: { color: KHE_GOLD, backgroundColor: '#2b2416', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 8, fontWeight: '900', letterSpacing: .7 },
  modalDate: { color: '#75757c', fontSize: 9 },
  modalScroll: { maxHeight: 260 },
  modalBody: { color: '#d7d7dc', fontSize: 14, lineHeight: 22 },
  retention: { backgroundColor: '#261718', borderWidth: 1, borderColor: '#663236', borderRadius: 13, padding: 12, gap: 4 },
  retentionTitle: { color: '#ffb1b1', fontWeight: '900', fontSize: 11 },
  retentionText: { color: '#d6bbbb', fontSize: 10, lineHeight: 16 },
  primaryAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#4d4d55', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12 },
  downloadAction: { backgroundColor: KHE_GOLD, borderColor: KHE_GOLD },
  primaryActionText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: .4 },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  keepButton: { flexGrow: 1, minWidth: 105, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 12, backgroundColor: '#262629', alignItems: 'center' },
  keepText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  archiveButton: { flexGrow: 1, minWidth: 105, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 12, borderWidth: 1, borderColor: KHE_GOLD, alignItems: 'center' },
  archiveText: { color: KHE_GOLD, fontSize: 9, fontWeight: '900' },
  deleteButton: { flexGrow: 1, minWidth: 105, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 12, backgroundColor: '#4d171b', borderWidth: 1, borderColor: '#8c2d35', alignItems: 'center' },
  deleteText: { color: '#ffb9bd', fontSize: 9, fontWeight: '900' },
});
