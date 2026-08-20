import type { MediaAssetContract } from '@khe/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationExperienceApi } from '../api/station-api';
import { listSharingTrash, restoreSharingMedia, trashSharingMediaMany, type SharingTrashItem } from './sharing-trash-client';

type DisplayMedia=MediaAssetContract&{displayName?:string|null;trashedAt?:string|null};

function daysRemaining(expiresAt:string):number{
  return Math.max(0,Math.ceil((new Date(expiresAt).getTime()-Date.now())/(24*60*60*1000)));
}

function mediaLabel(item:DisplayMedia,index:number):string{
  if(item.displayName?.trim())return item.displayName.trim();
  const type=item.mimeType.startsWith('video/')?'Vidéo':'Photo';
  return `KHE ${type} ${String(index+1).padStart(3,'0')}`;
}

export function SharingTrashPanel({api,stationToken}:{api:StationExperienceApi;stationToken:string}){
  const[open,setOpen]=useState(false);
  const[active,setActive]=useState<DisplayMedia[]>([]);
  const[trash,setTrash]=useState<SharingTrashItem[]>([]);
  const[selected,setSelected]=useState<string[]>([]);
  const[loading,setLoading]=useState(false);
  const[busy,setBusy]=useState(false);
  const[locked,setLocked]=useState(false);
  const[message,setMessage]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);setMessage('');
    try{
      const[mediaItems,trashItems]=await Promise.all([api.listMedia(stationToken),listSharingTrash(stationToken)]);
      setActive((mediaItems as DisplayMedia[]).filter(item=>item.syncState==='SYNCED'&&!item.trashedAt));
      setTrash(trashItems);
      setLocked(false);
    }catch(error){
      const text=error instanceof Error?error.message:'Corbeille indisponible.';
      setLocked(/BUSINESS|entitlement|subscription|forbidden/i.test(text));
      setMessage(text);
    }finally{setLoading(false);}
  },[api,stationToken]);

  useEffect(()=>{if(open)void load();},[open,load]);

  const allSelected=useMemo(()=>active.length>0&&selected.length===active.length,[active.length,selected.length]);

  function toggle(id:string){setSelected(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);}

  async function moveSelected(){
    if(!selected.length)return;
    Alert.alert(
      'Déplacer dans la corbeille ?',
      `${selected.length} média${selected.length>1?'s':''} sera${selected.length>1?'ont':''} conservé${selected.length>1?'s':''} pendant 30 jours avant suppression définitive automatique.`,
      [
        {text:'Annuler',style:'cancel'},
        {text:'Mettre à la corbeille',style:'destructive',onPress:()=>void (async()=>{
          setBusy(true);setMessage('');
          try{const result=await trashSharingMediaMany(stationToken,selected);setSelected([]);setMessage(`✓ ${result.count} média${result.count>1?'s':''} déplacé${result.count>1?'s':''} dans la corbeille pour ${result.retentionDays} jours.`);await load();}
          catch(error){setMessage(error instanceof Error?error.message:'Suppression impossible.');}
          finally{setBusy(false);}
        })()},
      ],
    );
  }

  async function restore(item:SharingTrashItem){
    setBusy(true);setMessage('');
    try{await restoreSharingMedia(stationToken,item.id);setMessage(`✓ ${item.displayName||'Moment'} restauré dans la galerie.`);await load();}
    catch(error){setMessage(error instanceof Error?error.message:'Restauration impossible.');}
    finally{setBusy(false);}
  }

  return <View style={styles.shell}>
    <Pressable style={styles.header} onPress={()=>setOpen(value=>!value)}>
      <View style={{flex:1}}><Text style={styles.eyebrow}>SHARING • BUSINESS</Text><Text style={styles.title}>Corbeille & sélection multiple</Text><Text style={styles.help}>Supprimez plusieurs Moments en une fois. KHE les conserve 30 jours avant purge définitive.</Text></View>
      <Text style={styles.chevron}>{open?'⌃':'⌄'}</Text>
    </Pressable>

    {open?<View style={styles.body}>
      {loading?<Text style={styles.help}>Chargement de la corbeille…</Text>:null}
      {locked?<View style={styles.locked}><Text style={styles.lockedTitle}>Disponible avec BUSINESS</Text><Text style={styles.help}>La corbeille Cloud, la sélection multiple et la restauration sont réservées à l’abonnement Business ou supérieur.</Text></View>:null}
      {!locked&&!loading?<>
        <View style={styles.toolbar}>
          <Pressable disabled={!active.length||busy} style={styles.secondary} onPress={()=>setSelected(allSelected?[]:active.map(item=>item.id))}><Text style={styles.secondaryText}>{allSelected?'Tout désélectionner':'Tout sélectionner'}</Text></Pressable>
          <Pressable disabled={!selected.length||busy} style={[styles.danger,!selected.length&&styles.disabled]} onPress={()=>void moveSelected()}><Text style={styles.dangerText}>{busy?'Traitement…':`Corbeille (${selected.length})`}</Text></Pressable>
          <Pressable disabled={busy} style={styles.secondary} onPress={()=>void load()}><Text style={styles.secondaryText}>↻ Actualiser</Text></Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Moments actifs</Text>
          <Text style={styles.help}>Touchez une ligne pour la sélectionner. Aucun média n’est détruit immédiatement.</Text>
          {active.length?active.map((item,index)=>{
            const checked=selected.includes(item.id);
            return <Pressable key={item.id} style={[styles.row,checked&&styles.rowSelected]} onPress={()=>toggle(item.id)}>
              <View style={[styles.check,checked&&styles.checkActive]}><Text style={styles.checkText}>{checked?'✓':''}</Text></View>
              <View style={{flex:1}}><Text style={styles.rowTitle}>{mediaLabel(item,index)}</Text><Text style={styles.meta}>{item.mimeType.startsWith('video/')?'VIDÉO':'PHOTO'} • {Math.max(1,Math.round(item.byteSize/1024/1024))} Mo</Text></View>
              <Text style={styles.status}>SYNCED</Text>
            </Pressable>;
          }):<Text style={styles.empty}>Aucun Moment actif à sélectionner.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Corbeille</Text>
          <Text style={styles.help}>{trash.length} média{trash.length===1?'':'s'} conservé{trash.length===1?'':'s'} temporairement.</Text>
          {trash.length?trash.map((item,index)=>{
            const remaining=daysRemaining(item.trashExpiresAt);
            return <View key={item.id} style={styles.trashRow}>
              <View style={{flex:1}}><Text style={styles.rowTitle}>{item.displayName||`KHE ${item.mimeType.startsWith('video/')?'Vidéo':'Photo'} ${String(index+1).padStart(3,'0')}`}</Text><Text style={styles.meta}>Suppression définitive dans {remaining} jour{remaining===1?'':'s'} • {new Date(item.trashExpiresAt).toLocaleDateString()}</Text></View>
              <Pressable disabled={busy} style={styles.restore} onPress={()=>void restore(item)}><Text style={styles.restoreText}>Restaurer</Text></Pressable>
            </View>;
          }):<Text style={styles.empty}>La corbeille est vide.</Text>}
        </View>
      </>:null}
      {message?<Text style={styles.message}>{message}</Text>:null}
    </View>:null}
  </View>;
}

const styles=StyleSheet.create({
  shell:{backgroundColor:'#111114',borderRadius:18,borderWidth:1,borderColor:'#403720',overflow:'hidden'},
  header:{padding:16,flexDirection:'row',gap:12,alignItems:'center'},eyebrow:{color:'#d2ad4f',fontSize:9,fontWeight:'900',letterSpacing:1.6},title:{color:'#fff',fontSize:18,fontWeight:'900',marginTop:3},help:{color:'#aaa',fontSize:10,lineHeight:15,marginTop:3},chevron:{color:'#d2ad4f',fontSize:24,fontWeight:'900'},
  body:{padding:14,paddingTop:0,gap:14},toolbar:{flexDirection:'row',gap:7,flexWrap:'wrap'},secondary:{borderWidth:1,borderColor:'#5b5b62',borderRadius:10,paddingHorizontal:10,paddingVertical:8},secondaryText:{color:'#fff',fontSize:9,fontWeight:'900'},danger:{backgroundColor:'#a52e38',borderRadius:10,paddingHorizontal:11,paddingVertical:8},dangerText:{color:'#fff',fontSize:9,fontWeight:'900'},disabled:{opacity:.4},
  section:{gap:7,borderTopWidth:1,borderTopColor:'#2b2b30',paddingTop:12},sectionTitle:{color:'#fff',fontSize:14,fontWeight:'900'},row:{flexDirection:'row',alignItems:'center',gap:9,backgroundColor:'#19191e',borderWidth:1,borderColor:'#303038',borderRadius:12,padding:10},rowSelected:{borderColor:'#d2ad4f',backgroundColor:'#211e17'},check:{width:24,height:24,borderRadius:7,borderWidth:1,borderColor:'#67676e',alignItems:'center',justifyContent:'center'},checkActive:{backgroundColor:'#d2ad4f',borderColor:'#d2ad4f'},checkText:{color:'#111',fontWeight:'900'},rowTitle:{color:'#fff',fontSize:11,fontWeight:'900'},meta:{color:'#94949c',fontSize:9,marginTop:2},status:{color:'#6ed18b',fontSize:8,fontWeight:'900'},
  trashRow:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#18181d',borderRadius:12,padding:10},restore:{borderWidth:1,borderColor:'#64bf82',borderRadius:9,paddingHorizontal:9,paddingVertical:7},restoreText:{color:'#79d59d',fontSize:9,fontWeight:'900'},empty:{color:'#8c8c94',fontSize:10,paddingVertical:5},locked:{backgroundColor:'#1c1c21',borderRadius:12,padding:12,gap:4},lockedTitle:{color:'#d2ad4f',fontWeight:'900'},message:{color:'#ddca98',fontSize:10,lineHeight:15,fontWeight:'700'},
});
