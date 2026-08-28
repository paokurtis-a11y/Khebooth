import type { MediaAssetContract } from '@khe/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type {
  MediaShareContract,
  SharingBusinessSettingsContract,
  SocialProvider,
  SocialShareContract,
  StationExperienceApi,
} from '../api/station-api';
import { loadAppSettings } from '../settings/app-settings';
import { loadNotificationPreferences, playNotificationFeedback } from '../settings/notification-feedback';
import { SharingMediaPreview } from './sharing-media-preview';
import { listSharingTrash, restoreSharingMedia, trashSharingMediaMany, type SharingTrashItem } from './sharing-trash-client';

interface SharingMediaGalleryProps {
  eventName: string;
  api: StationExperienceApi;
  stationToken: string;
}

const AUTO_SYNC_INTERVAL_MS = 5_000;
const BACKGROUND_DOWNLOAD_BATCH = 3;
const DEFAULT_BUSINESS_SETTINGS: SharingBusinessSettingsContract = {
  socialLinks: {},
  galleryLayout: 'MASONRY',
  portraitColumns: 2,
  landscapeColumns: 3,
  videoAutoplay: true,
  mediaFit: 'COVER',
  updatedAt: new Date(0).toISOString(),
};

const SOCIALS: Array<{ key: SocialProvider; label: string; mark: string; color: string }> = [
  { key: 'WHATSAPP', label: 'WhatsApp', mark: 'W', color: '#25D366' },
  { key: 'INSTAGRAM', label: 'Instagram', mark: '◎', color: '#C13584' },
  { key: 'FACEBOOK', label: 'Facebook', mark: 'f', color: '#1877F2' },
  { key: 'TIKTOK', label: 'TikTok', mark: '♪', color: '#111111' },
  { key: 'X', label: 'X', mark: '𝕏', color: '#111111' },
  { key: 'TELEGRAM', label: 'Telegram', mark: '➤', color: '#229ED9' },
  { key: 'YOUTUBE', label: 'YouTube', mark: '▶', color: '#FF0000' },
];

function extensionFor(media: Pick<MediaAssetContract, 'mimeType'>): string {
  if (media.mimeType === 'image/jpeg') return 'jpg';
  if (media.mimeType === 'image/png') return 'png';
  if (media.mimeType === 'image/webp') return 'webp';
  if (media.mimeType === 'video/quicktime') return 'mov';
  return 'mp4';
}

function canonicalName(media: MediaAssetContract, eventName: string): string {
  const kind = media.mimeType.startsWith('image/') ? 'Photo' : 'Vidéo';
  return media.displayName?.trim() || `KHE ${eventName?.trim() ? `${eventName.trim()} ` : ''}${kind}`.trim();
}

function fileSafeName(value: string): string {
  return value.normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, 120) || 'KHE Moment';
}

function capturedLabel(media: MediaAssetContract): string {
  if (!media.capturedAt) return 'Date inconnue';
  const date = new Date(media.capturedAt);
  return `${date.toLocaleDateString()} • ${date.toLocaleTimeString()}`;
}

function sizeLabel(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} Mo`;
}

function socialKey(mediaId: string, provider: SocialProvider): string {
  return `${mediaId}:${provider}`;
}

function remainingDays(item: SharingTrashItem): number {
  return Math.max(0, Math.ceil((new Date(item.trashExpiresAt).getTime() - Date.now()) / 86_400_000));
}

function SocialMark({ provider, compact = false }: { provider: SocialProvider; compact?: boolean }) {
  const social = SOCIALS.find((item) => item.key === provider) ?? SOCIALS[0];
  return <View style={[styles.socialMark, compact && styles.socialMarkCompact, { backgroundColor: social.color }]}><Text style={[styles.socialMarkText, compact && styles.socialMarkTextCompact]}>{social.mark}</Text></View>;
}

export function SharingMediaGallery({ eventName, api, stationToken }: SharingMediaGalleryProps) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaAssetContract[]>([]);
  const [shares, setShares] = useState<Record<string, MediaShareContract>>({});
  const [socialShares, setSocialShares] = useState<Record<string, SocialShareContract>>({});
  const [activeSocialKey, setActiveSocialKey] = useState<string | null>(null);
  const [localUris, setLocalUris] = useState<Record<string, string>>({});
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});
  const [businessSettings, setBusinessSettings] = useState<SharingBusinessSettingsContract>(DEFAULT_BUSINESS_SETTINGS);
  const [businessEnabled, setBusinessEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashItems, setTrashItems] = useState<SharingTrashItem[]>([]);
  const refreshingRef = useRef(false);
  const receivedIdsRef = useRef(new Set<string>());
  const knownRemoteIdsRef = useRef<Set<string> | null>(null);
  const hasLoadedRef = useRef(false);

  const columns = Math.max(1, landscape ? businessSettings.landscapeColumns : businessSettings.portraitColumns);
  const cardWidth = `${Math.max(22, Math.floor(100 / columns) - 2)}%` as `${number}%`;

  function destinationFor(item: MediaAssetContract): File {
    const directory = new Directory(Paths.document, 'sharing-downloads');
    directory.create({ idempotent: true, intermediates: true });
    return new File(directory, `${item.id}.${extensionFor(item)}`);
  }

  async function shareFileFor(item: MediaAssetContract, source: File): Promise<File> {
    const directory = new Directory(Paths.cache, 'sharing-exports');
    await directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, `${fileSafeName(canonicalName(item, eventName))}.${extensionFor(item)}`);
    if (destination.exists) destination.delete();
    await source.copy(destination);
    return destination;
  }

  function rememberLocal(item: MediaAssetContract, file: File): void {
    receivedIdsRef.current.add(item.id);
    setLocalUris((current) => current[item.id] === file.uri ? current : { ...current, [item.id]: file.uri });
  }

  async function downloadMedia(item: MediaAssetContract): Promise<File> {
    const destination = destinationFor(item);
    if (destination.exists && destination.size === item.byteSize) {
      rememberLocal(item, destination);
      return destination;
    }
    if (destination.exists) destination.delete();
    const ticket = await api.mediaDownload(stationToken, item.id);
    if (ticket.mediaId !== item.id || !ticket.downloadUrl) throw new Error('Le ticket de téléchargement ne correspond pas au média demandé.');
    const downloaded = await File.downloadFileAsync(ticket.downloadUrl, destination, { idempotent: true });
    if (!downloaded.exists) throw new Error('Le média n’a pas été enregistré sur la tablette SHARING.');
    if (downloaded.size !== item.byteSize) {
      const actualSize = downloaded.size;
      downloaded.delete();
      throw new Error(`Le média reçu est incomplet : ${actualSize} octets sur ${item.byteSize}.`);
    }
    rememberLocal(item, downloaded);
    return downloaded;
  }

  async function refresh(manual = false): Promise<void> {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const items = await api.listMedia(stationToken);
      const synced = items.filter((item) => item.syncState === 'SYNCED' && Boolean(item.acknowledgedAt)).sort((left, right) => {
        const leftTime = left.capturedAt ? new Date(left.capturedAt).getTime() : 0;
        const rightTime = right.capturedAt ? new Date(right.capturedAt).getTime() : 0;
        return rightTime - leftTime;
      });
      setMedia(synced);
      const previousRemoteIds = knownRemoteIdsRef.current;
      const newRemoteItems = previousRemoteIds ? synced.filter((item) => !previousRemoteIds.has(item.id)) : [];
      knownRemoteIdsRef.current = new Set(synced.map((item) => item.id));
      let downloadedInBackground = 0;
      for (const item of synced) {
        if (downloadedInBackground >= BACKGROUND_DOWNLOAD_BATCH) break;
        if (receivedIdsRef.current.has(item.id)) continue;
        try { await downloadMedia(item); downloadedInBackground += 1; } catch {}
      }
      setLastSyncAt(new Date());
      if (newRemoteItems.length > 0) {
        const preferences = await loadNotificationPreferences();
        await playNotificationFeedback(preferences);
      }
      if (manual) {
        setMessage(newRemoteItems.length > 0
          ? `${newRemoteItems.length} nouveau${newRemoteItems.length === 1 ? '' : 'x'} média${newRemoteItems.length === 1 ? '' : 's'} reçu${newRemoteItems.length === 1 ? '' : 's'} sur SHARING.`
          : 'Synchronisation actualisée. KHE continue de surveiller automatiquement les nouveaux médias.');
      } else if (newRemoteItems.length > 0) {
        setMessage(`${newRemoteItems.length} nouveau${newRemoteItems.length === 1 ? '' : 'x'} Moment${newRemoteItems.length === 1 ? '' : 's'} KHE reçu${newRemoteItems.length === 1 ? '' : 's'} automatiquement.`);
      }
    } catch (error) {
      if (manual || !hasLoadedRef.current) setMessage(error instanceof Error ? error.message : 'Impossible de charger les médias synchronisés.');
    } finally { hasLoadedRef.current = true; refreshingRef.current = false; setLoading(false); }
  }

  async function loadTrash(): Promise<void> {
    if (!businessEnabled) return;
    try { setTrashItems(await listSharingTrash(stationToken)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de charger la corbeille.'); }
  }

  useEffect(() => {
    let cancelled = false;
    void api.sharingBusinessSettings(stationToken).then((settings) => {
      if (!cancelled) { setBusinessSettings({ ...DEFAULT_BUSINESS_SETTINGS, ...settings }); setBusinessEnabled(true); }
    }).catch(() => { if (!cancelled) setBusinessEnabled(false); });
    return () => { cancelled = true; };
  }, [api, stationToken]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [api, stationToken]);

  useEffect(() => { if (trashOpen && businessEnabled) void loadTrash(); }, [trashOpen, businessEnabled]);

  const counts = useMemo(() => ({
    photos: media.filter((item) => item.mimeType.startsWith('image/')).length,
    videos: media.filter((item) => item.mimeType.startsWith('video/')).length,
  }), [media]);

  async function share(item: MediaAssetContract): Promise<void> {
    setBusyId(item.id); setMessage('');
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage natif n’est pas disponible sur cette tablette.');
      const downloaded = await downloadMedia(item);
      const named = await shareFileFor(item, downloaded);
      await Sharing.shareAsync(named.uri, { dialogTitle: canonicalName(item, eventName), mimeType: item.mimeType || undefined });
      setMessage(`Partage ouvert pour « ${canonicalName(item, eventName)} » : choisissez WhatsApp, TikTok, Facebook, Instagram, X, Telegram, YouTube ou une autre application.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Partage impossible.'); }
    finally { setBusyId(null); }
  }

  async function createGuestQr(item: MediaAssetContract): Promise<void> {
    setBusyId(item.id); setMessage('');
    try {
      const next = await api.createMediaShare(stationToken, item.id);
      if (!next.shareUrl.startsWith('https://')) throw new Error('Le lien invité sécurisé reçu est invalide.');
      setShares((current) => ({ ...current, [item.id]: next })); setActiveSocialKey(null);
      setMessage(`QR invité créé pour « ${canonicalName(item, eventName)} ».`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de créer le QR invité.'); }
    finally { setBusyId(null); }
  }

  async function createSocialQr(item: MediaAssetContract, provider: SocialProvider): Promise<void> {
    if (!businessEnabled) { setMessage('Le partage social automatisé nécessite l’abonnement BUSINESS ou supérieur.'); return; }
    const key = socialKey(item.id, provider); setBusyId(item.id); setMessage('');
    try {
      const existing = socialShares[key]; const next = existing ?? await api.createSocialShare(stationToken, item.id, provider);
      if (!next.shareUrl.startsWith('https://')) throw new Error('Le lien social sécurisé reçu est invalide.');
      if (!existing) setSocialShares((current) => ({ ...current, [key]: next }));
      setActiveSocialKey(key); setMessage(`QR ${SOCIALS.find((social) => social.key === provider)?.label ?? provider} prêt pour « ${canonicalName(item, eventName)} ».`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de créer le QR social.'); }
    finally { setBusyId(null); }
  }

  async function revokeGuestQr(item: MediaAssetContract): Promise<void> {
    const currentShare = shares[item.id]; if (!currentShare) return; setBusyId(item.id); setMessage('');
    try { await api.revokeMediaShare(stationToken, currentShare.id); setShares((current) => { const next = { ...current }; delete next[item.id]; return next; }); setMessage('Lien invité révoqué. L’ancien QR ne donne plus accès au média.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Impossible de révoquer le QR invité.'); }
    finally { setBusyId(null); }
  }

  function removeFromActive(ids:string[]):void {
    const idSet=new Set(ids);
    setMedia((current)=>current.filter((entry)=>!idSet.has(entry.id)));
    setShares((current)=>Object.fromEntries(Object.entries(current).filter(([key])=>!idSet.has(key))));
    setSocialShares((current)=>Object.fromEntries(Object.entries(current).filter(([key])=>!ids.some((id)=>key.startsWith(`${id}:`)))));
    ids.forEach((id)=>receivedIdsRef.current.delete(id));
    if(activeSocialKey&&ids.some((id)=>activeSocialKey.startsWith(`${id}:`)))setActiveSocialKey(null);
  }

  async function performDelete(item: MediaAssetContract): Promise<void> {
    setBusyId(item.id); setMessage('');
    try { await api.deleteSharingMedia(stationToken, item.id); removeFromActive([item.id]); setMessage(`« ${canonicalName(item,eventName)} » a été déplacé dans la corbeille. Il sera conservé 30 jours avant suppression automatique.`); if(trashOpen)await loadTrash(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Suppression impossible.'); }
    finally { setBusyId(null); }
  }

  async function deleteMoment(item: MediaAssetContract): Promise<void> {
    if (!businessEnabled) { setMessage('La corbeille SHARING nécessite l’abonnement BUSINESS ou supérieur.'); return; }
    const settings = await loadAppSettings();
    if (!settings.confirmBeforeDelete) { await performDelete(item); return; }
    Alert.alert('Déplacer ce Moment dans la corbeille ?', 'Le média disparaîtra des Moments disponibles mais restera récupérable pendant 30 jours. Après ce délai, KHE le supprimera automatiquement.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Mettre à la corbeille', style: 'destructive', onPress: () => void performDelete(item) },
    ]);
  }

  function toggleSelection(id:string){setSelectedIds((current)=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});}

  async function deleteSelection():Promise<void>{
    const ids=[...selectedIds];if(!ids.length)return;
    Alert.alert('Mettre les Moments sélectionnés dans la corbeille ?',`${ids.length} média${ids.length===1?'':'s'} seront conservés pendant 30 jours et pourront être restaurés pendant ce délai.`,[
      {text:'Annuler',style:'cancel'},
      {text:'Mettre à la corbeille',style:'destructive',onPress:()=>void(async()=>{setBusyId('batch');try{await trashSharingMediaMany(stationToken,ids);removeFromActive(ids);setSelectedIds(new Set());setSelectionMode(false);setMessage(`${ids.length} Moment${ids.length===1?'':'s'} déplacé${ids.length===1?'':'s'} dans la corbeille pour 30 jours.`);if(trashOpen)await loadTrash();}catch(error){setMessage(error instanceof Error?error.message:'Suppression multiple impossible.');}finally{setBusyId(null);}})()},
    ]);
  }

  async function restoreTrash(item:SharingTrashItem):Promise<void>{
    setBusyId(item.id);try{await restoreSharingMedia(stationToken,item.id);setTrashItems((current)=>current.filter((entry)=>entry.id!==item.id));setMessage(`« ${item.displayName||'Moment KHE'} » a été restauré.`);await refresh(true);}catch(error){setMessage(error instanceof Error?error.message:'Restauration impossible.');}finally{setBusyId(null);}
  }

  function rememberAspect(itemId: string, ratio: number): void {
    const safe = Number.isFinite(ratio) && ratio > 0 ? Math.max(.4, Math.min(2.4, ratio)) : 1;
    setAspectRatios((current) => Math.abs((current[itemId] ?? 0) - safe) < .01 ? current : { ...current, [itemId]: safe });
  }

  function previewHeight(itemId: string): number {
    if (businessSettings.galleryLayout === 'COMPACT') return landscape ? 140 : 165;
    if (businessSettings.galleryLayout === 'GRID') return landscape ? 190 : 220;
    const ratio = aspectRatios[itemId] ?? .8;
    if (ratio < .78) return landscape ? 285 : 330;
    if (ratio > 1.3) return landscape ? 175 : 195;
    return landscape ? 220 : 255;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>GALERIE SHARING • SYNCHRONISATION AUTOMATIQUE</Text>
          <Text style={styles.title}>Moments disponibles</Text>
          <Text style={styles.help}>{eventName} • {media.length} média{media.length === 1 ? '' : 's'} • {counts.videos} vidéo{counts.videos === 1 ? '' : 's'} • {counts.photos} photo{counts.photos === 1 ? '' : 's'}</Text>
          <Text style={styles.autoSync}>● Synchronisation auto active toutes les 2 s{lastSyncAt ? ` • dernière vérification ${lastSyncAt.toLocaleTimeString()}` : ''}</Text>
          <Text style={styles.layoutHint}>{businessEnabled ? `BUSINESS • ${businessSettings.galleryLayout} • ${columns} colonne${columns === 1 ? '' : 's'} • corbeille 30 jours` : 'Galerie standard • options sociales Business verrouillées'}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable disabled={loading} style={styles.refreshButton} onPress={() => void refresh(true)}><Text style={styles.refreshText}>{loading ? '…' : 'Actualiser'}</Text></Pressable>
          {businessEnabled?<Pressable style={[styles.refreshButton,selectionMode&&styles.goldButton]} onPress={()=>{setSelectionMode((current)=>!current);setSelectedIds(new Set());}}><Text style={[styles.refreshText,selectionMode&&styles.goldButtonText]}>{selectionMode?'Annuler sélection':'Sélectionner'}</Text></Pressable>:null}
          {businessEnabled?<Pressable style={[styles.refreshButton,trashOpen&&styles.goldButton]} onPress={()=>setTrashOpen((current)=>!current)}><Text style={[styles.refreshText,trashOpen&&styles.goldButtonText]}>Corbeille {trashItems.length?`(${trashItems.length})`:''}</Text></Pressable>:null}
        </View>
      </View>

      {selectionMode?<View style={styles.selectionBar}><Text style={styles.selectionText}>{selectedIds.size} sélectionné{selectedIds.size===1?'':'s'}</Text><Pressable disabled={!selectedIds.size||busyId==='batch'} style={[styles.deleteSelectionButton,(!selectedIds.size||busyId==='batch')&&styles.disabled]} onPress={()=>void deleteSelection()}><Text style={styles.deleteSelectionText}>{busyId==='batch'?'Déplacement…':'Mettre à la corbeille'}</Text></Pressable></View>:null}

      {trashOpen&&businessEnabled?<View style={styles.trashPanel}><View style={styles.trashHeading}><View><Text style={styles.eyebrow}>BUSINESS • CORBEILLE</Text><Text style={styles.trashTitle}>Médias supprimés</Text></View><Text style={styles.trashHint}>Conservation automatique : 30 jours</Text></View>{trashItems.length===0?<Text style={styles.help}>La corbeille est vide.</Text>:trashItems.map((item)=><View key={item.id} style={styles.trashRow}><View style={{flex:1}}><Text style={styles.trashName}>{item.displayName||'Moment KHE'}</Text><Text style={styles.help}>{item.mimeType.startsWith('image/')?'PHOTO':'VIDÉO'} • {sizeLabel(item.byteSize)} • encore {remainingDays(item)} jour{remainingDays(item)===1?'':'s'}</Text></View><Pressable disabled={Boolean(busyId)} style={styles.restoreButton} onPress={()=>void restoreTrash(item)}><Text style={styles.restoreText}>Restaurer</Text></Pressable></View>)}</View>:null}

      {loading && media.length === 0 ? (
        <View style={styles.loading}><ActivityIndicator /><Text style={styles.help}>Recherche et réception automatiques des médias…</Text></View>
      ) : media.length === 0 ? (
        <View style={styles.emptyCard}><Text style={styles.emptyTitle}>En attente des premières captures</Text><Text style={styles.help}>Dès qu’un média CAPTURE est vérifié dans le stockage KHE et passe à SYNCED, SHARING le récupère automatiquement.</Text></View>
      ) : (
        <View style={styles.galleryGrid}>
          {media.map((item) => {
            const busy = busyId === item.id;
            const kind = item.mimeType.startsWith('image/') ? 'PHOTO' : 'VIDÉO';
            const guestShare = shares[item.id];
            const received = receivedIdsRef.current.has(item.id);
            const activeSocial = activeSocialKey?.startsWith(`${item.id}:`) ? socialShares[activeSocialKey] : undefined;
            const activeProvider = activeSocial?.provider;
            const selected=selectedIds.has(item.id);
            return (
              <View key={item.id} style={[styles.mediaCard,{ width: cardWidth },selected&&styles.mediaCardSelected]}>
                {selectionMode?<Pressable onPress={()=>toggleSelection(item.id)} style={[styles.selectControl,selected&&styles.selectControlActive]}><Text style={[styles.selectControlText,selected&&styles.selectControlTextActive]}>{selected?'✓':'○'} {selected?'Sélectionné':'Sélectionner'}</Text></Pressable>:null}
                <View style={[styles.previewFrame, { height: previewHeight(item.id) }]}>
                  <SharingMediaPreview uri={localUris[item.id] ?? null} mimeType={item.mimeType} autoplay={businessEnabled ? businessSettings.videoAutoplay : true} mediaFit={businessEnabled ? businessSettings.mediaFit : 'COVER'} onAspectRatio={(ratio) => rememberAspect(item.id, ratio)} />
                  <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>{kind}</Text></View>
                </View>
                <View style={styles.mediaTopRow}>
                  <View style={styles.mediaCopy}><Text style={styles.mediaName} numberOfLines={2}>{canonicalName(item,eventName)}</Text><Text style={styles.meta}>{capturedLabel(item)}</Text><Text style={styles.meta}>{sizeLabel(item.byteSize)}</Text></View>
                  <View style={styles.syncedBadge}><Text style={styles.syncedText}>{received ? 'REÇU ✓' : 'SYNCED ✓'}</Text></View>
                </View>
                {!selectionMode?<>
                  <View style={styles.actions}>
                    <Pressable disabled={Boolean(busyId)} style={[styles.primaryButton, Boolean(busyId) && styles.disabled]} onPress={() => void share(item)}><Text style={styles.primaryText}>{busy ? 'Préparation…' : 'Partager'}</Text></Pressable>
                    <Pressable disabled={Boolean(busyId)} style={[styles.qrButton, Boolean(busyId) && styles.disabled]} onPress={() => void createGuestQr(item)}><Text style={styles.qrButtonText}>{guestShare ? 'Nouveau QR' : 'QR invité'}</Text></Pressable>
                    <Pressable disabled={Boolean(busyId) || !businessEnabled} style={[styles.deleteButton, (!businessEnabled || Boolean(busyId)) && styles.disabled]} onPress={() => void deleteMoment(item)}><Text style={styles.deleteText}>Corbeille</Text></Pressable>
                  </View>
                  <View style={styles.socialSection}><Text style={styles.socialTitle}>PARTAGER VIA UN RÉSEAU</Text><View style={styles.socialButtons}>{SOCIALS.map((social) => {const configured = Boolean(businessSettings.socialLinks[social.key]);return <Pressable key={social.key} disabled={Boolean(busyId) || !businessEnabled} onPress={() => void createSocialQr(item, social.key)} style={[styles.socialButton, (!businessEnabled || !configured) && styles.socialButtonMuted]}><SocialMark provider={social.key} compact /><Text style={styles.socialButtonText}>{social.label}</Text></Pressable>;})}</View>{businessEnabled ? <Text style={styles.socialHelp}>Les réseaux configurés dans Paramètres SHARING sont prioritaires. KHE conserve le même nom du média jusqu’à sa réception.</Text> : <Text style={styles.socialHelp}>Disponible avec BUSINESS.</Text>}</View>
                  {activeSocial && activeProvider ? <View style={styles.socialQrCard}><View style={styles.socialQrHeading}><SocialMark provider={activeProvider} /><View style={{ flex: 1 }}><Text style={styles.socialQrTitle}>{SOCIALS.find((social) => social.key === activeProvider)?.label}</Text><Text style={styles.socialHelp}>{canonicalName(item,eventName)}</Text></View></View><View style={styles.qrLogoFrame}><QRCode value={activeSocial.shareUrl} size={190} ecl="H" quietZone={8} /><View pointerEvents="none" style={styles.qrLogoOverlay}><SocialMark provider={activeProvider} /></View></View><Text selectable style={styles.shareUrl}>{activeSocial.shareUrl}</Text><View style={styles.consentNote}><Text style={styles.consentTitle}>Consentement en 3 étapes</Text><Text style={styles.socialHelp}>1. recevoir ce média • 2. autoriser ou non sa publication • 3. accepter ou non les messages promotionnels KHE. Les choix 2 et 3 restent facultatifs.</Text></View></View> : null}
                  {guestShare ? <View style={styles.qrCard}><View style={styles.qrCanvas}><QRCode value={guestShare.shareUrl} size={160} ecl="H" quietZone={6} /></View><Text style={styles.qrMomentName}>{canonicalName(item,eventName)}</Text><Text selectable style={styles.shareUrl}>{guestShare.shareUrl}</Text><Pressable disabled={Boolean(busyId)} style={styles.revokeButton} onPress={() => void revokeGuestQr(item)}><Text style={styles.revokeText}>Révoquer ce QR</Text></Pressable></View> : null}
                </>:null}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.qrNote}><Text style={styles.qrTitle}>Réception automatique SHARING</Text><Text style={styles.help}>Chaque nouveau média synchronisé est reçu automatiquement avec le son/vibration choisis dans Paramètres. Son nom KHE reste stable jusqu’au partage au client. Les médias placés dans la corbeille Business restent restaurables 30 jours.</Text></View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: '#dddddd', paddingTop: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  headerCopy: { flex: 1, minWidth: 220, gap: 3 }, headerActions:{flexDirection:'row',flexWrap:'wrap',gap:6,justifyContent:'flex-end'},
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, opacity: 0.55 }, title: { fontSize: 20, fontWeight: '900' }, help: { fontSize: 11, lineHeight: 16, opacity: 0.65 },
  autoSync: { fontSize: 10, lineHeight: 15, color: '#16863a', fontWeight: '800', marginTop: 3 }, layoutHint: { fontSize: 9, lineHeight: 14, color: '#8b6819', fontWeight: '900' },
  refreshButton: { borderWidth: 1, borderColor: '#111111', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 }, refreshText: { fontSize: 10, fontWeight: '900' }, goldButton:{backgroundColor:'#d2ad4f',borderColor:'#d2ad4f'},goldButtonText:{color:'#111'},
  selectionBar:{borderRadius:13,backgroundColor:'#141414',padding:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},selectionText:{color:'#fff',fontSize:11,fontWeight:'900'},deleteSelectionButton:{backgroundColor:'#a53b3b',paddingHorizontal:12,paddingVertical:9,borderRadius:9},deleteSelectionText:{color:'#fff',fontSize:9,fontWeight:'900'},
  trashPanel:{backgroundColor:'#171717',borderRadius:16,padding:13,gap:9,borderWidth:1,borderColor:'#3b3320'},trashHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},trashTitle:{color:'#fff',fontSize:17,fontWeight:'900'},trashHint:{color:'#d2ad4f',fontSize:9,fontWeight:'900'},trashRow:{backgroundColor:'#222',borderRadius:12,padding:10,flexDirection:'row',alignItems:'center',gap:8},trashName:{color:'#fff',fontSize:11,fontWeight:'900'},restoreButton:{borderWidth:1,borderColor:'#d2ad4f',borderRadius:9,paddingHorizontal:10,paddingVertical:8},restoreText:{color:'#d2ad4f',fontSize:9,fontWeight:'900'},
  loading: { alignItems: 'center', gap: 8, paddingVertical: 20 }, emptyCard: { borderWidth: 1, borderColor: '#dddddd', borderRadius: 14, padding: 14, gap: 5 }, emptyTitle: { fontSize: 14, fontWeight: '900' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, mediaCard: { minWidth: 180, borderWidth: 1, borderColor: '#d7d7d7', borderRadius: 16, padding: 10, gap: 10, overflow: 'hidden' },mediaCardSelected:{borderColor:'#d2ad4f',borderWidth:2,backgroundColor:'#fffaf0'},
  selectControl:{borderWidth:1,borderColor:'#bbb',borderRadius:9,paddingVertical:7,paddingHorizontal:9,alignItems:'center'},selectControlActive:{backgroundColor:'#d2ad4f',borderColor:'#d2ad4f'},selectControlText:{fontSize:9,fontWeight:'900'},selectControlTextActive:{color:'#111'},
  previewFrame: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#151519', position: 'relative' }, previewBadge: { position: 'absolute', left: 8, top: 8, backgroundColor: 'rgba(0,0,0,.68)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 }, previewBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  mediaTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, mediaCopy: { flex: 1, gap: 2 },mediaName:{fontSize:11,fontWeight:'900',lineHeight:15}, meta: { fontSize: 9, lineHeight: 14, opacity: 0.62 }, syncedBadge: { backgroundColor: '#e7f7ec', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 5 }, syncedText: { color: '#16863a', fontSize: 8, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, primaryButton: { flexGrow: 1, minWidth: 82, backgroundColor: '#111111', borderRadius: 9, paddingVertical: 9, alignItems: 'center' }, primaryText: { color: '#ffffff', fontSize: 9, fontWeight: '900' }, qrButton: { flexGrow: 1, minWidth: 82, borderWidth: 1, borderColor: '#16863a', borderRadius: 9, paddingVertical: 9, alignItems: 'center' }, qrButtonText: { color: '#16863a', fontSize: 9, fontWeight: '900' }, deleteButton: { flexGrow: 1, minWidth: 82, borderWidth: 1, borderColor: '#a53b3b', borderRadius: 9, paddingVertical: 9, alignItems: 'center' }, deleteText: { color: '#a53b3b', fontSize: 9, fontWeight: '900' }, disabled: { opacity: 0.4 },
  socialSection: { borderTopWidth: 1, borderTopColor: '#e6e6e6', paddingTop: 9, gap: 7 }, socialTitle: { fontSize: 8, fontWeight: '900', letterSpacing: 1, opacity: .6 }, socialButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, socialButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#d7d7d7', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 7, backgroundColor: '#fff' }, socialButtonMuted: { opacity: .45 }, socialButtonText: { fontSize: 8, fontWeight: '900' }, socialHelp: { fontSize: 9, lineHeight: 14, opacity: .62 },
  socialMark: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }, socialMarkCompact: { width: 20, height: 20, borderRadius: 6, borderWidth: 1 }, socialMarkText: { color: '#fff', fontSize: 17, fontWeight: '900' }, socialMarkTextCompact: { fontSize: 10 },
  socialQrCard: { alignItems: 'center', gap: 9, backgroundColor: '#f6f6f8', borderRadius: 14, padding: 11 }, socialQrHeading: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 9 }, socialQrTitle: { fontSize: 14, fontWeight: '900' }, qrLogoFrame: { width: 206, height: 206, alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundColor: '#fff', borderRadius: 14 }, qrLogoOverlay: { position: 'absolute', left: 86, top: 86, backgroundColor: '#fff', borderRadius: 12, padding: 1 }, consentNote: { width: '100%', backgroundColor: '#fff', borderRadius: 10, padding: 9, gap: 3 }, consentTitle: { fontSize: 9, fontWeight: '900' },
  qrCard: { alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#e4e4e4', paddingTop: 10 }, qrCanvas: { backgroundColor: '#ffffff', padding: 8, borderRadius: 12 },qrMomentName:{fontSize:10,fontWeight:'900',textAlign:'center'}, shareUrl: { fontSize: 8, lineHeight: 12, textAlign: 'center', opacity: 0.7 }, revokeButton: { borderWidth: 1, borderColor: '#a53b3b', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 }, revokeText: { color: '#a53b3b', fontSize: 9, fontWeight: '900' },
  qrNote: { borderWidth: 1, borderColor: '#d7d7d7', borderRadius: 14, padding: 12, gap: 4 }, qrTitle: { fontSize: 12, fontWeight: '900' }, message: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
});
