import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StationExperienceApi } from '../api/station-api';
import type { AppLanguage } from '../experience/i18n';
import type { LocalStore } from '../offline/local-store';
import type { PersistedStationContext } from '../offline/types';
import { reschedulePendingMediaNow } from '../sync/sync-rescue';
import { countBlockingChecks, countWarnings, eventReadyState, isRecentHeartbeat, type ReadinessCheck, type ReadinessLevel } from './event-ready-model';

interface Props {
  api: StationExperienceApi;
  store: LocalStore;
  station: PersistedStationContext;
  stationToken: string;
  eventName: string;
  language: AppLanguage;
  keepAwakeEnabled: boolean;
  onClose: () => void;
}

type Copy = {
  eyebrow:string;title:string;subtitle:string;ready:string;attention:string;blocked:string;refresh:string;running:string;lastCheck:string;
  event:string;api:string;storage:string;sync:string;camera:string;microphone:string;link:string;screen:string;gallery:string;qr:string;
  ok:string;eventMismatch:string;apiDown:string;storageDown:string;noPending:string;pending:string;cameraOk:string;cameraNo:string;micOk:string;micNo:string;
  linkOk:string;linkPending:string;linkOff:string;screenOk:string;screenWarn:string;galleryOk:string;qrWaiting:string;qrAvailable:string;qrTest:string;qrTesting:string;qrStable:string;qrFail:string;close:string;
  allow:string;connect:string;accept:string;retry:string;fixAll:string;fixing:string;fixed:string;manualLink:string;permissionBlocked:string;
};

const fr:Copy={
  eyebrow:'KHE EVENT READY',title:'Contrôle pré-événement',subtitle:'Vérification réelle de cette tablette avant l’arrivée des invités.',ready:'PRÊT POUR L’ÉVÉNEMENT',attention:'ATTENTION AVANT L’ÉVÉNEMENT',blocked:'ACTION REQUISE',refresh:'REVÉRIFIER',running:'VÉRIFICATION…',lastCheck:'Dernière vérification',event:'Événement',api:'Cloud & API',storage:'Stockage local',sync:'Synchronisation',camera:'Caméra',microphone:'Microphone',link:'Liaison CAPTURE ↔ SHARING',screen:'Écran événement',gallery:'Galerie SHARING',qr:'QR invité stable',ok:'Prêt',eventMismatch:'L’événement local et le serveur ne correspondent pas.',apiDown:'KHE Cloud est momentanément inaccessible.',storageDown:'Le stockage local n’est pas accessible.',noPending:'Aucun média en attente.',pending:'média(s) encore en attente ou en reprise.',cameraOk:'Permission caméra accordée.',cameraNo:'Autorisez la caméra avant la prestation.',micOk:'Permission microphone accordée pour la vidéo.',micNo:'Autorisez le microphone avant une capture vidéo.',linkOk:'Les deux tablettes se voient en temps réel.',linkPending:'La connexion est en cours ou attend une validation.',linkOff:'CAPTURE et SHARING ne sont pas encore reliées.',screenOk:'La tablette restera active pendant l’événement.',screenWarn:'La mise en veille est autorisée. Vérifiez que cela correspond à votre choix.',galleryOk:'La galerie Cloud répond correctement.',qrWaiting:'Le QR pourra être testé dès qu’un média synchronisé existe.',qrAvailable:'Un média synchronisé est disponible pour vérifier le QR stable.',qrTest:'TESTER LE QR STABLE',qrTesting:'TEST QR…',qrStable:'Même lien retourné deux fois : QR stable confirmé.',qrFail:'Le QR stable n’a pas pu être confirmé.',close:'RETOUR À L’ACCUEIL',allow:'AUTORISER',connect:'CONNECTER',accept:'ACCEPTER',retry:'RÉESSAYER',fixAll:'CORRIGER LES POINTS POSSIBLES',fixing:'CORRECTION…',fixed:'Correction appliquée. Nouveau contrôle en cours.',manualLink:'Démarrez la demande depuis SHARING.',permissionBlocked:'Autorisation bloquée : ouvrez les réglages système.'
};

const en:Copy={
  eyebrow:'KHE EVENT READY',title:'Pre-event check',subtitle:'Real checks on this tablet before guests arrive.',ready:'READY FOR THE EVENT',attention:'CHECK BEFORE EVENT',blocked:'ACTION REQUIRED',refresh:'CHECK AGAIN',running:'CHECKING…',lastCheck:'Last check',event:'Event',api:'Cloud & API',storage:'Local storage',sync:'Synchronization',camera:'Camera',microphone:'Microphone',link:'CAPTURE ↔ SHARING link',screen:'Event screen',gallery:'SHARING gallery',qr:'Stable guest QR',ok:'Ready',eventMismatch:'Local and server events do not match.',apiDown:'KHE Cloud is temporarily unreachable.',storageDown:'Local storage is unavailable.',noPending:'No media waiting to sync.',pending:'media item(s) still waiting or retrying.',cameraOk:'Camera permission granted.',cameraNo:'Allow camera access before the event.',micOk:'Microphone permission granted for video.',micNo:'Allow microphone access before recording video.',linkOk:'Both tablets see each other in real time.',linkPending:'Connection is pending or waiting for approval.',linkOff:'CAPTURE and SHARING are not linked yet.',screenOk:'The tablet will stay awake during the event.',screenWarn:'Sleep is allowed. Make sure this matches your choice.',galleryOk:'Cloud gallery responds correctly.',qrWaiting:'QR can be tested once one synchronized media exists.',qrAvailable:'A synchronized media item is available to test the stable QR.',qrTest:'TEST STABLE QR',qrTesting:'TESTING QR…',qrStable:'Same link returned twice: stable QR confirmed.',qrFail:'Stable QR could not be confirmed.',close:'BACK TO HOME',allow:'ALLOW',connect:'CONNECT',accept:'ACCEPT',retry:'RETRY',fixAll:'FIX AVAILABLE ISSUES',fixing:'FIXING…',fixed:'Correction applied. Running a fresh check.',manualLink:'Start the request from SHARING.',permissionBlocked:'Permission is blocked: open device settings.'
};

const copy:Record<AppLanguage,Copy>={
  fr,
  en,
  de:{...en,title:'Vorabprüfung',subtitle:'Echte Prüfung dieses Tablets vor dem Event.',ready:'BEREIT FÜR DAS EVENT',attention:'VOR DEM EVENT PRÜFEN',blocked:'AKTION ERFORDERLICH',refresh:'ERNEUT PRÜFEN',running:'PRÜFUNG…',lastCheck:'Letzte Prüfung',event:'Event',storage:'Lokaler Speicher',sync:'Synchronisierung',camera:'Kamera',microphone:'Mikrofon',link:'CAPTURE ↔ SHARING',screen:'Event-Bildschirm',gallery:'SHARING-Galerie',qr:'Stabiler Gäste-QR',allow:'ERLAUBEN',connect:'VERBINDEN',accept:'AKZEPTIEREN',retry:'ERNEUT',fixAll:'MÖGLICHE PUNKTE BEHEBEN',fixing:'KORREKTUR…',close:'ZURÜCK ZUM START'},
  it:{...en,title:'Controllo pre-evento',subtitle:'Controllo reale del tablet prima degli ospiti.',ready:'PRONTO PER L’EVENTO',attention:'CONTROLLARE PRIMA DELL’EVENTO',blocked:'AZIONE RICHIESTA',refresh:'RICONTROLLA',running:'CONTROLLO…',lastCheck:'Ultimo controllo',event:'Evento',storage:'Memoria locale',sync:'Sincronizzazione',camera:'Fotocamera',microphone:'Microfono',link:'CAPTURE ↔ SHARING',screen:'Schermo evento',gallery:'Galleria SHARING',qr:'QR ospite stabile',allow:'AUTORIZZA',connect:'CONNETTI',accept:'ACCETTA',retry:'RIPROVA',fixAll:'CORREGGI I PUNTI POSSIBILI',fixing:'CORREZIONE…',close:'TORNA ALLA HOME'},
  es:{...en,title:'Control previo al evento',subtitle:'Comprobación real de la tableta antes de los invitados.',ready:'LISTO PARA EL EVENTO',attention:'REVISAR ANTES DEL EVENTO',blocked:'ACCIÓN NECESARIA',refresh:'REVISAR DE NUEVO',running:'COMPROBANDO…',lastCheck:'Última comprobación',event:'Evento',storage:'Almacenamiento local',sync:'Sincronización',camera:'Cámara',microphone:'Micrófono',link:'CAPTURE ↔ SHARING',screen:'Pantalla del evento',gallery:'Galería SHARING',qr:'QR estable para invitados',allow:'AUTORIZAR',connect:'CONECTAR',accept:'ACEPTAR',retry:'REINTENTAR',fixAll:'CORREGIR PUNTOS POSIBLES',fixing:'CORRIGIENDO…',close:'VOLVER AL INICIO'},
  pt:{...en,title:'Verificação pré-evento',subtitle:'Verificação real do tablet antes dos convidados.',ready:'PRONTO PARA O EVENTO',attention:'VERIFICAR ANTES DO EVENTO',blocked:'AÇÃO NECESSÁRIA',refresh:'VERIFICAR NOVAMENTE',running:'A VERIFICAR…',lastCheck:'Última verificação',event:'Evento',storage:'Armazenamento local',sync:'Sincronização',camera:'Câmara',microphone:'Microfone',link:'CAPTURE ↔ SHARING',screen:'Ecrã do evento',gallery:'Galeria SHARING',qr:'QR estável para convidados',allow:'AUTORIZAR',connect:'LIGAR',accept:'ACEITAR',retry:'TENTAR NOVAMENTE',fixAll:'CORRIGIR PONTOS POSSÍVEIS',fixing:'A CORRIGIR…',close:'VOLTAR AO INÍCIO'}
};

const tone:Record<ReadinessLevel,{symbol:string;color:string;background:string}>={
  PASS:{symbol:'✓',color:'#bfe9c9',background:'#173622'},WARN:{symbol:'!',color:'#ffe5a0',background:'#493914'},BLOCK:{symbol:'×',color:'#ffc2c2',background:'#4a1818'},INFO:{symbol:'•',color:'#d7d7d7',background:'#292929'}
};

type LinkState={status:string;fresh:boolean};

export function EventReadyScreen({api,store,station,stationToken,eventName,language,keepAwakeEnabled,onClose}:Props){
  const c=copy[language];
  const[cameraPermission,requestCameraPermission]=useCameraPermissions();
  const[microphonePermission,requestMicrophonePermission]=useMicrophonePermissions();
  const[checks,setChecks]=useState<ReadinessCheck[]>([]);
  const[running,setRunning]=useState(false);
  const[fixing,setFixing]=useState(false);
  const[actionMessage,setActionMessage]=useState('');
  const[lastCheckedAt,setLastCheckedAt]=useState<Date|null>(null);
  const[syncedMediaIds,setSyncedMediaIds]=useState<string[]>([]);
  const[qrTesting,setQrTesting]=useState(false);
  const[qrCheck,setQrCheck]=useState<ReadinessCheck|null>(null);
  const[linkState,setLinkState]=useState<LinkState>({status:'DISCONNECTED',fresh:false});

  const runChecks=useCallback(async()=>{
    setRunning(true);setQrCheck(null);
    const next:ReadinessCheck[]=[];
    try{
      try{
        await store.init();
        const snapshot=await store.snapshot(station.session.eventId);
        const pendingCount=snapshot.pendingMedia.length;
        const highestRetry=snapshot.pendingMedia.reduce((highest,item)=>Math.max(highest,item.retryCount),0);
        const failedCount=snapshot.pendingMedia.filter((item)=>item.syncState==='FAILED').length;
        const syncDetail=pendingCount===0?c.noPending:`${pendingCount} ${c.pending}${failedCount?` • ${failedCount} échec(s)`:''}${highestRetry?` • tentative max ${highestRetry}`:''}`;
        next.push({id:'storage',title:c.storage,detail:c.ok,level:'PASS'});
        next.push({id:'sync',title:c.sync,detail:syncDetail,level:pendingCount===0?'PASS':'WARN'});
      }catch{
        next.push({id:'storage',title:c.storage,detail:c.storageDown,level:'BLOCK'});
        next.push({id:'sync',title:c.sync,detail:c.storageDown,level:'BLOCK'});
      }

      const[manifestResult,controlResult,mediaResult]=await Promise.allSettled([
        api.manifest(stationToken),
        api.control(stationToken),
        station.mode==='SHARING'?api.listMedia(stationToken):Promise.resolve([]),
      ]);

      if(manifestResult.status==='fulfilled'){
        const remote=manifestResult.value;
        const matches=remote.event.id===station.session.eventId;
        next.unshift({id:'event',title:c.event,detail:matches?`${remote.event.name} • ${c.ok}`:c.eventMismatch,level:matches?'PASS':'BLOCK'});
        next.push({id:'api',title:c.api,detail:c.ok,level:'PASS'});
      }else{
        next.unshift({id:'event',title:c.event,detail:eventName,level:'WARN'});
        next.push({id:'api',title:c.api,detail:c.apiDown,level:'BLOCK'});
      }

      if(station.mode==='CAPTURE'){
        const cameraBlocked=!cameraPermission?.granted&&cameraPermission?.canAskAgain===false;
        const micBlocked=!microphonePermission?.granted&&microphonePermission?.canAskAgain===false;
        next.push({id:'camera',title:c.camera,detail:cameraPermission?.granted?c.cameraOk:cameraBlocked?c.permissionBlocked:c.cameraNo,level:cameraPermission?.granted?'PASS':'BLOCK'});
        next.push({id:'microphone',title:c.microphone,detail:microphonePermission?.granted?c.micOk:micBlocked?c.permissionBlocked:c.micNo,level:microphonePermission?.granted?'PASS':'BLOCK'});
      }

      if(controlResult.status==='fulfilled'){
        const control=controlResult.value;
        const fresh=isRecentHeartbeat(control.captureSeenAt);
        const status=control.sharingConnectionStatus??'DISCONNECTED';
        const accepted=status==='ACCEPTED';
        setLinkState({status,fresh});
        next.push({id:'link',title:c.link,detail:accepted&&fresh?c.linkOk:status==='PENDING'?c.linkPending:c.linkOff,level:accepted&&fresh?'PASS':'WARN'});
      }else{
        setLinkState({status:'UNKNOWN',fresh:false});
        next.push({id:'link',title:c.link,detail:c.apiDown,level:'BLOCK'});
      }

      next.push({id:'screen',title:c.screen,detail:keepAwakeEnabled?c.screenOk:c.screenWarn,level:keepAwakeEnabled?'PASS':'WARN'});

      if(station.mode==='SHARING'){
        if(mediaResult.status==='fulfilled'){
          const synced=mediaResult.value.filter((media)=>media.syncState==='SYNCED'&&Boolean(media.acknowledgedAt));
          setSyncedMediaIds(synced.map((media)=>media.id));
          next.push({id:'gallery',title:c.gallery,detail:`${c.galleryOk} ${synced.length} média(s) synchronisé(s).`,level:'PASS'});
          next.push({id:'qr',title:c.qr,detail:synced.length?c.qrAvailable:c.qrWaiting,level:'INFO'});
        }else{
          setSyncedMediaIds([]);
          next.push({id:'gallery',title:c.gallery,detail:c.apiDown,level:'BLOCK'});
          next.push({id:'qr',title:c.qr,detail:c.qrFail,level:'WARN'});
        }
      }

      setChecks(next);setLastCheckedAt(new Date());
    }finally{setRunning(false);}
  },[api,c,cameraPermission?.canAskAgain,cameraPermission?.granted,eventName,keepAwakeEnabled,microphonePermission?.canAskAgain,microphonePermission?.granted,station,stationToken,store]);

  useEffect(()=>{void runChecks();},[runChecks]);

  async function afterAction(action:()=>Promise<unknown>){
    setFixing(true);setActionMessage('');
    try{await action();setActionMessage(c.fixed);await runChecks();}
    catch(error){setActionMessage(error instanceof Error?error.message:String(error));}
    finally{setFixing(false);}
  }

  async function fixCamera(){
    if(cameraPermission?.canAskAgain===false){setActionMessage(c.permissionBlocked);return;}
    await afterAction(async()=>requestCameraPermission());
  }

  async function fixMicrophone(){
    if(microphonePermission?.canAskAgain===false){setActionMessage(c.permissionBlocked);return;}
    await afterAction(async()=>requestMicrophonePermission());
  }

  async function fixLink(){
    if(station.mode==='SHARING'){
      await afterAction(async()=>api.requestControlConnection(stationToken));
      return;
    }
    if(linkState.status==='PENDING'){
      await afterAction(async()=>api.respondControlConnection(stationToken,true));
      return;
    }
    setActionMessage(c.manualLink);
  }

  async function rescueSync(){
    if(station.mode!=='CAPTURE')return;
    setFixing(true);setActionMessage('');
    try{
      const result=await reschedulePendingMediaNow(store,station.session.eventId);
      setActionMessage(language==='fr'?`${result.rescheduled} média(s) remis en tête de la file. La synchronisation reprend maintenant.`:`${result.rescheduled} media item(s) moved to the front of the queue. Sync is resuming now.`);
      await new Promise((resolve)=>setTimeout(resolve,2200));
      await runChecks();
    }catch(error){setActionMessage(error instanceof Error?error.message:String(error));}
    finally{setFixing(false);}
  }

  async function fixAll(){
    setFixing(true);setActionMessage('');
    try{
      if(station.mode==='CAPTURE'){
        if(!cameraPermission?.granted&&cameraPermission?.canAskAgain!==false)await requestCameraPermission();
        if(!microphonePermission?.granted&&microphonePermission?.canAskAgain!==false)await requestMicrophonePermission();
        await reschedulePendingMediaNow(store,station.session.eventId);
        const control=await api.control(stationToken).catch(()=>null);
        if(control?.sharingConnectionStatus==='PENDING')await api.respondControlConnection(stationToken,true);
      }else{
        const control=await api.control(stationToken).catch(()=>null);
        const fresh=isRecentHeartbeat(control?.captureSeenAt??null);
        if(!control||control.sharingConnectionStatus!=='ACCEPTED'||!fresh)await api.requestControlConnection(stationToken);
      }
      setActionMessage(c.fixed);
      await runChecks();
    }catch(error){setActionMessage(error instanceof Error?error.message:String(error));}
    finally{setFixing(false);}
  }

  async function testStableQr(){
    const mediaId=syncedMediaIds[0];if(!mediaId)return;
    setQrTesting(true);
    try{
      const first=await api.createMediaShare(stationToken,mediaId);
      const second=await api.createMediaShare(stationToken,mediaId);
      const stable=first.id===second.id&&first.shareUrl===second.shareUrl;
      setQrCheck({id:'qr-test',title:c.qr,detail:stable?c.qrStable:c.qrFail,level:stable?'PASS':'BLOCK'});
    }catch(error){
      setQrCheck({id:'qr-test',title:c.qr,detail:`${c.qrFail}${error instanceof Error?` ${error.message}`:''}`,level:'BLOCK'});
    }finally{setQrTesting(false);}
  }

  function rowAction(check:ReadinessCheck):{label:string;run:()=>void}|null{
    if(check.level==='PASS'||check.level==='INFO')return null;
    if(check.id==='sync'&&station.mode==='CAPTURE')return{label:language==='fr'?'RELANCER MAINTENANT':'RETRY NOW',run:()=>void rescueSync()};
    if(check.id==='camera'&&cameraPermission?.canAskAgain!==false)return{label:c.allow,run:()=>void fixCamera()};
    if(check.id==='microphone'&&microphonePermission?.canAskAgain!==false)return{label:c.allow,run:()=>void fixMicrophone()};
    if(check.id==='link'){
      if(station.mode==='SHARING')return{label:c.connect,run:()=>void fixLink()};
      if(linkState.status==='PENDING')return{label:c.accept,run:()=>void fixLink()};
    }
    if(check.id==='api'||check.id==='gallery')return{label:c.retry,run:()=>void runChecks()};
    return null;
  }

  const visibleChecks=useMemo(()=>qrCheck?[...checks.filter((item)=>item.id!=='qr'),qrCheck]:checks,[checks,qrCheck]);
  const state=eventReadyState(visibleChecks);const blocks=countBlockingChecks(visibleChecks);const warnings=countWarnings(visibleChecks);
  const stateLabel=state==='READY'?c.ready:state==='ATTENTION'?c.attention:c.blocked;
  const hasCorrectable=visibleChecks.some((check)=>Boolean(rowAction(check)));

  return <View style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>{c.eyebrow}</Text><Text style={styles.title}>{c.title}</Text><Text style={styles.subtitle}>{c.subtitle}</Text>
      <View style={[styles.stateBadge,state==='READY'?styles.ready:state==='ATTENTION'?styles.attention:styles.blocked]}><Text style={styles.stateText}>{running?'…':state==='READY'?'✓':state==='ATTENTION'?'!':'×'} {running?c.running:stateLabel}</Text></View>
      {!running?<Text style={styles.summary}>{blocks>0?`${blocks} blocage(s)`:warnings>0?`${warnings} point(s) à vérifier`:'Tous les contrôles essentiels sont au vert.'}</Text>:null}
    </View>

    <View style={styles.metaCard}><Text style={styles.metaLabel}>{station.mode}</Text><Text style={styles.metaEvent}>{eventName}</Text><Text style={styles.metaId}>{station.session.eventId}</Text></View>

    {running&&!checks.length?<ActivityIndicator color="#d7b24c" style={{marginVertical:24}}/>:null}
    <View style={styles.list}>{visibleChecks.map((check)=>{const theme=tone[check.level];const action=rowAction(check);return <View key={check.id} style={styles.row}><View style={[styles.icon,{backgroundColor:theme.background}]}><Text style={[styles.iconText,{color:theme.color}]}>{theme.symbol}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{check.title}</Text><Text style={styles.rowDetail}>{check.detail}</Text>{action?<Pressable disabled={fixing||running} onPress={action.run} style={styles.rowAction}><Text style={styles.rowActionText}>{action.label}</Text></Pressable>:null}</View></View>;})}</View>

    {actionMessage?<View style={styles.actionMessage}><Text style={styles.actionMessageText}>{actionMessage}</Text></View>:null}
    {hasCorrectable?<Pressable disabled={fixing||running} onPress={()=>void fixAll()} style={styles.fixButton}><Text style={styles.fixButtonText}>{fixing?c.fixing:c.fixAll}</Text></Pressable>:null}
    {station.mode==='SHARING'&&syncedMediaIds.length>0?<Pressable disabled={qrTesting||running||fixing} onPress={()=>void testStableQr()} style={styles.qrButton}><Text style={styles.qrButtonText}>{qrTesting?c.qrTesting:c.qrTest}</Text></Pressable>:null}
    <Pressable disabled={running||fixing} onPress={()=>void runChecks()} style={styles.refreshButton}><Text style={styles.refreshText}>{running?c.running:c.refresh}</Text></Pressable>
    {lastCheckedAt?<Text style={styles.checkedAt}>{c.lastCheck} • {lastCheckedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</Text>:null}
    <Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>{c.close}</Text></Pressable>
  </ScrollView></View>;
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#0d0d0d'},content:{padding:18,paddingBottom:42,gap:14,maxWidth:760,width:'100%',alignSelf:'center'},hero:{backgroundColor:'#151515',borderRadius:24,borderWidth:1,borderColor:'#3a321e',padding:20,gap:8},eyebrow:{color:'#d7b24c',fontSize:11,fontWeight:'900',letterSpacing:2.2},title:{color:'#fff',fontSize:29,fontWeight:'900'},subtitle:{color:'#b8b8b8',lineHeight:19},stateBadge:{marginTop:8,borderRadius:14,paddingVertical:13,paddingHorizontal:15,alignSelf:'stretch'},ready:{backgroundColor:'#173622',borderWidth:1,borderColor:'#3f8754'},attention:{backgroundColor:'#493914',borderWidth:1,borderColor:'#8d7129'},blocked:{backgroundColor:'#4a1818',borderWidth:1,borderColor:'#873838'},stateText:{color:'#fff',fontWeight:'900',fontSize:15,textAlign:'center',letterSpacing:.5},summary:{color:'#d2d2d2',fontSize:12,textAlign:'center'},metaCard:{backgroundColor:'#181818',borderRadius:16,padding:14,borderWidth:1,borderColor:'#2b2b2b'},metaLabel:{color:'#d7b24c',fontWeight:'900',fontSize:11,letterSpacing:1.4},metaEvent:{color:'#fff',fontSize:19,fontWeight:'800',marginTop:4},metaId:{color:'#777',fontSize:10,marginTop:3},list:{gap:9},row:{flexDirection:'row',alignItems:'flex-start',gap:12,backgroundColor:'#171717',borderWidth:1,borderColor:'#2c2c2c',borderRadius:15,padding:13},icon:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'},iconText:{fontSize:19,fontWeight:'900'},rowCopy:{flex:1,gap:4},rowTitle:{color:'#fff',fontWeight:'800',fontSize:14},rowDetail:{color:'#aaa',fontSize:11,lineHeight:16},rowAction:{alignSelf:'flex-start',marginTop:5,borderWidth:1,borderColor:'#d7b24c',borderRadius:9,paddingHorizontal:10,paddingVertical:7},rowActionText:{color:'#d7b24c',fontSize:10,fontWeight:'900',letterSpacing:.7},actionMessage:{backgroundColor:'#1c2118',borderWidth:1,borderColor:'#4c653d',borderRadius:12,padding:11},actionMessageText:{color:'#d9efcd',fontSize:11,lineHeight:16,fontWeight:'700'},fixButton:{backgroundColor:'#211d14',borderWidth:1,borderColor:'#d7b24c',borderRadius:13,paddingVertical:14,alignItems:'center'},fixButtonText:{color:'#e4c56e',fontWeight:'900',letterSpacing:.7},qrButton:{backgroundColor:'#d7b24c',borderRadius:13,paddingVertical:14,alignItems:'center'},qrButtonText:{color:'#111',fontWeight:'900',letterSpacing:.7},refreshButton:{backgroundColor:'#fff',borderRadius:13,paddingVertical:14,alignItems:'center'},refreshText:{color:'#111',fontWeight:'900',letterSpacing:.7},checkedAt:{color:'#777',fontSize:10,textAlign:'center'},closeButton:{borderWidth:1,borderColor:'#4b4b4b',borderRadius:13,paddingVertical:12,alignItems:'center'},closeText:{color:'#d7b24c',fontWeight:'900',fontSize:11,letterSpacing:.7}
});