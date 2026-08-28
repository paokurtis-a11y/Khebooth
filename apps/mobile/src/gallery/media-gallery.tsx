import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { HttpStationApi } from '../api/station-api';
import { API_BASE_URL } from '../config';
import type { LocalStore } from '../offline/local-store';
import type { LocalMediaRecord, LocalRenderJob } from '../offline/types';
import { SecureStoreCredentialVault } from '../security/secure-store-vault';
import { shareMediaNatively } from '../sharing/native-share';
import { StationLinkHealth } from '../station/station-link-health';
import { rescheduleMediaNow } from '../sync/sync-rescue';

interface MediaGalleryProps {
  eventId: string;
  eventName: string;
  store: LocalStore;
  onClose: () => void;
}

type MediaFilter = 'ALL' | 'PHOTO' | 'VIDEO';

function isPhoto(media: LocalMediaRecord): boolean {
  return media.mimeType.startsWith('image/');
}

function SelectedVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={styles.viewerMedia} nativeControls contentFit="contain" surfaceType="textureView" />;
}

function syncLabel(media:LocalMediaRecord):string{
  if(media.syncState==='SYNCED')return'Synchronisé';
  if(media.syncState==='FAILED')return`Échec • tentative ${media.retryCount}`;
  if(media.syncState==='UPLOADING')return'Transfert en cours';
  return'En attente';
}

export function MediaGallery({ eventId, eventName, store, onClose }: MediaGalleryProps) {
  const { width } = useWindowDimensions();
  const landscape = width >= 760;
  const api=useMemo(()=>new HttpStationApi(API_BASE_URL),[]);
  const vault=useMemo(()=>new SecureStoreCredentialVault(),[]);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [rescuing,setRescuing]=useState(false);
  const [media, setMedia] = useState<LocalMediaRecord[]>([]);
  const [renderJobs,setRenderJobs]=useState<LocalRenderJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showOriginal,setShowOriginal]=useState(false);
  const [filter, setFilter] = useState<MediaFilter>('ALL');
  const [message, setMessage] = useState('');
  const [healthOpen,setHealthOpen]=useState(false);
  const [healthToken,setHealthToken]=useState<string|null>(null);

  async function readMedia(showLoading=false,clearMessage=false):Promise<void>{
    if(showLoading)setLoading(true);
    try{
      const[items,jobs]=await Promise.all([store.listMedia(eventId),store.listRenderJobs(eventId)]);
      setMedia(items);
      setRenderJobs(jobs);
      setSelectedId((current)=>current&&items.some((item)=>item.localId===current)?current:items[0]?.localId??null);
      if(clearMessage)setMessage('');
    }catch(error){
      if(showLoading||clearMessage)setMessage(error instanceof Error?error.message:'Impossible d’ouvrir la galerie locale.');
    }finally{
      if(showLoading)setLoading(false);
    }
  }

  async function refresh():Promise<void>{await readMedia(true,true);}

  useEffect(()=>{
    let cancelled=false;
    const update=async(showLoading=false,clearMessage=false)=>{
      if(cancelled)return;
      if(showLoading)setLoading(true);
      try{
        const[items,jobs]=await Promise.all([store.listMedia(eventId),store.listRenderJobs(eventId)]);
        if(cancelled)return;
        setMedia(items);
        setRenderJobs(jobs);
        setSelectedId((current)=>current&&items.some((item)=>item.localId===current)?current:items[0]?.localId??null);
        if(clearMessage)setMessage('');
      }catch(error){
        if(!cancelled&&(showLoading||clearMessage))setMessage(error instanceof Error?error.message:'Impossible d’ouvrir la galerie locale.');
      }finally{
        if(!cancelled&&showLoading)setLoading(false);
      }
    };
    void update(true,true);
    const timer=setInterval(()=>void update(false,false),2_000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[eventId,store]);

  const filteredMedia = useMemo(
    () => media.filter((item) => filter === 'ALL' || (filter === 'PHOTO' ? isPhoto(item) : !isPhoto(item))),
    [filter, media],
  );
  const selected = useMemo(() => media.find((item) => item.localId === selectedId) ?? null, [media, selectedId]);
  const selectedJob=useMemo(()=>renderJobs.find((job)=>job.localId===selectedId)??null,[renderJobs,selectedId]);
  const selectedUri=selected&&showOriginal&&selectedJob?selectedJob.sourceUri:selected?.localUri??null;
  const photoCount = media.filter(isPhoto).length;
  const videoCount = media.length - photoCount;
  const pendingCount = media.filter((item) => item.syncState !== 'SYNCED').length;
  const failedCount=media.filter((item)=>item.syncState==='FAILED').length;
  const renderingCount=renderJobs.filter((job)=>job.state==='CAPTURED'||job.state==='RENDERING').length;
  const renderFailedCount=renderJobs.filter((job)=>job.state==='FAILED').length;

  useEffect(() => {
    if (filteredMedia.length && !filteredMedia.some((item) => item.localId === selectedId)) {
      setSelectedId(filteredMedia[0]?.localId ?? null);
    }
  }, [filteredMedia, selectedId]);

  useEffect(()=>setShowOriginal(false),[selectedId]);

  async function openHealth():Promise<void>{
    const token=await vault.getStationToken();
    if(!token){setMessage('Session CAPTURE introuvable. Réactivez la station avant le diagnostic.');return;}
    setHealthToken(token);setHealthOpen(true);
  }

  async function shareSelected(item: LocalMediaRecord): Promise<void> {
    setSharing(true);
    try {
      await shareMediaNatively(item);
      setMessage('Partage Android ouvert.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de partager ce moment.');
    } finally {
      setSharing(false);
    }
  }

  async function retrySelected(item:LocalMediaRecord):Promise<void>{
    if(item.syncState==='SYNCED')return;
    setRescuing(true);
    try{
      const queued=await rescheduleMediaNow(store,eventId,item.localId);
      if(!queued){setMessage('Ce moment n’a plus besoin d’être relancé.');await readMedia(false,false);return;}
      setMessage(`Relance immédiate demandée pour ce moment${item.retryCount?` • tentative actuelle ${item.retryCount}`:''}. Le fichier local reste intact.`);
      await new Promise((resolve)=>setTimeout(resolve,2_200));
      await readMedia(false,false);
    }catch(error){
      setMessage(error instanceof Error?error.message:'Impossible de relancer la synchronisation.');
    }finally{setRescuing(false);}
  }

  async function printPhoto(item: LocalMediaRecord): Promise<void> {
    if (!isPhoto(item)) return;
    setPrinting(true);
    try {
      const file = new File(item.localUri);
      if (!file.exists) throw new Error('Le fichier photo local est introuvable.');
      const base64 = await file.base64();
      const html = `<!DOCTYPE html><html><head><style>@page{margin:0}html,body{margin:0}main{min-height:100vh;display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100vh;object-fit:contain}</style></head><body><main><img src="data:${item.mimeType || 'image/jpeg'};base64,${base64}" /></main></body></html>`;
      await Print.printAsync({ html });
      setMessage('Fenêtre d’impression ouverte.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’imprimer cette photo.');
    } finally {
      setPrinting(false);
    }
  }

  async function remove(item: LocalMediaRecord): Promise<void> {
    try {
      const file = new File(item.localUri);
      if (file.exists) file.delete();
      await store.deleteMedia(item.localId);
      await refresh();
      setMessage('Moment supprimé de cette tablette.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  }

  function confirmDelete(item: LocalMediaRecord): void {
    Alert.alert('Supprimer ce moment ?', item.syncState === 'SYNCED' ? 'La copie locale sera supprimée.' : 'Ce média n’est pas encore synchronisé. La suppression est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void remove(item) },
    ]);
  }

  if(healthOpen&&healthToken)return <StationLinkHealth mode="CAPTURE" eventId={eventId} eventName={eventName} api={api} stationToken={healthToken} store={store} onClose={()=>setHealthOpen(false)}/>;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>KHE BOOTH</Text>
            <Text style={styles.title}>Galerie CAPTURE</Text>
            <Text style={styles.subtitle}>{eventName} • Galerie locale stable et offline-first • états actualisés automatiquement</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>

        <Pressable style={styles.healthButton} onPress={()=>void openHealth()}><View><Text style={styles.healthEyebrow}>KHE LINK HEALTH</Text><Text style={styles.healthTitle}>⇄ Vérifier CAPTURE ↔ SHARING</Text></View><Text style={styles.healthArrow}>›</Text></Pressable>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{media.length}</Text><Text style={styles.summaryLabel}>moments</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{videoCount}</Text><Text style={styles.summaryLabel}>vidéos</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{photoCount}</Text><Text style={styles.summaryLabel}>photos</Text></View>
          <View style={[styles.summaryCard,failedCount>0&&styles.summaryCardWarning]}><Text style={styles.summaryNumber}>{pendingCount}</Text><Text style={styles.summaryLabel}>{failedCount>0?`${failedCount} échec(s) • à synchroniser`:'à synchroniser'}</Text></View>
          <View style={[styles.summaryCard,renderFailedCount>0&&styles.summaryCardWarning]}><Text style={styles.summaryNumber}>{renderingCount}</Text><Text style={styles.summaryLabel}>{renderFailedCount?`${renderFailedCount} reprise(s) • Studio`:'rendu(s) Studio'}</Text></View>
        </View>

        {renderingCount||renderFailedCount?<View style={styles.pipelineCard}><Text style={styles.pipelineTitle}>{renderFailedCount?'STUDIO • REPRISE AUTOMATIQUE':'STUDIO • RENDU AUTOMATIQUE'}</Text><Text style={styles.pipelineText}>{renderingCount} Moment{renderingCount===1?'':'s'} en traitement. Les originaux sont sécurisés et les rendus finaux apparaissent automatiquement ici, puis sur SHARING.</Text>{renderJobs.filter((job)=>job.state==='FAILED').slice(0,2).map((job)=><Text key={job.localId} style={styles.pipelineError} numberOfLines={2}>• {job.lastError||'Rendu momentanément indisponible'} — nouvelle tentative automatique</Text>)}</View>:null}

        <View style={styles.filters}>
          {(['ALL', 'VIDEO', 'PHOTO'] as const).map((candidate) => (
            <Pressable key={candidate} style={[styles.filter, filter === candidate && styles.filterActive]} onPress={() => setFilter(candidate)}>
              <Text style={[styles.filterText, filter === candidate && styles.filterTextActive]}>{candidate === 'ALL' ? 'Tous' : candidate === 'VIDEO' ? 'Vidéos' : 'Photos'}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.refresh} onPress={() => void refresh()}><Text style={styles.refreshText}>↻ Actualiser</Text></Pressable>
        </View>

        {loading ? <View style={styles.center}><ActivityIndicator /><Text>Chargement…</Text></View> : null}

        {!loading && filteredMedia.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>{renderingCount?'Rendu Studio en cours':'Aucun moment pour ce filtre'}</Text><Text style={styles.muted}>{renderingCount?'L’original est déjà sécurisé. Le rendu final apparaîtra automatiquement dès qu’il sera vérifié.':'Les prochaines captures apparaîtront ici immédiatement.'}</Text></View>
        ) : null}

        {selected ? (
          <View style={[styles.workspace, landscape && styles.workspaceLandscape]}>
            <View style={styles.viewerCard}>
              {selectedJob?<View style={styles.versionSwitch}><Pressable style={[styles.versionButton,!showOriginal&&styles.versionButtonActive]} onPress={()=>setShowOriginal(false)}><Text style={[styles.versionText,!showOriginal&&styles.versionTextActive]}>RENDU FINAL</Text></Pressable><Pressable style={[styles.versionButton,showOriginal&&styles.versionButtonActive]} onPress={()=>setShowOriginal(true)}><Text style={[styles.versionText,showOriginal&&styles.versionTextActive]}>ORIGINAL</Text></Pressable></View>:null}
              {isPhoto(selected)
                ? <Image source={{ uri: selectedUri??selected.localUri }} style={styles.viewerMedia} resizeMode="contain" />
                : <SelectedVideo key={`${selected.localId}-${showOriginal?'original':'final'}`} uri={selectedUri??selected.localUri} />}
              <View style={styles.viewerMeta}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.viewerTitle}>{isPhoto(selected) ? 'Photo' : 'Vidéo'} • {showOriginal?'Original sécurisé':'Rendu final'}</Text>
                  <Text style={styles.viewerMuted}>{new Date(selected.capturedAt).toLocaleString()} • {Math.max(1, Math.round(selected.byteSize / 1024 / 1024))} Mo</Text>
                </View>
                <View style={[styles.state, selected.syncState === 'SYNCED' && styles.stateSynced,selected.syncState==='FAILED'&&styles.stateFailed]}><Text style={styles.stateText}>{selected.syncState}</Text></View>
              </View>
              {selected.syncState==='FAILED'?<View style={styles.syncError}><Text style={styles.syncErrorTitle}>Synchronisation en échec • tentative {selected.retryCount}</Text><Text style={styles.syncErrorText}>{selected.lastError||'Erreur réseau ou serveur temporaire.'}</Text><Text style={styles.syncErrorHelp}>Le fichier est toujours conservé sur cette tablette.</Text></View>:null}
              <View style={styles.actions}>
                {selected.syncState!=='SYNCED'?<Pressable disabled={rescuing} style={styles.retryButton} onPress={()=>void retrySelected(selected)}><Text style={styles.retryButtonText}>{rescuing?'RELANCE…':'↻ RELANCER LA SYNCHRO'}</Text></Pressable>:null}
                <Pressable disabled={sharing} style={styles.primary} onPress={() => void shareSelected(selected)}><Text style={styles.primaryText}>{sharing ? 'Ouverture…' : 'Partager'}</Text></Pressable>
                {isPhoto(selected) ? <Pressable disabled={printing} style={styles.secondary} onPress={() => void printPhoto(selected)}><Text style={styles.secondaryText}>{printing ? 'Préparation…' : 'Imprimer'}</Text></Pressable> : null}
                <Pressable style={styles.danger} onPress={() => confirmDelete(selected)}><Text style={styles.dangerText}>Supprimer</Text></Pressable>
              </View>
            </View>

            <View style={styles.library}>
              <Text style={styles.sectionTitle}>Moments disponibles</Text>
              <Text style={styles.muted}>Les états de synchronisation se mettent à jour toutes les 2 secondes. Les vidéos ne démarrent pas automatiquement dans les vignettes afin de préserver la stabilité Android.</Text>
              <View style={styles.cards}>
                {filteredMedia.map((item, index) => (
                  <Pressable key={item.localId} style={[styles.mediaCard, item.localId === selectedId && styles.mediaCardActive,item.syncState==='FAILED'&&styles.mediaCardFailed]} onPress={() => setSelectedId(item.localId)}>
                    {isPhoto(item)
                      ? <Image source={{ uri: item.localUri }} style={styles.thumb} resizeMode="cover" />
                      : <View style={styles.videoThumb}><Text style={styles.playIcon}>▶</Text><Text style={styles.videoLabel}>VIDÉO</Text></View>}
                    <View style={styles.cardCopy}>
                      <Text style={styles.cardTitle}>{isPhoto(item) ? 'Photo' : 'Vidéo'} {filteredMedia.length - index}</Text>
                      <Text style={[styles.cardMeta,item.syncState==='FAILED'&&styles.cardMetaFailed]}>{new Date(item.capturedAt).toLocaleTimeString()} • {syncLabel(item)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </View>
  );
}

const KHE_RED = '#b31520';
const KHE_GOLD = '#c9a84c';
const KHE_BLACK = '#0d0d0f';

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f6f2eb' },
  content: { padding: 18, paddingBottom: 50, gap: 16 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  brand: { color: KHE_RED, fontSize: 12, letterSpacing: 4, fontWeight: '900' },
  title: { color: KHE_BLACK, fontSize: 32, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#666', marginTop: 4 },
  closeButton: { backgroundColor: KHE_BLACK, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  closeText: { color: '#fff', fontWeight: '900' },
  healthButton:{backgroundColor:KHE_BLACK,borderWidth:1,borderColor:KHE_GOLD,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  healthEyebrow:{color:KHE_GOLD,fontSize:9,fontWeight:'900',letterSpacing:1.5},healthTitle:{color:'#fff',fontSize:15,fontWeight:'900',marginTop:3},healthArrow:{color:KHE_GOLD,fontSize:28,fontWeight:'600'},
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: { minWidth: 92, flexGrow: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#eadfce' },
  summaryCardWarning:{borderColor:'#c6762a',backgroundColor:'#fff8ee'},
  summaryNumber: { fontSize: 24, fontWeight: '900', color: KHE_RED },
  summaryLabel: { color: '#6c6258', fontWeight: '700' },
  pipelineCard:{backgroundColor:'#18150f',borderWidth:1,borderColor:KHE_GOLD,borderRadius:16,padding:14,gap:5},
  pipelineTitle:{color:KHE_GOLD,fontSize:11,fontWeight:'900',letterSpacing:1},
  pipelineText:{color:'#fff',fontSize:12,lineHeight:18},
  pipelineError:{color:'#ffd1b5',fontSize:10,lineHeight:15},
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  filterActive: { backgroundColor: KHE_RED, borderColor: KHE_RED },
  filterText: { fontWeight: '800', color: '#222' },
  filterTextActive: { color: '#fff' },
  refresh: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: KHE_GOLD },
  refreshText: { color: '#17120a', fontWeight: '900' },
  center: { padding: 30, alignItems: 'center', gap: 8 },
  empty: { padding: 32, backgroundColor: '#fff', borderRadius: 22, alignItems: 'center', gap: 6 },
  emptyIcon: { fontSize: 28, color: KHE_GOLD },
  emptyTitle: { fontWeight: '900', fontSize: 18 },
  muted: { color: '#6d665f', lineHeight: 18 },
  workspace: { gap: 16 },
  workspaceLandscape: { flexDirection: 'row', alignItems: 'flex-start' },
  viewerCard: { flex: 1.2, backgroundColor: KHE_BLACK, borderRadius: 24, padding: 12, gap: 12 },
  versionSwitch:{flexDirection:'row',gap:7,backgroundColor:'#171719',borderRadius:12,padding:5},
  versionButton:{flex:1,borderRadius:9,paddingVertical:9,alignItems:'center'},
  versionButtonActive:{backgroundColor:KHE_GOLD},
  versionText:{color:'#aaa',fontSize:10,fontWeight:'900',letterSpacing:.7},
  versionTextActive:{color:'#17120a'},
  viewerMedia: { width: '100%', height: 340, borderRadius: 18, backgroundColor: '#000' },
  viewerMeta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  viewerTitle: { color: '#fff', fontWeight: '900', fontSize: 18 },
  viewerMuted:{color:'#aaa',lineHeight:18},
  state: { backgroundColor: '#4a3a3a', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  stateSynced: { backgroundColor: '#176b43' },
  stateFailed:{backgroundColor:'#7f2525'},
  stateText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  syncError:{borderWidth:1,borderColor:'#6f3434',backgroundColor:'#271515',borderRadius:14,padding:12,gap:4},
  syncErrorTitle:{color:'#ffc0c0',fontWeight:'900',fontSize:12},syncErrorText:{color:'#f1caca',fontSize:11,lineHeight:16},syncErrorHelp:{color:'#aaa',fontSize:10},
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  retryButton:{flexGrow:1,minWidth:180,backgroundColor:'#211d14',borderWidth:1,borderColor:KHE_GOLD,borderRadius:13,padding:13,alignItems:'center'},retryButtonText:{color:KHE_GOLD,fontWeight:'900'},
  primary: { flexGrow: 1, backgroundColor: KHE_RED, borderRadius: 13, padding: 13, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  secondary: { flexGrow: 1, backgroundColor: KHE_GOLD, borderRadius: 13, padding: 13, alignItems: 'center' },
  secondaryText: { color: '#17120a', fontWeight: '900' },
  danger: { flexGrow: 1, borderWidth: 1, borderColor: '#733', borderRadius: 13, padding: 13, alignItems: 'center' },
  dangerText: { color: '#ff9c9c', fontWeight: '900' },
  library: { flex: 1, backgroundColor: '#fff', borderRadius: 24, padding: 15, gap: 10 },
  sectionTitle: { fontSize: 19, fontWeight: '900', color: KHE_BLACK },
  cards: { gap: 9 },
  mediaCard: { flexDirection: 'row', backgroundColor: '#f4efe7', borderRadius: 16, padding: 8, gap: 10, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  mediaCardActive: { borderColor: KHE_GOLD, backgroundColor: '#fffaf0' },
  mediaCardFailed:{borderColor:'#d68b8b'},
  thumb: { width: 86, height: 66, borderRadius: 12, backgroundColor: '#ddd' },
  videoThumb: { width: 86, height: 66, borderRadius: 12, backgroundColor: KHE_BLACK, alignItems: 'center', justifyContent: 'center' },
  playIcon: { color: KHE_GOLD, fontSize: 24 },
  videoLabel: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  cardCopy: { flex: 1 },
  cardTitle: { fontWeight: '900', fontSize: 15 },
  cardMeta: { color: '#766e64', fontSize: 11, marginTop: 3 },
  cardMetaFailed:{color:'#a32828',fontWeight:'800'},
  message: { backgroundColor: '#fff', borderLeftWidth: 4, borderLeftColor: KHE_GOLD, borderRadius: 14, padding: 13, color: '#312b25' },
});
