import type { StationLiveSessionContract } from '@khe/contracts';
import { isTrackReference, LiveKitRoom, registerGlobals, useConnectionState, useTracks, VideoTrack } from '@livekit/react-native';
import { ConnectionState, Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationApi } from '../api/station-api';

registerGlobals({ autoConfigureAudioSession: false });
export type LivePreviewState='OFF'|'LOADING'|'CONNECTING'|'LIVE'|'UNAVAILABLE'|'ERROR';

function useLiveSession(api:StationApi,stationToken:string,enabled:boolean,retryNonce=0){
  const[session,setSession]=useState<StationLiveSessionContract|null>(null);const[error,setError]=useState<string|null>(null);const[loading,setLoading]=useState(enabled);
  useEffect(()=>{let cancelled=false;let timer:ReturnType<typeof setTimeout>|null=null;if(!enabled){setSession(null);setError(null);setLoading(false);return()=>undefined;}
    const load=async()=>{setLoading(true);try{const next=await api.liveSession(stationToken);if(cancelled)return;setSession(next);setError(null);}catch(reason){if(cancelled)return;setSession(null);setError(reason instanceof Error?reason.message:'Canal live indisponible.');timer=setTimeout(()=>void load(),5000);}finally{if(!cancelled)setLoading(false);}};void load();return()=>{cancelled=true;if(timer)clearTimeout(timer);};
  },[api,enabled,retryNonce,stationToken]);return{session,error,loading};
}

export function CaptureLivePublisher({api,stationToken,enabled,onStateChange}:{api:StationApi;stationToken:string;enabled:boolean;onStateChange?:(state:LivePreviewState,detail?:string)=>void}){
  const{session,error,loading}=useLiveSession(api,stationToken,enabled);
  useEffect(()=>{if(!enabled)onStateChange?.('OFF');else if(loading)onStateChange?.('LOADING');else if(error)onStateChange?.('UNAVAILABLE',error);else if(session)onStateChange?.('CONNECTING');},[enabled,error,loading,onStateChange,session]);
  if(!enabled||!session)return null;
  return <LiveKitRoom serverUrl={session.serverUrl} token={session.participantToken} connect audio={false} video={false} screen connectOptions={{autoSubscribe:false}} options={{adaptiveStream:true,dynacast:true}} onConnected={()=>onStateChange?.('LIVE')} onDisconnected={()=>onStateChange?.('CONNECTING')} onError={reason=>onStateChange?.('ERROR',reason.message)} onMediaDeviceFailure={reason=>onStateChange?.('ERROR',reason?String(reason):'Partage écran indisponible')}><View/></LiveKitRoom>;
}

function RemoteScreen(){const state=useConnectionState();const screen=useTracks([Track.Source.ScreenShare]).find(track=>isTrackReference(track));if(screen&&isTrackReference(screen))return <VideoTrack trackRef={screen} style={styles.video}/>;const connecting=state===ConnectionState.Connecting||state===ConnectionState.Reconnecting;return <View style={styles.placeholder}>{connecting?<ActivityIndicator/>:null}<Text style={styles.title}>{state===ConnectionState.Connected?'LIVE AUTORISÉ':'CONNEXION LIVE'}</Text><Text style={styles.help}>{state===ConnectionState.Connected?'Le flux reste actif pendant l’événement, sans nouvelle action à chaque prise.':'Connexion sécurisée à la station CAPTURE…'}</Text></View>;}

export function SharingLivePreview({api,stationToken}:{api:StationApi;stationToken:string}){const[retry,setRetry]=useState(0);const{session,error,loading}=useLiveSession(api,stationToken,true,retry);if(loading&&!session)return <View style={styles.placeholder}><ActivityIndicator/><Text style={styles.title}>PRÉPARATION DU LIVE</Text></View>;if(!session)return <View style={styles.placeholder}><Text style={styles.title}>LIVE INDISPONIBLE</Text><Text style={styles.help}>{error}</Text><Pressable style={styles.retry} onPress={()=>setRetry(value=>value+1)}><Text style={styles.retryText}>RÉESSAYER</Text></Pressable></View>;return <View style={styles.frame}><LiveKitRoom serverUrl={session.serverUrl} token={session.participantToken} connect audio={false} video={false} screen={false} connectOptions={{autoSubscribe:true}} options={{adaptiveStream:{pixelDensity:'screen'}}}><RemoteScreen/></LiveKitRoom></View>;}

const styles=StyleSheet.create({frame:{minHeight:190,aspectRatio:16/9,overflow:'hidden',borderRadius:18,backgroundColor:'#050505'},video:{flex:1},placeholder:{minHeight:190,borderRadius:18,backgroundColor:'#121212',padding:18,alignItems:'center',justifyContent:'center',gap:8},title:{color:'#fff',fontSize:12,fontWeight:'900',letterSpacing:1.4},help:{color:'#c8c8c8',fontSize:11,lineHeight:17,textAlign:'center'},retry:{borderWidth:1,borderColor:'#fff',borderRadius:10,paddingHorizontal:14,paddingVertical:8},retryText:{color:'#fff',fontSize:10,fontWeight:'900'}});
