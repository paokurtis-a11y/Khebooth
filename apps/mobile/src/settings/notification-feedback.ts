import { createAudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { Vibration } from 'react-native';

export type NotificationPreferences={enabled:boolean;soundEnabled:boolean;sound:string;soundVolume:number;vibrationEnabled:boolean;vibrationMode:string;vibrationIntensity:string};
export const DEFAULT_NOTIFICATION_PREFERENCES:NotificationPreferences={enabled:true,soundEnabled:true,sound:'khe_chime',soundVolume:70,vibrationEnabled:true,vibrationMode:'double',vibrationIntensity:'medium'};
const KEY='khe.notification.preferences.v1';

export async function loadNotificationPreferences():Promise<NotificationPreferences>{const raw=await SecureStore.getItemAsync(KEY);if(!raw)return DEFAULT_NOTIFICATION_PREFERENCES;try{return{...DEFAULT_NOTIFICATION_PREFERENCES,...JSON.parse(raw) as Partial<NotificationPreferences>};}catch{return DEFAULT_NOTIFICATION_PREFERENCES;}}
export async function saveNotificationPreferences(value:NotificationPreferences):Promise<void>{await SecureStore.setItemAsync(KEY,JSON.stringify(value),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}

const SOUND_NOTES:Record<string,number[]>={
  default:[640],
  khe_chime:[760,980],
  khe_gold:[920,1160,1380],
  khe_pulse:[520,680],
  khe_flash:[1040,1320],
  khe_velvet:[540,640,760],
  khe_victory:[660,880,1100,1320],
  khe_night:[420,560,720],
};

function wavForTone(notes:number[]):Uint8Array{
  const sampleRate=22050;const noteDuration=.15;const gap=.025;const duration=Math.max(.2,notes.length*noteDuration+(notes.length-1)*gap);const samples=Math.floor(sampleRate*duration);const bytes=new Uint8Array(44+samples*2);const view=new DataView(bytes.buffer);
  const write=(offset:number,text:string)=>{for(let i=0;i<text.length;i+=1)bytes[offset+i]=text.charCodeAt(i);};
  write(0,'RIFF');view.setUint32(4,36+samples*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples*2,true);
  for(let i=0;i<samples;i+=1){const t=i/sampleRate;const slot=noteDuration+gap;const noteIndex=Math.min(notes.length-1,Math.floor(t/slot));const within=t-noteIndex*slot;let value=0;if(within<noteDuration){const frequency=notes[noteIndex]??760;const envelope=Math.max(0,1-within/noteDuration);value=(Math.sin(2*Math.PI*frequency*within)*.72+Math.sin(2*Math.PI*frequency*1.5*within)*.28)*envelope;}view.setInt16(44+i*2,Math.max(-32767,Math.min(32767,Math.round(value*20500))),true);}return bytes;
}

async function toneUri(sound:string):Promise<string>{const notes=SOUND_NOTES[sound]??SOUND_NOTES.khe_chime;const file=new File(Paths.cache,`khe-${sound}-v2.wav`);if(!file.exists){file.create({intermediates:true,overwrite:true});file.write(wavForTone(notes));}return file.uri;}

export async function playNotificationFeedback(preferences:NotificationPreferences):Promise<void>{
  if(!preferences.enabled)return;
  if(preferences.vibrationEnabled&&preferences.vibrationMode!=='off'){
    const factor=preferences.vibrationIntensity==='strong'?1.5:preferences.vibrationIntensity==='light'?0.7:1;
    const unit=Math.round(90*factor);const patterns:Record<string,number[]>={short:[0,unit],double:[0,unit,80,unit],triple:[0,unit,70,unit,70,unit],long:[0,unit*3],heartbeat:[0,unit,65,unit*2,150,unit]};Vibration.vibrate(patterns[preferences.vibrationMode]||[0,unit]);
  }
  if(preferences.soundEnabled&&preferences.sound!=='silent'){
    try{const uri=await toneUri(preferences.sound);const player=createAudioPlayer({uri});player.volume=Math.max(0,Math.min(1,preferences.soundVolume/100));player.play();setTimeout(()=>{try{const disposable=player as unknown as {release?:()=>void;remove?:()=>void};if(disposable.release)disposable.release();else disposable.remove?.();}catch{}},1800);}catch{/* La vibration reste disponible si l’audio n’est pas pris en charge. */}
  }
}