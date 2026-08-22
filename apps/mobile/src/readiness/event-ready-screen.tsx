import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StationExperienceApi } from '../api/station-api';
import type { AppLanguage } from '../experience/i18n';
import type { LocalStore } from '../offline/local-store';
import type { PersistedStationContext } from '../offline/types';
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
};

const copy:Record<AppLanguage,Copy>={
  fr:{eyebrow:'KHE EVENT READY',title:'Contrôle pré-événement',subtitle:'Vérification réelle de cette tablette avant l’arrivée des invités.',ready:'PRÊT POUR L’ÉVÉNEMENT',attention:'ATTENTION AVANT L’ÉVÉNEMENT',blocked:'ACTION REQUISE',refresh:'REVÉRIFIER',running:'VÉRIFICATION…',lastCheck:'Dernière vérification',event:'Événement',api:'Cloud & API',storage:'Stockage local',sync:'Synchronisation',camera:'Caméra',microphone:'Microphone',link:'Liaison CAPTURE ↔ SHARING',screen:'Écran événement',gallery:'Galerie SHARING',qr:'QR invité stable',ok:'Prêt',eventMismatch:'L’événement local et le serveur ne correspondent pas.',apiDown:'KHE Cloud est momentanément inaccessible.',storageDown:'Le stockage local n’est pas accessible.',noPending:'Aucun média en attente.',pending:'média(s) encore en attente ou en reprise.',cameraOk:'Permission caméra accordée.',cameraNo:'Autorisez la caméra avant la prestation.',micOk:'Permission microphone accordée pour la vidéo.',micNo:'Autorisez le microphone avant une capture vidéo.',linkOk:'Les deux tablettes se voient en temps réel.',linkPending:'La connexion est en cours ou attend une validation.',linkOff:'CAPTURE et SHARING ne sont pas encore reliées.',screenOk:'La tablette restera active pendant l’événement.',screenWarn:'La mise en veille est autorisée. Vérifiez que cela correspond à votre choix.',galleryOk:'La galerie Cloud répond correctement.',qrWaiting:'Le QR pourra être testé dès qu’un média synchronisé existe.',qrAvailable:'Un média synchronisé est disponible pour vérifier le QR stable.',qrTest:'TESTER LE QR STABLE',qrTesting:'TEST QR…',qrStable:'Même lien retourné deux fois : QR stable confirmé.',qrFail:'Le QR stable n’a pas pu être confirmé.',close:'RETOUR À L’ACCUEIL'},
  en:{eyebrow:'KHE EVENT READY',title:'Pre-event check',subtitle:'Real checks on this tablet before guests arrive.',ready:'READY FOR THE EVENT',attention:'CHECK BEFORE EVENT',blocked:'ACTION REQUIRED',refresh:'CHECK AGAIN',running:'CHECKING…',lastCheck:'Last check',event:'Event',api:'Cloud & API',storage:'Local storage',sync:'Synchronization',camera:'Camera',microphone:'Microphone',link:'CAPTURE ↔ SHARING link',screen:'Event screen',gallery:'SHARING gallery',qr:'Stable guest QR',ok:'Ready',eventMismatch:'Local and server events do not match.',apiDown:'KHE Cloud is temporarily unreachable.',storageDown:'Local storage is unavailable.',noPending:'No media waiting to sync.',pending:'media item(s) still waiting or retrying.',cameraOk:'Camera permission granted.',cameraNo:'Allow camera access before the event.',micOk:'Microphone permission granted for video.',micNo:'Allow microphone access before recording video.',linkOk:'Both tablets see each other in real time.',linkPending:'Connection is pending or waiting for approval.',linkOff:'CAPTURE and SHARING are not linked yet.',screenOk:'The tablet will stay awake during the event.',screenWarn:'Sleep is allowed. Make sure this matches your choice.',galleryOk:'Cloud gallery responds correctly.',qrWaiting:'QR can be tested once one synchronized media exists.',qrAvailable:'A synchronized media item is available to test the stable QR.',qrTest:'TEST STABLE QR',qrTesting:'TESTING QR…',qrStable:'Same link returned twice: stable QR confirmed.',qrFail:'Stable QR could not be confirmed.',close:'BACK TO HOME'},
  de:{eyebrow:'KHE EVENT READY',title:'Vorabprüfung',subtitle:'Echte Prüfung dieses Tablets vor dem Event.',ready:'BEREIT FÜR DAS EVENT',attention:'VOR DEM EVENT PRÜFEN',blocked:'AKTION ERFORDERLICH',refresh:'ERNEUT PRÜFEN',running:'PRÜFUNG…',lastCheck:'Letzte Prüfung',event:'Event',api:'Cloud & API',storage:'Lokaler Speicher',sync:'Synchronisierung',camera:'Kamera',microphone:'Mikrofon',link:'CAPTURE ↔ SHARING',screen:'Event-Bildschirm',gallery:'SHARING-Galerie',qr:'Stabiler Gäste-QR',ok:'Bereit',eventMismatch:'Lokales und Server-Event stimmen nicht überein.',apiDown:'KHE Cloud ist derzeit nicht erreichbar.',storageDown:'Lokaler Speicher ist nicht verfügbar.',noPending:'Keine Medien warten.',pending:'Medien warten noch auf Synchronisierung.',cameraOk:'Kamerazugriff erlaubt.',cameraNo:'Kamerazugriff vor dem Event erlauben.',micOk:'Mikrofonzugriff erlaubt.',micNo:'Mikrofonzugriff für Video erlauben.',linkOk:'Beide Tablets sind in Echtzeit verbunden.',linkPending:'Verbindung wartet auf Freigabe.',linkOff:'CAPTURE und SHARING sind noch nicht verbunden.',screenOk:'Tablet bleibt während des Events aktiv.',screenWarn:'Standby ist erlaubt. Einstellung prüfen.',galleryOk:'Cloud-Galerie antwortet.',qrWaiting:'QR kann nach dem ersten synchronisierten Medium getestet werden.',qrAvailable:'Synchronisiertes Medium für QR-Test verfügbar.',qrTest:'STABILEN QR TESTEN',qrTesting:'QR-TEST…',qrStable:'Gleicher Link zweimal: stabiler QR bestätigt.',qrFail:'Stabiler QR konnte nicht bestätigt werden.',close:'ZURÜCK ZUM START'},
  it:{eyebrow:'KHE EVENT READY',title:'Controllo pre-evento',subtitle:'Controllo reale del tablet prima degli ospiti.',ready:'PRONTO PER L’EVENTO',attention:'CONTROLLARE PRIMA DELL’EVENTO',blocked:'AZIONE RICHIESTA',refresh:'RICONTROLLA',running:'CONTROLLO…',lastCheck:'Ultimo controllo',event:'Evento',api:'Cloud & API',storage:'Memoria locale',sync:'Sincronizzazione',camera:'Fotocamera',microphone:'Microfono',link:'CAPTURE ↔ SHARING',screen:'Schermo evento',gallery:'Galleria SHARING',qr:'QR ospite stabile',ok:'Pronto',eventMismatch:'Evento locale e server non coincidono.',apiDown:'KHE Cloud non è raggiungibile.',storageDown:'Memoria locale non disponibile.',noPending:'Nessun media in attesa.',pending:'media ancora in attesa o in ripresa.',cameraOk:'Permesso fotocamera concesso.',cameraNo:'Consenti la fotocamera prima dell’evento.',micOk:'Permesso microfono concesso.',micNo:'Consenti il microfono per i video.',linkOk:'I due tablet sono collegati in tempo reale.',linkPending:'Connessione in attesa di conferma.',linkOff:'CAPTURE e SHARING non sono ancora collegati.',screenOk:'Il tablet resterà attivo durante l’evento.',screenWarn:'Lo standby è consentito. Verifica la scelta.',galleryOk:'La galleria Cloud risponde.',qrWaiting:'Il QR sarà testabile dopo il primo media sincronizzato.',qrAvailable:'Media sincronizzato disponibile per il test QR.',qrTest:'TESTA QR STABILE',qrTesting:'TEST QR…',qrStable:'Stesso link due volte: QR stabile confermato.',qrFail:'QR stabile non confermato.',close:'TORNA ALLA HOME'},
  es:{eyebrow:'KHE EVENT READY',title:'Control previo al evento',subtitle:'Comprobación real de la tableta antes de los invitados.',ready:'LISTO PARA EL EVENTO',attention:'REVISAR ANTES DEL EVENTO',blocked:'ACCIÓN NECESARIA',refresh:'REVISAR DE NUEVO',running:'COMPROBANDO…',lastCheck:'Última comprobación',event:'Evento',api:'Cloud & API',storage:'Almacenamiento local',sync:'Sincronización',camera:'Cámara',microphone:'Micrófono',link:'CAPTURE ↔ SHARING',screen:'Pantalla del evento',gallery:'Galería SHARING',qr:'QR estable para invitados',ok:'Listo',eventMismatch:'El evento local y el del servidor no coinciden.',apiDown:'KHE Cloud no está disponible.',storageDown:'El almacenamiento local no está disponible.',noPending:'No hay medios pendientes.',pending:'medio(s) todavía pendiente(s) o reintentando.',cameraOk:'Permiso de cámara concedido.',cameraNo:'Autoriza la cámara antes del evento.',micOk:'Permiso de micrófono concedido.',micNo:'Autoriza el micrófono para vídeo.',linkOk:'Las dos tabletas están conectadas en tiempo real.',linkPending:'La conexión espera confirmación.',linkOff:'CAPTURE y SHARING aún no están conectados.',screenOk:'La tableta permanecerá activa.',screenWarn:'El modo reposo está permitido. Revisa la opción.',galleryOk:'La galería Cloud responde.',qrWaiting:'El QR se podrá probar tras el primer medio sincronizado.',qrAvailable:'Hay un medio sincronizado para probar el QR.',qrTest:'PROBAR QR ESTABLE',qrTesting:'PROBANDO QR…',qrStable:'Mismo enlace dos veces: QR estable confirmado.',qrFail:'No se pudo confirmar el QR estable.',close:'VOLVER AL INICIO'},
  pt:{eyebrow:'KHE EVENT READY',title:'Verificação pré-evento',subtitle:'Verificação real do tablet antes dos convidados.',ready:'PRONTO PARA O EVENTO',attention:'VERIFICAR ANTES DO EVENTO',blocked:'AÇÃO NECESSÁRIA',refresh:'VERIFICAR NOVAMENTE',running:'A VERIFICAR…',lastCheck:'Última verificação',event:'Evento',api:'Cloud & API',storage:'Armazenamento local',sync:'Sincronização',camera:'Câmara',microphone:'Microfone',link:'CAPTURE ↔ SHARING',screen:'Ecrã do evento',gallery:'Galeria SHARING',qr:'QR estável para convidados',ok:'Pronto',eventMismatch:'O evento local e o servidor não correspondem.',apiDown:'KHE Cloud está temporariamente indisponível.',storageDown:'Armazenamento local indisponível.',noPending:'Nenhum média pendente.',pending:'média(s) ainda pendente(s) ou em nova tentativa.',cameraOk:'Permissão da câmara concedida.',cameraNo:'Autorize a câmara antes do evento.',micOk:'Permissão do microfone concedida.',micNo:'Autorize o microfone para vídeo.',linkOk:'Os dois tablets estão ligados em tempo real.',linkPending:'A ligação aguarda confirmação.',linkOff:'CAPTURE e SHARING ainda não estão ligados.',screenOk:'O tablet ficará ativo durante o evento.',screenWarn:'O modo de espera é permitido. Confirme a opção.',galleryOk:'A galeria Cloud responde.',qrWaiting:'O QR poderá ser testado após o primeiro média sincronizado.',qrAvailable:'Existe um média sincronizado para testar o QR.',qrTest:'TESTAR QR ESTÁVEL',qrTesting:'TESTE QR…',qrStable:'Mesmo link duas vezes: QR estável confirmado.',qrFail:'Não foi possível confirmar o QR estável.',close:'VOLTAR AO INÍCIO'}
};

const tone:Record<ReadinessLevel,{symbol:string;color:string;background:string}>={
  PASS:{symbol:'✓',color:'#bfe9c9',background:'#173622'},WARN:{symbol:'!',color:'#ffe5a0',background:'#493914'},BLOCK:{symbol:'×',color:'#ffc2c2',background:'#4a1818'},INFO:{symbol:'•',color:'#d7d7d7',background:'#292929'}
};

export function EventReadyScreen({api,store,station,stationToken,eventName,language,keepAwakeEnabled,onClose}:Props){
  const c=copy[language];
  const[cameraPermission]=useCameraPermissions();
  const[microphonePermission]=useMicrophonePermissions();
  const[checks,setChecks]=useState<ReadinessCheck[]>([]);
  const[running,setRunning]=useState(false);
  const[lastCheckedAt,setLastCheckedAt]=useState<Date|null>(null);
  const[syncedMediaIds,setSyncedMediaIds]=useState<string[]>([]);
  const[qrTesting,setQrTesting]=useState(false);
  const[qrCheck,setQrCheck]=useState<ReadinessCheck|null>(null);

  const runChecks=useCallback(async()=>{
    setRunning(true);setQrCheck(null);
    const next:ReadinessCheck[]=[];
    let snapshotError=false;let pendingCount=0;
    try{
      await store.init();
      const snapshot=await store.snapshot(station.session.eventId);
      pendingCount=snapshot.pendingMedia.length;
      next.push({id:'storage',title:c.storage,detail:c.ok,level:'PASS'});
      next.push({id:'sync',title:c.sync,detail:pendingCount===0?c.noPending:`${pendingCount} ${c.pending}`,level:pendingCount===0?'PASS':'WARN'});
    }catch{
      snapshotError=true;
      next.push({id:'storage',title:c.storage,detail:c.storageDown,level:'BLOCK'});
      next.push({id:'sync',title:c.sync,detail:c.storageDown,level:'BLOCK'});
    }

    const remoteManifestPromise=api.manifest(stationToken);
    const controlPromise=api.control(stationToken);
    const mediaPromise=station.mode==='SHARING'?api.listMedia(stationToken):Promise.resolve([]);
    const[manifestResult,controlResult,mediaResult]=await Promise.allSettled([remoteManifestPromise,controlPromise,mediaPromise]);

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
      next.push({id:'camera',title:c.camera,detail:cameraPermission?.granted?c.cameraOk:c.cameraNo,level:cameraPermission?.granted?'PASS':'BLOCK'});
      next.push({id:'microphone',title:c.microphone,detail:microphonePermission?.granted?c.micOk:c.micNo,level:microphonePermission?.granted?'PASS':'BLOCK'});
    }

    if(controlResult.status==='fulfilled'){
      const control=controlResult.value;
      const accepted=control.sharingConnectionStatus==='ACCEPTED';
      const fresh=isRecentHeartbeat(control.captureSeenAt);
      const level:ReadinessLevel=accepted&&fresh?'PASS':control.sharingConnectionStatus==='PENDING'?'WARN':'WARN';
      const detail=accepted&&fresh?c.linkOk:control.sharingConnectionStatus==='PENDING'?c.linkPending:c.linkOff;
      next.push({id:'link',title:c.link,detail,level});
    }else{
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

    if(snapshotError&&pendingCount===0){/* keep the explicit storage failure visible */}
    setChecks(next);setLastCheckedAt(new Date());setRunning(false);
  },[api,c, cameraPermission?.granted,eventName,keepAwakeEnabled,microphonePermission?.granted,station,stationToken,store]);

  useEffect(()=>{void runChecks();},[runChecks]);

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

  const visibleChecks=useMemo(()=>qrCheck?[...checks.filter((item)=>item.id!=='qr'),qrCheck]:checks,[checks,qrCheck]);
  const state=eventReadyState(visibleChecks);const blocks=countBlockingChecks(visibleChecks);const warnings=countWarnings(visibleChecks);
  const stateLabel=state==='READY'?c.ready:state==='ATTENTION'?c.attention:c.blocked;

  return <View style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>{c.eyebrow}</Text><Text style={styles.title}>{c.title}</Text><Text style={styles.subtitle}>{c.subtitle}</Text>
      <View style={[styles.stateBadge,state==='READY'?styles.ready:state==='ATTENTION'?styles.attention:styles.blocked]}><Text style={styles.stateText}>{running?'…':state==='READY'?'✓':state==='ATTENTION'?'!':'×'} {running?c.running:stateLabel}</Text></View>
      {!running?<Text style={styles.summary}>{blocks>0?`${blocks} blocage(s)`:warnings>0?`${warnings} point(s) à vérifier`:'Tous les contrôles essentiels sont au vert.'}</Text>:null}
    </View>

    <View style={styles.metaCard}><Text style={styles.metaLabel}>{station.mode}</Text><Text style={styles.metaEvent}>{eventName}</Text><Text style={styles.metaId}>{station.session.eventId}</Text></View>

    {running&&!checks.length?<ActivityIndicator color="#d7b24c" style={{marginVertical:24}}/>:null}
    <View style={styles.list}>{visibleChecks.map((check)=>{const theme=tone[check.level];return <View key={check.id} style={styles.row}><View style={[styles.icon,{backgroundColor:theme.background}]}><Text style={[styles.iconText,{color:theme.color}]}>{theme.symbol}</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{check.title}</Text><Text style={styles.rowDetail}>{check.detail}</Text></View></View>;})}</View>

    {station.mode==='SHARING'&&syncedMediaIds.length>0?<Pressable disabled={qrTesting||running} onPress={()=>void testStableQr()} style={styles.qrButton}><Text style={styles.qrButtonText}>{qrTesting?c.qrTesting:c.qrTest}</Text></Pressable>:null}
    <Pressable disabled={running} onPress={()=>void runChecks()} style={styles.refreshButton}><Text style={styles.refreshText}>{running?c.running:c.refresh}</Text></Pressable>
    {lastCheckedAt?<Text style={styles.checkedAt}>{c.lastCheck} • {lastCheckedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}</Text>:null}
    <Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>{c.close}</Text></Pressable>
  </ScrollView></View>;
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#0d0d0d'},content:{padding:18,paddingBottom:42,gap:14,maxWidth:760,width:'100%',alignSelf:'center'},hero:{backgroundColor:'#151515',borderRadius:24,borderWidth:1,borderColor:'#3a321e',padding:20,gap:8},eyebrow:{color:'#d7b24c',fontSize:11,fontWeight:'900',letterSpacing:2.2},title:{color:'#fff',fontSize:29,fontWeight:'900'},subtitle:{color:'#b8b8b8',lineHeight:19},stateBadge:{marginTop:8,borderRadius:14,paddingVertical:13,paddingHorizontal:15,alignSelf:'stretch'},ready:{backgroundColor:'#173622',borderWidth:1,borderColor:'#3f8754'},attention:{backgroundColor:'#493914',borderWidth:1,borderColor:'#8d7129'},blocked:{backgroundColor:'#4a1818',borderWidth:1,borderColor:'#873838'},stateText:{color:'#fff',fontWeight:'900',fontSize:15,textAlign:'center',letterSpacing:.5},summary:{color:'#d2d2d2',fontSize:12,textAlign:'center'},metaCard:{backgroundColor:'#181818',borderRadius:16,padding:14,borderWidth:1,borderColor:'#2b2b2b'},metaLabel:{color:'#d7b24c',fontWeight:'900',fontSize:11,letterSpacing:1.4},metaEvent:{color:'#fff',fontSize:19,fontWeight:'800',marginTop:4},metaId:{color:'#777',fontSize:10,marginTop:3},list:{gap:9},row:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#171717',borderWidth:1,borderColor:'#2c2c2c',borderRadius:15,padding:13},icon:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'},iconText:{fontSize:19,fontWeight:'900'},rowCopy:{flex:1,gap:2},rowTitle:{color:'#fff',fontWeight:'850',fontSize:14},rowDetail:{color:'#aaa',fontSize:11,lineHeight:16},qrButton:{backgroundColor:'#d7b24c',borderRadius:13,paddingVertical:14,alignItems:'center'},qrButtonText:{color:'#111',fontWeight:'950',letterSpacing:.7},refreshButton:{backgroundColor:'#fff',borderRadius:13,paddingVertical:14,alignItems:'center'},refreshText:{color:'#111',fontWeight:'900',letterSpacing:.7},checkedAt:{color:'#777',fontSize:10,textAlign:'center'},closeButton:{borderWidth:1,borderColor:'#4b4b4b',borderRadius:13,paddingVertical:12,alignItems:'center'},closeText:{color:'#d7b24c',fontWeight:'900',fontSize:11,letterSpacing:.7}
});
