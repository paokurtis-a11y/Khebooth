import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HttpStationApi, type StationProfileContract, type StationProfileUpdate } from '../api/station-api';
import { API_BASE_URL } from '../config';
import { SubscriptionPanel } from './subscription-panel';

interface UserProfileData extends StationProfileUpdate {
  avatarUri: string | null;
  avatarPath: string | null;
}

const PROFILE_KEY = 'khe.profile.v2';
const STATION_TOKEN_KEY = 'khe.station.token.v1';
const PROFILE_SYNC_INTERVAL_MS = 2_000;
const EMPTY_PROFILE: UserProfileData = {
  firstName:'', lastName:'', displayName:'', company:'', role:'', email:'', phone:'', address:'', birthDate:null,
  city:'', country:'', bio:'', avatarUri:null, avatarPath:null,
};

async function loadLocalProfile(): Promise<UserProfileData> {
  const raw=await SecureStore.getItemAsync(PROFILE_KEY);
  if(!raw)return EMPTY_PROFILE;
  try{return{...EMPTY_PROFILE,...(JSON.parse(raw) as Partial<UserProfileData>)}}catch{return EMPTY_PROFILE;}
}
async function saveLocalProfile(profile:UserProfileData):Promise<void>{
  await SecureStore.setItemAsync(PROFILE_KEY,JSON.stringify(profile),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
}

function normalizedBirthDate(value: string | Date | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value.slice(0,10) : null;
  return date.toISOString().slice(0,10);
}

function Field({label,value,onChange,placeholder,multiline=false,required=false,keyboardType='default'}:{
  label:string;value:string;onChange:(value:string)=>void;placeholder:string;multiline?:boolean;required?:boolean;keyboardType?:'default'|'email-address'|'phone-pad';
}){
  return <View style={styles.field}>
    <Text style={styles.label}>{label}{required?<Text style={styles.required}> *</Text>:<Text style={styles.optional}> · facultatif</Text>}</Text>
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9b948b" multiline={multiline} keyboardType={keyboardType} autoCapitalize={keyboardType==='email-address'?'none':'sentences'} autoCorrect={false} style={[styles.input,multiline&&styles.multiline]}/>
  </View>;
}

function extensionForAvatar(contentType?: string):string{
  if(contentType==='image/png')return'png';
  if(contentType==='image/webp')return'webp';
  return'jpg';
}

export function UserProfile({onClose}:{onClose:()=>void}){
  const api=useMemo(()=>new HttpStationApi(API_BASE_URL),[]);
  const [profile,setProfile]=useState<UserProfileData>(EMPTY_PROFILE);
  const profileRef=useRef<UserProfileData>(EMPTY_PROFILE);
  const dirtyRef=useRef(false);
  const syncingRef=useRef(false);
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const [syncing,setSyncing]=useState(true);
  const [avatarDirty,setAvatarDirty]=useState(false);
  const [lastSyncAt,setLastSyncAt]=useState<Date|null>(null);

  function commitLocal(next:UserProfileData):void{
    profileRef.current=next;
    setProfile(next);
    void saveLocalProfile(next);
  }

  async function synchronizeAvatar(token:string,remote:StationProfileContract,current:UserProfileData):Promise<UserProfileData>{
    if(!remote.avatarPath||remote.avatarPath===current.avatarPath&&current.avatarUri)return{...current,avatarPath:remote.avatarPath};
    try{
      const ticket=await api.profileAvatarDownload(token);
      if(!ticket.pathname||!ticket.downloadUrl)return{...current,avatarPath:remote.avatarPath};
      const directory=new Directory(Paths.document,'profile');
      await directory.create({idempotent:true,intermediates:true});
      const destination=new File(directory,`shared-avatar.${extensionForAvatar(ticket.contentType)}`);
      if(destination.exists)destination.delete();
      const downloaded=await File.downloadFileAsync(ticket.downloadUrl,destination,{idempotent:true});
      if(!downloaded.exists||downloaded.size<=0)throw new Error('Photo de profil incomplète');
      return{...current,avatarUri:downloaded.uri,avatarPath:ticket.pathname};
    }catch{return{...current,avatarPath:remote.avatarPath};}
  }

  async function pullRemote(token:string,announce=false):Promise<void>{
    if(syncingRef.current||dirtyRef.current||saving)return;
    syncingRef.current=true;
    try{
      const remote=await api.profile(token);
      let merged:UserProfileData={
        firstName:remote.firstName,lastName:remote.lastName,displayName:remote.displayName,company:remote.company,role:remote.role,email:remote.email,phone:remote.phone,
        address:remote.address,birthDate:normalizedBirthDate(remote.birthDate),city:remote.city,country:remote.country,bio:remote.bio,
        avatarUri:profileRef.current.avatarUri,avatarPath:remote.avatarPath,
      };
      merged=await synchronizeAvatar(token,remote,merged);
      commitLocal(merged);
      setLastSyncAt(new Date());
      if(announce)setMessage('✓ Profil unique synchronisé avec CAPTURE et SHARING.');
    }catch(error){if(announce)setMessage(`Profil local disponible hors ligne. ${error instanceof Error?error.message:''}`.trim());}
    finally{syncingRef.current=false;setSyncing(false);}
  }

  useEffect(()=>{
    let cancelled=false;let timer:ReturnType<typeof setInterval>|null=null;
    void(async()=>{
      const local=await loadLocalProfile();
      if(cancelled)return;
      profileRef.current=local;setProfile(local);
      const token=await SecureStore.getItemAsync(STATION_TOKEN_KEY);
      if(!token){setSyncing(false);setMessage('Profil local chargé. Activez une station pour le synchroniser entre CAPTURE et SHARING.');return;}
      await pullRemote(token,true);
      timer=setInterval(()=>void pullRemote(token,false),PROFILE_SYNC_INTERVAL_MS);
    })();
    return()=>{cancelled=true;if(timer)clearInterval(timer);};
  },[api]);

  const completion=useMemo(()=>{
    const required=[profile.firstName,profile.lastName,profile.email];
    const optional=[profile.company,profile.phone,profile.address,profile.birthDate?String(profile.birthDate):'',profile.bio];
    const requiredScore=required.filter((value)=>String(value??'').trim()).length/required.length*75;
    const optionalScore=optional.filter((value)=>String(value??'').trim()).length/optional.length*25;
    return Math.round(requiredScore+optionalScore);
  },[profile]);

  function patch(patchValue:Partial<UserProfileData>):void{
    dirtyRef.current=true;
    const next={...profileRef.current,...patchValue};
    profileRef.current=next;setProfile(next);setMessage('');
  }

  async function chooseAvatar():Promise<void>{
    const result=await DocumentPicker.getDocumentAsync({type:['image/jpeg','image/png','image/webp','image/*'],copyToCacheDirectory:true,multiple:false});
    if(result.canceled||!result.assets[0])return;
    const asset=result.assets[0];
    try{
      const directory=new Directory(Paths.document,'profile');await directory.create({idempotent:true,intermediates:true});
      const extension=asset.name?.split('.').pop()?.toLowerCase()||'jpg';const source=new File(asset.uri);const destination=new File(directory,`avatar-pending.${extension}`);
      if(destination.exists)destination.delete();await source.copy(destination);
      setAvatarDirty(true);patch({avatarUri:destination.uri});
    }catch(error){setMessage(error instanceof Error?error.message:'Impossible d’enregistrer la photo de profil.');}
  }

  function validate(next:UserProfileData):string|null{
    if(!next.firstName.trim())return'Le prénom est obligatoire.';
    if(!next.lastName.trim())return'Le nom est obligatoire.';
    if(!next.email.trim())return'L’adresse e-mail est obligatoire.';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email.trim()))return'L’adresse e-mail n’est pas valide.';
    if(next.birthDate){const date=new Date(String(next.birthDate));if(Number.isNaN(date.getTime()))return'La date de naissance doit être au format AAAA-MM-JJ.';if(date>new Date())return'La date de naissance ne peut pas être dans le futur.';}
    return null;
  }

  async function uploadAvatar(token:string,next:UserProfileData):Promise<UserProfileData>{
    if(!avatarDirty||!next.avatarUri)return next;
    const file=new File(next.avatarUri);
    if(!file.exists||file.size<=0)throw new Error('La photo de profil locale est introuvable.');
    const lower=next.avatarUri.toLowerCase();
    const contentType=lower.endsWith('.png')?'image/png':lower.endsWith('.webp')?'image/webp':'image/jpeg';
    const ticket=await api.prepareProfileAvatarUpload(token,contentType,file.size);
    const task=file.createUploadTask(ticket.uploadUrl,{httpMethod:'PUT',mimeType:contentType,headers:{'Content-Type':contentType}});
    const result=await task.uploadAsync();
    if(!result||result.status<200||result.status>=300)throw new Error(`Envoi de la photo impossible (HTTP ${result?.status??'?'})`);
    await api.confirmProfileAvatar(token,ticket.pathname);
    setAvatarDirty(false);
    return{...next,avatarPath:ticket.pathname};
  }

  async function persist():Promise<void>{
    const base=profileRef.current;
    const normalized:UserProfileData={
      ...base,
      firstName:base.firstName.trim(),lastName:base.lastName.trim(),email:base.email.trim().toLowerCase(),company:base.company.trim(),phone:base.phone.trim(),address:base.address.trim(),role:base.role.trim(),city:base.city.trim(),country:base.country.trim(),bio:base.bio.trim(),
      displayName:base.displayName.trim()||`${base.firstName.trim()} ${base.lastName.trim()}`.trim(),birthDate:base.birthDate?String(base.birthDate).slice(0,10):null,
    };
    const validation=validate(normalized);if(validation){setMessage(validation);return;}
    setSaving(true);setMessage('');
    try{
      const token=await SecureStore.getItemAsync(STATION_TOKEN_KEY);
      if(!token){commitLocal(normalized);dirtyRef.current=false;setMessage('Profil enregistré localement. Il sera synchronisé dès qu’une station KHE sera active.');return;}
      const{avatarUri:_avatarUri,avatarPath:_avatarPath,...shared}=normalized;
      const remote=await api.updateProfile(token,shared);
      let saved:UserProfileData={...normalized,avatarPath:remote.avatarPath};
      saved=await uploadAvatar(token,saved);
      commitLocal(saved);dirtyRef.current=false;setLastSyncAt(new Date());
      setMessage('✓ Profil unique enregistré. CAPTURE et SHARING recevront automatiquement les mêmes informations et la même photo.');
    }catch(error){
      commitLocal(normalized);
      setMessage(error instanceof Error?`Profil conservé localement. Synchronisation distante : ${error.message}`:'Impossible de synchroniser le profil.');
    }finally{setSaving(false);}
  }

  return <View style={styles.page}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View style={{flex:1}}><Text style={styles.brand}>KHE IDENTITY</Text><Text style={styles.title}>Votre profil</Text><Text style={styles.help}>Une seule identité utilisateur, partagée automatiquement entre la station CAPTURE et la station SHARING.</Text></View><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>Fermer</Text></Pressable></View>
    <View style={styles.syncBanner}><View style={[styles.syncDot,syncing?styles.syncDotBusy:styles.syncDotReady]}/><View style={{flex:1}}><Text style={styles.syncText}>{syncing?'Synchronisation du profil…':'Profil unique synchronisé'}</Text><Text style={styles.syncSub}>{lastSyncAt?`Dernière vérification ${lastSyncAt.toLocaleTimeString()} · mise à jour automatique toutes les 2 s`:'CAPTURE et SHARING utilisent le même profil.'}</Text></View></View>
    <View style={styles.identityCard}><Pressable style={styles.avatarButton} onPress={()=>void chooseAvatar()}>{profile.avatarUri?<Image source={{uri:profile.avatarUri}} style={styles.avatar}/>:<View style={styles.avatarPlaceholder}><Text style={styles.avatarPlaceholderText}>＋</Text></View>}<View style={styles.avatarEdit}><Text style={styles.avatarEditText}>PHOTO</Text></View></Pressable><View style={{flex:1}}><Text style={styles.profileName}>{profile.displayName||`${profile.firstName} ${profile.lastName}`.trim()||'Votre profil KHE'}</Text><Text style={styles.profileMeta}>{profile.company||'Profil personnel'}{profile.email?` • ${profile.email}`:''}</Text><Text style={styles.completion}>Profil complété à {completion}%</Text><View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${completion}%`}]}/></View></View></View>

    <SubscriptionPanel />

    <View style={styles.sectionCard}><Text style={styles.sectionEyebrow}>INFORMATIONS OBLIGATOIRES</Text><Text style={styles.sectionTitle}>Identité et contact</Text><Text style={styles.sectionHelp}>Ces trois champs permettent d’identifier correctement le compte KHE sur les deux stations.</Text>
      <View style={styles.twoCols}><View style={styles.col}><Field required label="Prénom" value={profile.firstName} onChange={(value)=>patch({firstName:value})} placeholder="Votre prénom"/></View><View style={styles.col}><Field required label="Nom" value={profile.lastName} onChange={(value)=>patch({lastName:value})} placeholder="Votre nom"/></View></View>
      <Field required label="Adresse e-mail" value={profile.email} onChange={(value)=>patch({email:value})} placeholder="contact@exemple.ch" keyboardType="email-address"/>
    </View>

    <View style={styles.sectionCard}><Text style={styles.sectionEyebrow}>INFORMATIONS FACULTATIVES</Text><Text style={styles.sectionTitle}>Informations complémentaires</Text>
      <Field label="Nom de l’entreprise" value={profile.company} onChange={(value)=>patch({company:value})} placeholder="Votre entreprise"/>
      <Field label="Adresse de domiciliation" value={profile.address} onChange={(value)=>patch({address:value})} placeholder="Rue, numéro, NPA, ville"/>
      <View style={styles.twoCols}><View style={styles.col}><Field label="Numéro de téléphone" value={profile.phone} onChange={(value)=>patch({phone:value})} placeholder="+41 …" keyboardType="phone-pad"/></View><View style={styles.col}><Field label="Date de naissance" value={profile.birthDate?String(profile.birthDate):''} onChange={(value)=>patch({birthDate:value||null})} placeholder="AAAA-MM-JJ"/></View></View>
      <View style={styles.twoCols}><View style={styles.col}><Field label="Ville" value={profile.city} onChange={(value)=>patch({city:value})} placeholder="Ville"/></View><View style={styles.col}><Field label="Pays" value={profile.country} onChange={(value)=>patch({country:value})} placeholder="Pays"/></View></View>
      <Field label="Fonction / rôle" value={profile.role} onChange={(value)=>patch({role:value})} placeholder="DJ, organisateur, photobooth…"/>
      <Field label="À propos" value={profile.bio} onChange={(value)=>patch({bio:value})} placeholder="Présentez votre activité ou votre univers…" multiline/>
    </View>

    <View style={styles.tipCard}><Text style={styles.tipTitle}>Même profil sur les deux tablettes</Text><Text style={styles.tipText}>Après Enregistrer, KHE conserve un seul profil central. Une tablette qui a l’écran Profil ouvert récupère automatiquement les changements enregistrés depuis l’autre station.</Text></View>
    <Pressable disabled={saving} style={[styles.saveButton,saving&&styles.disabled]} onPress={()=>void persist()}><Text style={styles.saveText}>{saving?'SYNCHRONISATION…':'ENREGISTRER LE PROFIL'}</Text></Pressable>
    {message?<Text style={styles.message}>{message}</Text>:null}
  </ScrollView></View>;
}

const KHE_RED='#b31520';const KHE_GOLD='#d2ad4f';
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#f6f1e9'},content:{padding:22,paddingTop:30,paddingBottom:56,gap:18,maxWidth:900,width:'100%',alignSelf:'center'},
  header:{flexDirection:'row',gap:14,alignItems:'flex-start'},brand:{color:KHE_RED,fontSize:11,letterSpacing:3,fontWeight:'900'},title:{fontSize:34,fontWeight:'900',marginTop:3,color:'#111'},help:{marginTop:5,color:'#70685e',lineHeight:19,maxWidth:620},close:{backgroundColor:'#111',borderRadius:13,paddingHorizontal:14,paddingVertical:11},closeText:{color:'#fff',fontWeight:'900'},
  syncBanner:{backgroundColor:'#fff8e8',borderWidth:1,borderColor:'#ead397',borderRadius:16,padding:13,flexDirection:'row',alignItems:'center',gap:10},syncDot:{width:10,height:10,borderRadius:5},syncDotBusy:{backgroundColor:KHE_GOLD},syncDotReady:{backgroundColor:'#16804a'},syncText:{fontWeight:'900',color:'#443b2d'},syncSub:{fontSize:10,color:'#756b5d',marginTop:2},
  identityCard:{backgroundColor:'#111113',borderRadius:26,padding:18,flexDirection:'row',gap:17,alignItems:'center',borderBottomWidth:4,borderBottomColor:KHE_GOLD},avatarButton:{width:92,height:92},avatar:{width:92,height:92,borderRadius:46},avatarPlaceholder:{width:92,height:92,borderRadius:46,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:KHE_RED},avatarPlaceholderText:{fontSize:36,fontWeight:'300',color:KHE_RED},avatarEdit:{position:'absolute',bottom:-2,alignSelf:'center',backgroundColor:KHE_RED,borderRadius:10,paddingHorizontal:8,paddingVertical:4},avatarEditText:{color:'#fff',fontSize:8,fontWeight:'900',letterSpacing:1},profileName:{color:'#fff',fontSize:21,fontWeight:'900'},profileMeta:{color:'#c9b88a',marginTop:3,fontSize:11},completion:{color:'#fff',fontSize:10,marginTop:12,fontWeight:'800'},progressTrack:{height:5,borderRadius:3,backgroundColor:'#444',marginTop:5,overflow:'hidden'},progressFill:{height:5,backgroundColor:KHE_GOLD},
  sectionCard:{backgroundColor:'#fff',borderRadius:22,padding:18,gap:13,borderWidth:1,borderColor:'#e7ddd0'},sectionEyebrow:{color:KHE_RED,fontSize:10,fontWeight:'900',letterSpacing:1.5},sectionTitle:{fontSize:20,fontWeight:'900',color:'#17130f'},sectionHelp:{color:'#80776c',fontSize:11,lineHeight:17},twoCols:{flexDirection:'row',flexWrap:'wrap',gap:12},col:{flex:1,minWidth:230},
  field:{gap:6},label:{fontSize:11,fontWeight:'900',letterSpacing:0.4,color:'#4c433b'},required:{color:KHE_RED},optional:{fontWeight:'600',color:'#9a9187'},input:{backgroundColor:'#faf8f4',borderRadius:14,borderWidth:1,borderColor:'#dfd5c9',paddingHorizontal:14,paddingVertical:13,fontSize:15,color:'#111'},multiline:{minHeight:105,textAlignVertical:'top'},
  tipCard:{backgroundColor:'#efe5d4',borderRadius:18,padding:16,borderLeftWidth:4,borderLeftColor:KHE_GOLD},tipTitle:{fontWeight:'900',fontSize:15},tipText:{marginTop:5,color:'#6f6458',lineHeight:18},saveButton:{backgroundColor:KHE_RED,borderRadius:17,padding:17,alignItems:'center'},saveText:{color:'#fff',fontWeight:'900',letterSpacing:0.6},disabled:{opacity:0.5},message:{backgroundColor:'#fff',borderRadius:13,padding:13,lineHeight:18,borderLeftWidth:4,borderLeftColor:KHE_GOLD}
});
