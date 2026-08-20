import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BillingDocumentContract, StationBillingContract, StationExperienceApi } from '../api/station-api';

const KHE_GOLD='#d2ad4f';

function amount(cents:number,currency:string):string{
  try{return new Intl.NumberFormat(undefined,{style:'currency',currency:currency.toUpperCase()}).format(cents/100);}catch{return`${(cents/100).toFixed(2)} ${currency.toUpperCase()}`;}
}
function dateLabel(value:string|Date|null|undefined):string{return value?new Date(value).toLocaleDateString():'—';}
function safeUrl(document:BillingDocumentContract):string|null{
  const candidate=document.pdfUrl||document.receiptUrl||document.hostedUrl;
  if(!candidate)return null;
  try{return new URL(candidate).protocol==='https:'?candidate:null;}catch{return null;}
}
function documentLabel(type:string):string{return type.toUpperCase().includes('RECEIPT')?'Reçu de paiement':'Facture';}

export function SharingBillingCenter({api,stationToken}:{api:StationExperienceApi;stationToken:string}){
  const [data,setData]=useState<StationBillingContract|null>(null);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');

  async function refresh(){
    setLoading(true);setMessage('');
    try{setData(await api.stationBilling(stationToken));}
    catch(error){setMessage(error instanceof Error?error.message:'Impossible de charger la facturation KHE.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{void refresh();},[api,stationToken]);

  async function openDocument(document:BillingDocumentContract){
    const url=safeUrl(document);
    if(!url){setMessage('Aucun document Stripe téléchargeable n’est encore disponible pour cette opération.');return;}
    try{if(!(await Linking.canOpenURL(url)))throw new Error('Lien non pris en charge sur cette tablette.');await Linking.openURL(url);}
    catch(error){setMessage(error instanceof Error?error.message:'Impossible d’ouvrir ce document.');}
  }

  const documents=data?.documents??[];
  return <View style={styles.card}>
    <Pressable style={styles.header} onPress={()=>setOpen(value=>!value)}>
      <View style={{flex:1}}><Text style={styles.eyebrow}>FACTURATION KHE</Text><Text style={styles.title}>Factures & reçus</Text><Text style={styles.help}>{data?.client?`${data.client.subscriptionPlan} • ${data.client.paymentStatus}`:'Compte client non lié'} • {documents.length} document{documents.length===1?'':'s'}</Text></View>
      <View style={styles.chevron}><Text style={styles.chevronText}>{open?'−':'+'}</Text></View>
    </Pressable>
    {open?<View style={styles.body}>
      {data?.client?<View style={styles.clientRow}><View><Text style={styles.clientName}>{data.client.name}</Text><Text style={styles.help}>{data.client.email||'Adresse e-mail non renseignée'}</Text></View><View style={styles.planBadge}><Text style={styles.planText}>{data.client.subscriptionPlan}</Text></View></View>:null}
      <View style={styles.actions}><Pressable style={styles.refresh} onPress={()=>void refresh()}><Text style={styles.refreshText}>{loading?'ACTUALISATION…':'ACTUALISER'}</Text></Pressable></View>
      {documents.length===0?<View style={styles.empty}><Text style={styles.emptyTitle}>Aucune facture disponible</Text><Text style={styles.help}>Les factures mensuelles et reçus apparaîtront ici automatiquement après traitement Stripe.</Text></View>:documents.map(document=>{
        const url=safeUrl(document);const vatLabel=document.taxCents>0?`TVA incluse : ${amount(document.taxCents,document.currency)}${document.taxCountry?` • ${document.taxCountry}`:''}`:'TVA : selon la transaction et le pays applicable';
        return <View key={document.id} style={styles.document}>
          <View style={styles.documentTop}><View style={{flex:1}}><Text style={styles.docKind}>{documentLabel(document.documentType)}</Text><Text style={styles.docNumber}>{document.documentNumber||'Document KHE / Stripe'}</Text></View><Text style={[styles.status,document.status==='PAID'&&styles.statusPaid]}>{document.status}</Text></View>
          <View style={styles.amountRow}><Text style={styles.total}>{amount(document.totalCents,document.currency)}</Text><Text style={styles.currency}>{document.currency.toUpperCase()}</Text></View>
          <Text style={styles.vat}>{vatLabel}</Text>
          <Text style={styles.meta}>Émis : {dateLabel(document.issuedAt||document.createdAt)}{document.paidAt?` • Payé : ${dateLabel(document.paidAt)}`:''}{document.periodStart?` • Période : ${dateLabel(document.periodStart)} → ${dateLabel(document.periodEnd)}`:''}</Text>
          {url?<Pressable style={styles.openButton} onPress={()=>void openDocument(document)}><Text style={styles.openText}>{document.pdfUrl?'OUVRIR / TÉLÉCHARGER LE PDF':document.receiptUrl?'OUVRIR LE REÇU':'OUVRIR DANS STRIPE'} →</Text></Pressable>:null}
        </View>;
      })}
      {message?<Text style={styles.message}>{message}</Text>:null}
      <Text style={styles.footer}>Les montants et taxes affichés proviennent des documents de facturation Stripe enregistrés par KHE Booth. La facture Stripe reste la référence comptable de la transaction.</Text>
    </View>:null}
  </View>;
}

const styles=StyleSheet.create({
  card:{backgroundColor:'#111113',borderRadius:20,borderWidth:1,borderColor:'#3e3524',overflow:'hidden'},header:{padding:16,flexDirection:'row',alignItems:'center',gap:12},eyebrow:{color:KHE_GOLD,fontSize:9,fontWeight:'900',letterSpacing:1.4},title:{color:'#fff',fontSize:19,fontWeight:'900'},help:{color:'#9d9da5',fontSize:10,lineHeight:15},chevron:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:'#5d512f',alignItems:'center',justifyContent:'center'},chevronText:{color:KHE_GOLD,fontWeight:'900',fontSize:18},body:{borderTopWidth:1,borderTopColor:'#29251d',padding:14,gap:10},clientRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},clientName:{color:'#fff',fontSize:14,fontWeight:'900'},planBadge:{backgroundColor:'#2a2417',borderWidth:1,borderColor:KHE_GOLD,borderRadius:999,paddingHorizontal:10,paddingVertical:6},planText:{color:KHE_GOLD,fontSize:9,fontWeight:'900'},actions:{alignItems:'flex-end'},refresh:{borderWidth:1,borderColor:'#4c4c52',borderRadius:9,paddingHorizontal:10,paddingVertical:7},refreshText:{color:'#d5d5da',fontSize:8,fontWeight:'900'},empty:{backgroundColor:'#18181c',borderRadius:12,padding:14,gap:4},emptyTitle:{color:'#fff',fontWeight:'900'},document:{backgroundColor:'#18181c',borderRadius:14,padding:13,gap:7,borderWidth:1,borderColor:'#2d2d33'},documentTop:{flexDirection:'row',alignItems:'flex-start',gap:8},docKind:{color:KHE_GOLD,fontSize:9,fontWeight:'900',letterSpacing:.8},docNumber:{color:'#fff',fontSize:12,fontWeight:'900'},status:{color:'#e2b5b5',fontSize:8,fontWeight:'900'},statusPaid:{color:'#77d69a'},amountRow:{flexDirection:'row',alignItems:'baseline',gap:6},total:{color:'#fff',fontSize:22,fontWeight:'900'},currency:{color:'#8f8f97',fontSize:9,fontWeight:'900'},vat:{color:'#d8c69b',fontSize:10,fontWeight:'800'},meta:{color:'#8b8b92',fontSize:9,lineHeight:14},openButton:{backgroundColor:KHE_GOLD,borderRadius:10,padding:10,alignItems:'center'},openText:{color:'#17130b',fontSize:8,fontWeight:'900'},message:{color:'#e5c87a',fontSize:9,lineHeight:14},footer:{color:'#777780',fontSize:8,lineHeight:13},
});
