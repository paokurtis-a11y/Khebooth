import { useAudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StationExperienceApi } from '../api/station-api';

export type AudioMode = 'MUSIC_ONLY' | 'MIC_ONLY';
export type SpeedEffect = '0.5x' | '0.75x' | '1x' | '1.25x' | '1.5x' | '2x';
export type DesignTemplate = 'NONE' | 'WEDDING' | 'BIRTHDAY' | 'GALA' | 'BABY' | 'CUSTOM';

export interface MusicAsset {
  id: string;
  name: string;
  uri: string;
  mimeType?: string;
  trimMode: 'FULL' | 'SEGMENT';
  startSeconds: number;
  endSeconds: number | null;
  volume: number;
}

export interface DesignBackgroundAsset {
  localUri: string | null;
  cloudPath: string | null;
  mimeType: string;
  byteSize: number;
  cropX: number;
  cropY: number;
  zoom: number;
  opacity: number;
}

export interface CreativePlan {
  template: DesignTemplate;
  title: string;
  subtitle: string;
  frameStyle: 'NONE' | 'CLASSIC' | 'GOLD' | 'NEON' | 'POLAROID';
  textPosition: 'TOP' | 'CENTER' | 'BOTTOM';
  speed: SpeedEffect;
  boomerang: boolean;
  reverse: boolean;
  freezeFrame: boolean;
  colorEffect: 'NONE' | 'WARM' | 'COOL' | 'GOLD' | 'MONO' | 'PARTY';
  audioMode: AudioMode;
  musicRotationEvery: number;
  music: MusicAsset[];
  background: DesignBackgroundAsset | null;
}

const STORAGE_KEY = 'khe.creative.plan.v1';
const KHE_RED = '#b31520';
const KHE_GOLD = '#d2ad4f';
const KHE_BLACK = '#0d0d0f';
const KHE_GREEN = '#16804a';

export const DEFAULT_CREATIVE_PLAN: CreativePlan = {
  template: 'NONE', title: '', subtitle: '', frameStyle: 'NONE', textPosition: 'BOTTOM', speed: '1x', boomerang: false, reverse: false, freezeFrame: false,
  colorEffect: 'NONE', audioMode: 'MIC_ONLY', musicRotationEvery: 3, music: [], background: null,
};

const templateLabels: Record<DesignTemplate, string> = {
  NONE: 'Sans design', WEDDING: 'Heureux mariage', BIRTHDAY: 'Joyeux anniversaire', GALA: 'Soirée / Gala', BABY: 'Baby shower', CUSTOM: 'Création libre',
};

function normalizeMusic(asset: Partial<MusicAsset> & Pick<MusicAsset, 'id' | 'name' | 'uri'>): MusicAsset {
  return { id:asset.id,name:asset.name,uri:asset.uri,mimeType:asset.mimeType,trimMode:asset.trimMode==='SEGMENT'?'SEGMENT':'FULL',startSeconds:Number.isFinite(asset.startSeconds)?Math.max(0,Number(asset.startSeconds)):0,endSeconds:Number.isFinite(asset.endSeconds)?Math.max(0,Number(asset.endSeconds)):null,volume:Number.isFinite(asset.volume)?Math.min(100,Math.max(0,Number(asset.volume))):100 };
}

function normalizeBackground(value: unknown): DesignBackgroundAsset | null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const item=value as Partial<DesignBackgroundAsset>;
  if(!item.localUri&&!item.cloudPath)return null;
  return{
    localUri:typeof item.localUri==='string'?item.localUri:null,
    cloudPath:typeof item.cloudPath==='string'?item.cloudPath:null,
    mimeType:typeof item.mimeType==='string'?item.mimeType:'image/jpeg',
    byteSize:Number.isFinite(item.byteSize)?Math.max(0,Number(item.byteSize)):0,
    cropX:Number.isFinite(item.cropX)?Math.max(-50,Math.min(50,Number(item.cropX))):0,
    cropY:Number.isFinite(item.cropY)?Math.max(-50,Math.min(50,Number(item.cropY))):0,
    zoom:Number.isFinite(item.zoom)?Math.max(1,Math.min(3,Number(item.zoom))):1,
    opacity:Number.isFinite(item.opacity)?Math.max(0.15,Math.min(1,Number(item.opacity))):0.55,
  };
}

export async function loadCreativePlan(): Promise<CreativePlan> {
  const raw=await SecureStore.getItemAsync(STORAGE_KEY);if(!raw)return DEFAULT_CREATIVE_PLAN;
  try{const parsed=JSON.parse(raw) as Partial<CreativePlan>;return{...DEFAULT_CREATIVE_PLAN,...parsed,music:Array.isArray(parsed.music)?parsed.music.slice(0,3).map((asset)=>normalizeMusic(asset as MusicAsset)):[],background:normalizeBackground(parsed.background)}}catch{return DEFAULT_CREATIVE_PLAN;}
}

export async function saveCreativePlan(plan: CreativePlan): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEY,JSON.stringify(plan),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
}

async function hasSavedCreativePlan():Promise<boolean>{return Boolean(await SecureStore.getItemAsync(STORAGE_KEY));}
function parseSeconds(value:string,fallback:number|null):number|null{if(!value.trim())return null;const parsed=Number(value.replace(',','.'));return Number.isFinite(parsed)?Math.max(0,parsed):fallback;}

function MusicEditor({asset,disabled,onChange,onRemove}:{asset:MusicAsset;disabled:boolean;onChange:(patch:Partial<MusicAsset>)=>void;onRemove:()=>void}){
  const player=useAudioPlayer(asset.uri);const[playing,setPlaying]=useState(false);
  async function toggle(){if(playing){player.pause();setPlaying(false);return;}const audio=player as unknown as{volume:number};audio.volume=Math.max(0,Math.min(1,asset.volume/100));await player.seekTo(asset.trimMode==='SEGMENT'?asset.startSeconds:0);player.play();setPlaying(true);}
  return <View style={styles.musicCard}><View style={styles.musicHeader}><View style={{flex:1}}><Text style={styles.musicName} numberOfLines={1}>{asset.name}</Text><Text style={styles.help}>Choisissez le passage et son niveau sonore.</Text></View><Pressable style={styles.listenButton} onPress={()=>void toggle()}><Text style={styles.listenText}>{playing?'Pause':'Écouter'}</Text></Pressable>{!disabled?<Pressable style={styles.removeButton} onPress={onRemove}><Text style={styles.removeText}>×</Text></Pressable>:null}</View><View style={styles.wrap}><Pressable disabled={disabled} style={[styles.chip,asset.trimMode==='FULL'&&styles.chipActive]} onPress={()=>onChange({trimMode:'FULL',startSeconds:0,endSeconds:null})}><Text style={asset.trimMode==='FULL'?styles.chipTextActive:styles.chipText}>Audio complet</Text></Pressable><Pressable disabled={disabled} style={[styles.chip,asset.trimMode==='SEGMENT'&&styles.chipActive]} onPress={()=>onChange({trimMode:'SEGMENT'})}><Text style={asset.trimMode==='SEGMENT'?styles.chipTextActive:styles.chipText}>Couper un extrait</Text></Pressable></View>{asset.trimMode==='SEGMENT'?<View style={styles.audioGrid}><View style={styles.audioField}><Text style={styles.audioLabel}>Début (s)</Text><TextInput editable={!disabled} keyboardType="decimal-pad" value={String(asset.startSeconds)} onChangeText={(value)=>onChange({startSeconds:parseSeconds(value,asset.startSeconds)??0})} style={styles.audioInput}/></View><View style={styles.audioField}><Text style={styles.audioLabel}>Fin (s)</Text><TextInput editable={!disabled} keyboardType="decimal-pad" value={asset.endSeconds===null?'':String(asset.endSeconds)} onChangeText={(value)=>onChange({endSeconds:parseSeconds(value,asset.endSeconds)})} style={styles.audioInput}/></View></View>:null}<View style={styles.wrap}>{[25,50,75,100].map((value)=><Pressable key={value} disabled={disabled} style={[styles.chip,asset.volume===value&&styles.chipActive]} onPress={()=>onChange({volume:value})}><Text style={asset.volume===value?styles.chipTextActive:styles.chipText}>{value}%</Text></Pressable>)}</View></View>;
}

interface CreativeStudioProps {
  onClose:()=>void;
  api?:StationExperienceApi;
  stationToken?:string;
  eventId?:string;
  onSaved?:(plan:CreativePlan)=>Promise<void>|void;
}

export function CreativeStudio({onClose,api,stationToken,eventId,onSaved}:CreativeStudioProps){
  const scrollRef=useRef<ScrollView>(null);const[plan,setPlan]=useState<CreativePlan>(DEFAULT_CREATIVE_PLAN);const[locked,setLocked]=useState(false);const[saving,setSaving]=useState(false);const[message,setMessage]=useState('');
  useEffect(()=>{void Promise.all([loadCreativePlan(),hasSavedCreativePlan()]).then(([savedPlan,exists])=>{setPlan(savedPlan);setLocked(exists);});},[]);
  const presetText=useMemo(()=>plan.template==='WEDDING'?['Heureux mariage','Merci de partager ce moment avec nous']:plan.template==='BIRTHDAY'?['Joyeux anniversaire','Un souvenir rien que pour vous']:plan.template==='GALA'?['Soirée exceptionnelle','KHE Booth']:plan.template==='BABY'?['Bienvenue bébé','Un joli souvenir']:['',''],[plan.template]);
  function patch(value:Partial<CreativePlan>){if(locked)return;setPlan((current)=>({...current,...value}));setMessage('');}
  function patchMusic(id:string,value:Partial<MusicAsset>){patch({music:plan.music.map((item)=>item.id===id?{...item,...value}:item)});}
  function patchBackground(value:Partial<DesignBackgroundAsset>){if(locked||!plan.background)return;patch({background:{...plan.background,...value}});}
  function chooseTemplate(template:DesignTemplate){if(locked)return;const defaults=template==='WEDDING'?['Heureux mariage','Merci de partager ce moment avec nous']:template==='BIRTHDAY'?['Joyeux anniversaire','Un souvenir rien que pour vous']:template==='GALA'?['Soirée exceptionnelle','KHE Booth']:template==='BABY'?['Bienvenue bébé','Un joli souvenir']:['',''];patch({template,title:defaults[0],subtitle:defaults[1]});}
  async function importMusic(){if(locked)return;if(plan.music.length>=3){Alert.alert('Maximum atteint','Vous pouvez sélectionner jusqu’à 3 musiques.');return;}const result=await DocumentPicker.getDocumentAsync({type:['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/*'],multiple:true,copyToCacheDirectory:true});if(result.canceled)return;const remaining=3-plan.music.length;const additions=result.assets.slice(0,remaining).map((asset,index)=>normalizeMusic({id:`music-${Date.now()}-${index}`,name:asset.name,uri:asset.uri,mimeType:asset.mimeType}));patch({music:[...plan.music,...additions]});}
  async function importBackground(){if(locked)return;const result=await DocumentPicker.getDocumentAsync({type:['image/jpeg','image/png','image/webp','image/*'],multiple:false,copyToCacheDirectory:true});if(result.canceled||!result.assets[0])return;try{const asset=result.assets[0];const source=new File(asset.uri);const directory=new Directory(Paths.document,'studio-backgrounds');await directory.create({idempotent:true,intermediates:true});const extension=asset.name?.split('.').pop()?.toLowerCase()||'jpg';const destination=new File(directory,`background-${Date.now()}.${extension}`);await source.copy(destination);patch({background:{localUri:destination.uri,cloudPath:null,mimeType:asset.mimeType||'image/jpeg',byteSize:destination.size,cropX:0,cropY:0,zoom:1,opacity:0.55}});setMessage('Image ajoutée. Utilisez le cadrage assisté ci-dessous.');}catch(error){setMessage(error instanceof Error?error.message:'Impossible de charger l’image.');}}
  async function uploadBackground(current:CreativePlan):Promise<CreativePlan>{const background=current.background;if(!background?.localUri||background.cloudPath||!api||!stationToken||!eventId)return current;const file=new File(background.localUri);if(!file.exists||file.size<=0)throw new Error('L’image de fond locale est introuvable.');const ticket=await api.prepareDesignBackgroundUpload(stationToken,eventId,background.mimeType||'image/jpeg',file.size);const task=file.createUploadTask(ticket.uploadUrl,{httpMethod:'PUT',mimeType:background.mimeType,headers:{'Content-Type':background.mimeType}});const result=await task.uploadAsync();if(!result||result.status<200||result.status>=300)throw new Error(`Envoi du fond impossible (HTTP ${result?.status??'?'})`);return{...current,background:{...background,cloudPath:ticket.pathname,byteSize:file.size}};}
  async function persist(){setSaving(true);setMessage('');try{const uploaded=await uploadBackground(plan);await saveCreativePlan(uploaded);setPlan(uploaded);const shared:CreativePlan={...uploaded,background:uploaded.background?{...uploaded.background,localUri:null}:null};if(onSaved)await onSaved(shared);setLocked(true);setMessage('✓ Design enregistré et activé. CAPTURE reçoit maintenant les changements automatiquement.');requestAnimationFrame(()=>scrollRef.current?.scrollTo({y:0,animated:true}));}catch(error){setMessage(error instanceof Error?error.message:'Impossible d’enregistrer le design.');}finally{setSaving(false);}}
  function deleteDesign(){Alert.alert('Supprimer le design ?','Le prochain contenu sera capturé sans ce design.',[{text:'Annuler',style:'cancel'},{text:'Supprimer',style:'destructive',onPress:()=>void(async()=>{await SecureStore.deleteItemAsync(STORAGE_KEY);setPlan(DEFAULT_CREATIVE_PLAN);setLocked(false);setMessage('Design supprimé.');})()}]);}
  const previewTitle=plan.title||presetText[0]||'Votre création';const previewSubtitle=plan.subtitle||presetText[1]||'Texte, cadre, couleur et audio';const positionStyle=plan.textPosition==='TOP'?styles.textTop:plan.textPosition==='CENTER'?styles.textCenter:styles.textBottom;const frameStyle=plan.frameStyle==='GOLD'?styles.frameGold:plan.frameStyle==='NEON'?styles.frameNeon:plan.frameStyle==='POLAROID'?styles.framePolaroid:plan.frameStyle==='CLASSIC'?styles.frameClassic:null;const effectStyle=plan.colorEffect==='WARM'?styles.effectWarm:plan.colorEffect==='COOL'?styles.effectCool:plan.colorEffect==='GOLD'?styles.effectGold:plan.colorEffect==='MONO'?styles.effectMono:plan.colorEffect==='PARTY'?styles.effectParty:null;
  return <View style={styles.page}><ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.header}><View style={{flex:1}}><Text style={styles.brand}>KHE DESIGN</Text><Text style={styles.title}>Studio créatif</Text><Text style={styles.help}>Tout ce qui est enregistré ici apparaît dans l’aperçu CAPTURE et accompagne le plan de rendu final.</Text></View><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable></View>
    <View style={[styles.previewShell,frameStyle]}><View style={[styles.preview,effectStyle]}>{plan.background?.localUri?<Image pointerEvents="none" source={{uri:plan.background.localUri}} resizeMode="cover" style={[styles.backgroundImage,{opacity:plan.background.opacity,transform:[{translateX:plan.background.cropX*2},{translateY:plan.background.cropY*2},{scale:plan.background.zoom}]}]}/>:null}<View style={styles.previewBrandRow}><Text style={styles.previewKhe}>KHE BOOTH</Text><View style={styles.kheMark}><View style={styles.redMark}/><View style={styles.goldMark}/></View></View><View style={[styles.previewTextBlock,positionStyle]}><Text style={styles.previewTitle}>{previewTitle}</Text><Text style={styles.previewSub}>{previewSubtitle}</Text></View><View style={styles.previewFooter}><Text style={styles.previewFooterText}>{templateLabels[plan.template]} • {plan.speed}</Text><Text style={styles.previewFooterText}>{plan.background?'Fond personnalisé • ':''}{plan.audioMode==='MIC_ONLY'?'Micro':`Musique • ${plan.music.length}`}</Text></View></View></View>
    {locked?<View style={styles.lockedPanel}><View style={styles.activeDesign}><Text style={styles.activeDesignText}>✓ DESIGN ACTIF ET ENREGISTRÉ</Text></View><Text style={styles.lockedHelp}>Le design est verrouillé pour éviter une modification accidentelle.</Text><View style={styles.lockedActions}><Pressable style={styles.modifyButton} onPress={()=>setLocked(false)}><Text style={styles.modifyText}>Modifier le design</Text></Pressable><Pressable style={styles.deleteButton} onPress={deleteDesign}><Text style={styles.deleteText}>Supprimer</Text></Pressable></View></View>:null}
    <Text style={styles.section}>MODÈLES</Text><View style={styles.wrap}>{(Object.keys(templateLabels) as DesignTemplate[]).map((template)=><Pressable disabled={locked} key={template} style={[styles.chip,plan.template===template&&styles.chipActive]} onPress={()=>chooseTemplate(template)}><Text style={plan.template===template?styles.chipTextActive:styles.chipText}>{templateLabels[template]}</Text></Pressable>)}</View>
    <Text style={styles.section}>IMAGE DE FOND • RECADRAGE ASSISTÉ</Text><Text style={styles.help}>Ajoutez votre photo ou visuel. KHE l’affiche en mode « cover » automatiquement, puis vous pouvez affiner le cadrage.</Text>{!locked?<Pressable style={styles.importButton} onPress={()=>void importBackground()}><Text style={styles.importText}>{plan.background?'Changer l’image de fond':'＋ Ajouter une image de fond'}</Text></Pressable>:null}{plan.background?<View style={styles.cropCard}><View style={styles.cropActions}><Pressable disabled={locked} style={styles.cropButton} onPress={()=>patchBackground({cropX:0,cropY:0,zoom:1})}><Text style={styles.cropText}>Centrer auto</Text></Pressable><Pressable disabled={locked} style={styles.cropButton} onPress={()=>patchBackground({zoom:Math.max(1,plan.background!.zoom-0.1)})}><Text style={styles.cropText}>Zoom −</Text></Pressable><Pressable disabled={locked} style={styles.cropButton} onPress={()=>patchBackground({zoom:Math.min(3,plan.background!.zoom+0.1)})}><Text style={styles.cropText}>Zoom +</Text></Pressable></View><View style={styles.cropActions}>{[['←',-5,0],['→',5,0],['↑',0,-5],['↓',0,5]].map(([label,dx,dy])=><Pressable disabled={locked} key={String(label)} style={styles.cropButton} onPress={()=>patchBackground({cropX:Math.max(-50,Math.min(50,plan.background!.cropX+Number(dx))),cropY:Math.max(-50,Math.min(50,plan.background!.cropY+Number(dy)))})}><Text style={styles.cropText}>{label}</Text></Pressable>)}</View><Text style={styles.help}>Opacité du fond</Text><View style={styles.wrap}>{[25,50,75,100].map((value)=><Pressable disabled={locked} key={value} style={[styles.chip,Math.round(plan.background!.opacity*100)===value&&styles.chipActive]} onPress={()=>patchBackground({opacity:value/100})}><Text style={Math.round(plan.background!.opacity*100)===value?styles.chipTextActive:styles.chipText}>{value}%</Text></Pressable>)}</View>{!locked?<Pressable style={styles.removeBackground} onPress={()=>patch({background:null})}><Text style={styles.removeBackgroundText}>Retirer l’image de fond</Text></Pressable>:null}</View>:null}
    <Text style={styles.section}>TEXTE DU RENDU</Text><TextInput editable={!locked} style={styles.input} value={plan.title} onChangeText={(title)=>patch({title})} placeholder="Titre du design" placeholderTextColor="#777"/><TextInput editable={!locked} style={styles.input} value={plan.subtitle} onChangeText={(subtitle)=>patch({subtitle})} placeholder="Sous-titre / noms / date" placeholderTextColor="#777"/><View style={styles.wrap}>{(['TOP','CENTER','BOTTOM'] as const).map((position)=><Pressable disabled={locked} key={position} style={[styles.chip,plan.textPosition===position&&styles.chipActive]} onPress={()=>patch({textPosition:position})}><Text style={plan.textPosition===position?styles.chipTextActive:styles.chipText}>{position==='TOP'?'Haut':position==='CENTER'?'Centre':'Bas'}</Text></Pressable>)}</View>
    <Text style={styles.section}>CADRE</Text><View style={styles.wrap}>{(['NONE','CLASSIC','GOLD','NEON','POLAROID'] as const).map((frame)=><Pressable disabled={locked} key={frame} style={[styles.chip,plan.frameStyle===frame&&styles.chipActive]} onPress={()=>patch({frameStyle:frame})}><Text style={plan.frameStyle===frame?styles.chipTextActive:styles.chipText}>{frame==='NONE'?'Aucun':frame}</Text></Pressable>)}</View>
    <Text style={styles.section}>EFFETS VIDÉO 360</Text><View style={styles.wrap}>{(['0.5x','0.75x','1x','1.25x','1.5x','2x'] as SpeedEffect[]).map((speed)=><Pressable disabled={locked} key={speed} style={[styles.chip,plan.speed===speed&&styles.chipActive]} onPress={()=>patch({speed})}><Text style={plan.speed===speed?styles.chipTextActive:styles.chipText}>{speed}</Text></Pressable>)}</View><View style={styles.wrap}><Pressable disabled={locked} style={[styles.chip,plan.boomerang&&styles.chipActive]} onPress={()=>patch({boomerang:!plan.boomerang})}><Text style={plan.boomerang?styles.chipTextActive:styles.chipText}>Boomerang</Text></Pressable><Pressable disabled={locked} style={[styles.chip,plan.reverse&&styles.chipActive]} onPress={()=>patch({reverse:!plan.reverse})}><Text style={plan.reverse?styles.chipTextActive:styles.chipText}>Reverse</Text></Pressable><Pressable disabled={locked} style={[styles.chip,plan.freezeFrame&&styles.chipActive]} onPress={()=>patch({freezeFrame:!plan.freezeFrame})}><Text style={plan.freezeFrame?styles.chipTextActive:styles.chipText}>Freeze frame</Text></Pressable></View><View style={styles.wrap}>{(['NONE','WARM','COOL','GOLD','MONO','PARTY'] as const).map((effect)=><Pressable disabled={locked} key={effect} style={[styles.chip,plan.colorEffect===effect&&styles.chipActive]} onPress={()=>patch({colorEffect:effect})}><Text style={plan.colorEffect===effect?styles.chipTextActive:styles.chipText}>{effect}</Text></Pressable>)}</View>
    <Text style={styles.section}>SON DE LA VIDÉO</Text><View style={styles.row}><Pressable disabled={locked} style={[styles.choice,plan.audioMode==='MIC_ONLY'&&styles.choiceActive]} onPress={()=>patch({audioMode:'MIC_ONLY'})}><Text style={plan.audioMode==='MIC_ONLY'?styles.choiceTextActive:styles.choiceText}>Micro</Text></Pressable><Pressable disabled={locked} style={[styles.choice,plan.audioMode==='MUSIC_ONLY'&&styles.choiceActive]} onPress={()=>patch({audioMode:'MUSIC_ONLY'})}><Text style={plan.audioMode==='MUSIC_ONLY'?styles.choiceTextActive:styles.choiceText}>Musique</Text></Pressable></View>
    <Text style={styles.section}>PLAYLIST • 3 MUSIQUES MAXIMUM</Text>{!locked?<Pressable style={styles.importButton} onPress={()=>void importMusic()}><Text style={styles.importText}>＋ Ajouter MP3 / MP4 / WAV</Text></Pressable>:null}{plan.music.map((asset)=><MusicEditor key={asset.id} asset={asset} disabled={locked} onChange={(value)=>patchMusic(asset.id,value)} onRemove={()=>patch({music:plan.music.filter((item)=>item.id!==asset.id)})}/>)}
    <View style={styles.renderNotice}><Text style={styles.renderTitle}>Aperçu + rendu</Text><Text style={styles.renderText}>L’image de fond, son recadrage, les textes, le cadre, les couleurs, la vitesse et l’audio sont conservés dans le plan de rendu. L’original caméra reste intact.</Text></View>{!locked?<Pressable disabled={saving} style={[styles.save,saving&&styles.disabled]} onPress={()=>void persist()}><Text style={styles.saveText}>{saving?'ENREGISTREMENT…':'ENREGISTRER ET ACTIVER LE DESIGN'}</Text></Pressable>:null}{message?<Text style={styles.message}>{message}</Text>:null}
  </ScrollView></View>;
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:KHE_BLACK},scroll:{padding:20,paddingBottom:60,gap:14},header:{flexDirection:'row',gap:12,alignItems:'flex-start'},brand:{color:KHE_GOLD,fontWeight:'900',letterSpacing:4,fontSize:12},title:{color:'#fff',fontWeight:'900',fontSize:32},help:{color:'#aaa6a2',fontSize:12,lineHeight:18},close:{borderWidth:1,borderColor:'#5c5550',borderRadius:14,paddingHorizontal:14,paddingVertical:11},closeText:{color:'#fff',fontWeight:'900'},previewShell:{borderRadius:30,padding:5,backgroundColor:'#232326'},frameClassic:{backgroundColor:'#fff'},frameGold:{backgroundColor:KHE_GOLD},frameNeon:{backgroundColor:'#33ddff',shadowColor:'#33ddff',shadowOpacity:.9,shadowRadius:14,elevation:8},framePolaroid:{backgroundColor:'#fff',padding:13,paddingBottom:30},preview:{minHeight:360,borderRadius:26,padding:22,backgroundColor:'#151517',justifyContent:'space-between',overflow:'hidden'},backgroundImage:{...StyleSheet.absoluteFillObject,width:'100%',height:'100%'},effectWarm:{backgroundColor:'#241713'},effectCool:{backgroundColor:'#101923'},effectGold:{backgroundColor:'#211b0e'},effectMono:{backgroundColor:'#202020'},effectParty:{backgroundColor:'#21122b'},previewBrandRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},previewKhe:{color:'#fff',letterSpacing:5,fontWeight:'900'},kheMark:{flexDirection:'row',gap:4},redMark:{width:24,height:5,borderRadius:3,backgroundColor:KHE_RED},goldMark:{width:24,height:5,borderRadius:3,backgroundColor:KHE_GOLD},previewTextBlock:{position:'absolute',left:22,right:22,alignItems:'center'},textTop:{top:80},textCenter:{top:'42%'},textBottom:{bottom:70},previewTitle:{color:'#fff',fontWeight:'900',fontSize:32,textAlign:'center',textShadowColor:'#000',textShadowRadius:8},previewSub:{color:'#eee',textAlign:'center',marginTop:7,fontSize:15,textShadowColor:'#000',textShadowRadius:6},previewFooter:{flexDirection:'row',justifyContent:'space-between',gap:10},previewFooterText:{color:'#ddd',fontSize:10,fontWeight:'700'},lockedPanel:{backgroundColor:'#121b16',borderWidth:1,borderColor:'#255f40',borderRadius:20,padding:14,gap:10},activeDesign:{backgroundColor:KHE_GREEN,borderRadius:14,padding:13,alignItems:'center'},activeDesignText:{color:'#fff',fontWeight:'900',letterSpacing:1},lockedHelp:{color:'#b7c7bd',lineHeight:18},lockedActions:{flexDirection:'row',gap:9},modifyButton:{flex:1,backgroundColor:KHE_GOLD,borderRadius:13,padding:13,alignItems:'center'},modifyText:{color:'#19140b',fontWeight:'900'},deleteButton:{flex:1,borderWidth:1,borderColor:'#7f3036',borderRadius:13,padding:13,alignItems:'center'},deleteText:{color:'#ff9aa1',fontWeight:'900'},section:{color:KHE_GOLD,fontSize:11,fontWeight:'900',letterSpacing:2,marginTop:8},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{borderWidth:1,borderColor:'#3e3b3b',borderRadius:14,paddingHorizontal:12,paddingVertical:10,backgroundColor:'#151517'},chipActive:{backgroundColor:KHE_RED,borderColor:KHE_RED},chipText:{color:'#ddd',fontWeight:'800',fontSize:11},chipTextActive:{color:'#fff',fontWeight:'900',fontSize:11},input:{backgroundColor:'#19191c',borderRadius:14,padding:14,color:'#fff',borderWidth:1,borderColor:'#343437'},row:{flexDirection:'row',gap:10},choice:{flex:1,borderWidth:1,borderColor:'#3e3b3b',borderRadius:15,padding:15,alignItems:'center'},choiceActive:{backgroundColor:KHE_RED,borderColor:KHE_RED},choiceText:{color:'#ddd',fontWeight:'900'},choiceTextActive:{color:'#fff',fontWeight:'900'},importButton:{borderWidth:1,borderColor:KHE_GOLD,backgroundColor:'#18150f',borderRadius:15,padding:15,alignItems:'center'},importText:{color:KHE_GOLD,fontWeight:'900'},cropCard:{backgroundColor:'#171719',borderRadius:18,padding:14,gap:10,borderWidth:1,borderColor:'#302d2b'},cropActions:{flexDirection:'row',flexWrap:'wrap',gap:8},cropButton:{flexGrow:1,minWidth:70,borderWidth:1,borderColor:'#555',borderRadius:11,padding:10,alignItems:'center'},cropText:{color:'#fff',fontWeight:'900'},removeBackground:{alignItems:'center',padding:10},removeBackgroundText:{color:'#ff9aa1',fontWeight:'800',textDecorationLine:'underline'},musicCard:{backgroundColor:'#171719',borderRadius:18,padding:14,gap:12,borderWidth:1,borderColor:'#302d2b'},musicHeader:{flexDirection:'row',alignItems:'center',gap:8},musicName:{color:'#fff',fontWeight:'900',fontSize:15},listenButton:{backgroundColor:'#fff',paddingHorizontal:12,paddingVertical:10,borderRadius:12},listenText:{color:'#111',fontWeight:'900'},removeButton:{width:38,height:38,borderRadius:19,borderWidth:1,borderColor:'#71343a',alignItems:'center',justifyContent:'center'},removeText:{color:'#ff8f98',fontSize:24},audioGrid:{flexDirection:'row',gap:10},audioField:{flex:1,gap:5},audioLabel:{color:'#bbb',fontSize:10,fontWeight:'800'},audioInput:{backgroundColor:'#0f0f11',borderWidth:1,borderColor:'#353538',borderRadius:11,padding:11,color:'#fff'},renderNotice:{backgroundColor:'#182126',borderRadius:18,padding:15,borderLeftWidth:4,borderLeftColor:KHE_GOLD},renderTitle:{color:'#fff',fontWeight:'900'},renderText:{color:'#b8c0c4',marginTop:5,lineHeight:19},save:{backgroundColor:KHE_RED,borderRadius:17,padding:17,alignItems:'center'},saveText:{color:'#fff',fontWeight:'900',letterSpacing:.6},disabled:{opacity:.5},message:{color:'#fff',backgroundColor:'#1b1b1d',borderRadius:12,padding:12,lineHeight:18}
});
