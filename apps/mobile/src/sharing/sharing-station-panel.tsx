import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationExperienceApi } from '../api/station-api';
import { CreativeStudio, type CreativePlan } from '../studio/creative-studio';
import { RemoteControlPanel } from './remote-control-panel';
import { SharingEventManager } from './sharing-event-manager';
import { SharingMediaGallery } from './sharing-media-gallery';
import { SharingTrashPanel } from './sharing-trash-panel';

const CREATIVE_PLAN_KEY='khe.creative.plan.v1';

interface SharingStationPanelProps {
  eventName: string;
  api: StationExperienceApi;
  stationToken: string;
}

export function SharingStationPanel({ eventName, api, stationToken }: SharingStationPanelProps) {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [flowMessage,setFlowMessage]=useState('');
  const [designEvent,setDesignEvent]=useState<{id:string;name:string}|null>(null);
  const designSavedRef=useRef(false);
  const checkingRef = useRef(false);

  async function initialize(): Promise<void> {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setError('');
    try {
      await Promise.all([api.control(stationToken), api.listMedia(stationToken), api.clientWorkspace(stationToken)]);
      setReady(true);
    } catch (cause) {
      setReady(false);
      setError(cause instanceof Error ? cause.message : 'Impossible d’initialiser la régie SHARING.');
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }

  useEffect(() => { void initialize(); }, [api, stationToken]);

  async function startDesign(eventId:string,eventTitle:string){
    setFlowMessage(`Événement « ${eventTitle} » créé. Préparez maintenant son design.`);
    await SecureStore.deleteItemAsync(CREATIVE_PLAN_KEY).catch(()=>undefined);
    designSavedRef.current=false;
    setDesignEvent({id:eventId,name:eventTitle});
  }

  async function publishDesign(plan:CreativePlan){
    const pending=designEvent;if(!pending)return;
    await api.markClientEventDesignReady(stationToken,pending.id,plan as unknown as Record<string,unknown>);
    designSavedRef.current=true;
    setFlowMessage(`✓ Design « ${pending.name} » enregistré. CAPTURE reçoit automatiquement les changements maintenant.`);
  }

  async function closeDesign(){
    const pending=designEvent;if(!pending)return;
    if(designSavedRef.current){setDesignEvent(null);return;}
    const raw=await SecureStore.getItemAsync(CREATIVE_PLAN_KEY);
    if(!raw){setDesignEvent(null);setFlowMessage(`« ${pending.name} » reste en brouillon : enregistrez un design dans le Studio pour l’envoyer automatiquement vers CAPTURE.`);return;}
    let plan:CreativePlan;
    try{plan=JSON.parse(raw) as CreativePlan;}catch{setDesignEvent(null);setFlowMessage('Le design local est illisible. L’événement reste en brouillon.');return;}
    try{await publishDesign({...plan,background:plan.background?{...plan.background,localUri:null}:null});}
    catch(cause){setFlowMessage(cause instanceof Error?cause.message:'Impossible de valider le design.');}
    finally{setDesignEvent(null);}
  }

  if(designEvent)return <CreativeStudio api={api} stationToken={stationToken} eventId={designEvent.id} onSaved={publishDesign} onClose={()=>void closeDesign()}/>;

  if (!ready) {
    return (
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}><View style={styles.dot} /><Text style={styles.eyebrow}>RÉGIE SHARING</Text></View>
        <Text style={styles.title}>{checking ? 'Connexion à KHE Booth…' : 'Connexion interrompue'}</Text>
        {checking ? <ActivityIndicator color="#d2ad4f" size="large" /> : null}
        <Text style={styles.help}>{checking ? 'Vérification de la session, de CAPTURE, des événements client et de la galerie Cloud.' : error}</Text>
        {!checking ? <Pressable style={styles.retry} onPress={() => void initialize()}><Text style={styles.retryText}>RÉESSAYER LA CONNEXION</Text></Pressable> : null}
      </View>
    );
  }

  return (
    <View style={styles.readyShell}>
      {flowMessage?<View style={styles.flowBanner}><Text style={styles.flowText}>{flowMessage}</Text></View>:null}
      <SharingEventManager api={api} stationToken={stationToken} onCreated={(eventId,eventTitle)=>void startDesign(eventId,eventTitle)} onReady={(eventTitle)=>setFlowMessage(`✓ « ${eventTitle} » est prêt et sera sélectionné automatiquement sur CAPTURE et SHARING dans quelques secondes.`)} />
      <RemoteControlPanel eventName={eventName} api={api} stationToken={stationToken} />
      <SharingTrashPanel api={api} stationToken={stationToken} />
      <SharingMediaGallery eventName={eventName} api={api} stationToken={stationToken} />
    </View>
  );
}

const styles = StyleSheet.create({
  readyShell: { gap: 14 },flowBanner:{backgroundColor:'#e8f6ed',borderWidth:1,borderColor:'#9bc8aa',borderRadius:14,padding:12},flowText:{color:'#185a32',fontSize:12,lineHeight:18,fontWeight:'800'},
  statusCard: { marginTop: 16, backgroundColor: '#111113', borderRadius: 22, padding: 22, gap: 14, borderWidth: 1, borderColor: '#30291d' },statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#d2ad4f' },eyebrow: { color: '#d2ad4f', fontSize: 11, letterSpacing: 2, fontWeight: '900' },title: { color: '#fff', fontSize: 24, fontWeight: '900' },help: { color: '#c4bfba', lineHeight: 20 },retry: { backgroundColor: '#b31520', borderRadius: 14, padding: 14, alignItems: 'center' },retryText: { color: '#fff', fontWeight: '900', letterSpacing: 0.7 },
});