'use client';

export type RegionKey='SWITZERLAND'|'EUROZONE'|'AFRICA'|'ASIA'|'AMERICAS'|'OTHER';
export type RegionPolicy={enabled:boolean;showPrices:boolean;showDownload:boolean;showReviews:boolean;showPromoVideo:boolean;forceCurrency?:string;heroTitle?:string;heroSubtitle?:string;primaryCta?:string;announcement?:string};
export type RegionalSettings=Record<RegionKey,RegionPolicy>;

export const REGION_OPTIONS:Array<{key:RegionKey;label:string;hint:string;defaultCurrency?:string;icon:string}>=[
  {key:'SWITZERLAND',label:'Suisse',hint:'Suisse et Liechtenstein',defaultCurrency:'CHF',icon:'🇨🇭'},
  {key:'EUROZONE',label:'Zone euro',hint:'Pays utilisant l’euro',defaultCurrency:'EUR',icon:'🇪🇺'},
  {key:'AFRICA',label:'Afrique',hint:'Pays du continent africain',icon:'🌍'},
  {key:'ASIA',label:'Asie',hint:'Pays du continent asiatique',icon:'🌏'},
  {key:'AMERICAS',label:'Amériques',hint:'Amérique du Nord, centrale, Caraïbes et Amérique du Sud',icon:'🌎'},
  {key:'OTHER',label:'Autres régions',hint:'Royaume-Uni, Océanie et autres pays',icon:'✦'},
];

export const DEFAULT_REGIONAL_SETTINGS:RegionalSettings=Object.fromEntries(REGION_OPTIONS.map((region)=>[region.key,{enabled:true,showPrices:true,showDownload:true,showReviews:true,showPromoVideo:true,forceCurrency:region.defaultCurrency}])) as RegionalSettings;

export function normalizeRegionalSettings(value:Partial<RegionalSettings>|undefined):RegionalSettings{
  const result={...DEFAULT_REGIONAL_SETTINGS} as RegionalSettings;
  for(const region of REGION_OPTIONS){result[region.key]={...DEFAULT_REGIONAL_SETTINGS[region.key],...(value?.[region.key]||{})};}
  return result;
}

function Toggle({label,help,checked,onChange}:{label:string;help:string;checked:boolean;onChange:(checked:boolean)=>void}){
  return <label style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',alignItems:'center',gap:14,padding:'14px 15px',border:'1px solid #313846',borderRadius:14,background:'linear-gradient(145deg,#171c24,#11151c)',color:'#f7f8fa',minHeight:72}}>
    <span style={{display:'grid',gap:4,minWidth:0}}><strong style={{fontSize:14,lineHeight:1.25,color:'#fff'}}>{label}</strong><span style={{fontSize:11,lineHeight:1.4,color:'#9aa7b7'}}>{help}</span></span>
    <span aria-hidden="true" style={{width:46,height:26,padding:3,borderRadius:99,background:checked?'#d6af52':'#353d49',display:'flex',justifyContent:checked?'flex-end':'flex-start',transition:'all .2s ease',boxShadow:checked?'0 0 0 1px rgba(214,175,82,.3),0 0 18px rgba(214,175,82,.12)':'none'}}><span style={{width:20,height:20,borderRadius:99,background:checked?'#12100b':'#c8cdd4',display:'block'}}/></span>
    <input type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)} style={{position:'absolute',opacity:0,pointerEvents:'none'}}/>
  </label>;
}

export function RegionalSiteSettings({value,onChange,selected,onSelectedChange,compact=false}:{value:RegionalSettings;onChange:(next:RegionalSettings)=>void;selected:RegionKey;onSelectedChange:(next:RegionKey)=>void;compact?:boolean}){
  const policy=value[selected];const patch=(next:Partial<RegionPolicy>)=>onChange({...value,[selected]:{...policy,...next}});const current=REGION_OPTIONS.find((region)=>region.key===selected)!;
  return <div style={{display:'grid',gap:16,minWidth:0}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(138px,1fr))',gap:9}}>{REGION_OPTIONS.map((region)=>{
      const active=selected===region.key;
      return <button key={region.key} type="button" onClick={()=>onSelectedChange(region.key)} style={{display:'grid',gridTemplateColumns:'auto minmax(0,1fr)',alignItems:'center',gap:9,textAlign:'left',border:active?'1px solid #d6af52':'1px solid #2e3541',borderRadius:14,padding:'11px 12px',background:active?'linear-gradient(135deg,#3a3018,#1a1812)':'#151a21',color:'#fff',boxShadow:active?'0 10px 28px rgba(214,175,82,.12)':'none',minWidth:0}}><span style={{fontSize:20}}>{region.icon}</span><span style={{minWidth:0}}><strong style={{display:'block',fontSize:12,lineHeight:1.2,color:active?'#f4d783':'#f5f6f8'}}>{region.label}</strong><span style={{display:'block',fontSize:9,lineHeight:1.3,color:'#8f9aaa',marginTop:2,overflowWrap:'anywhere'}}>{region.hint}</span></span></button>})}</div>

    <section style={{padding:18,borderRadius:20,background:'linear-gradient(145deg,#11161d,#0d1117)',border:'1px solid #303845',display:'grid',gap:16,boxShadow:'inset 0 1px 0 rgba(255,255,255,.03)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,flexWrap:'wrap'}}><div><div style={{display:'flex',alignItems:'center',gap:9}}><span style={{fontSize:25}}>{current.icon}</span><strong style={{fontSize:20,color:'#fff'}}>{current.label}</strong></div><div style={{fontSize:12,lineHeight:1.45,color:'#9ea9b8',marginTop:5}}>{current.hint}</div></div><span style={{padding:'7px 10px',borderRadius:99,background:policy.enabled?'rgba(121,214,163,.12)':'rgba(241,109,122,.12)',border:`1px solid ${policy.enabled?'rgba(121,214,163,.35)':'rgba(241,109,122,.35)'}`,color:policy.enabled?'#94e6b7':'#ff9aa6',fontSize:10,fontWeight:900,letterSpacing:'.08em'}}>{policy.enabled?'SITE ACTIF':'SITE MASQUÉ'}</span></div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10}}>
        <Toggle label="Site accessible" help="Autoriser la vitrine publique dans cette zone." checked={policy.enabled} onChange={(enabled)=>patch({enabled})}/>
        <Toggle label="Afficher les prix" help="Montrer les abonnements et tarifs localisés." checked={policy.showPrices} onChange={(showPrices)=>patch({showPrices})}/>
        <Toggle label="Téléchargement" help="Afficher le bouton de téléchargement de l’application." checked={policy.showDownload} onChange={(showDownload)=>patch({showDownload})}/>
        <Toggle label="Avis clients" help="Afficher les témoignages d’abonnés vérifiés." checked={policy.showReviews} onChange={(showReviews)=>patch({showReviews})}/>
        <Toggle label="Vidéos promotionnelles" help="Autoriser les séquences promotionnelles dans cette région." checked={policy.showPromoVideo} onChange={(showPromoVideo)=>patch({showPromoVideo})}/>
        <label style={{display:'grid',gap:7,padding:'13px 15px',border:'1px solid #313846',borderRadius:14,background:'#151a21',color:'#fff'}}><strong style={{fontSize:13}}>Devise imposée</strong><span style={{fontSize:10,color:'#929dac'}}>Laissez automatique pour utiliser la devise du visiteur.</span><select value={policy.forceCurrency||''} onChange={(event)=>patch({forceCurrency:event.target.value||undefined})} style={{width:'100%',minHeight:42,borderRadius:10,border:'1px solid #394250',background:'#0c1016',color:'#fff',padding:'0 11px'}}><option value="">Détection automatique</option>{['CHF','EUR','GBP','USD','CAD','AUD'].map((currency)=><option key={currency}>{currency}</option>)}</select></label>
      </div>

      {!compact?<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:11,paddingTop:2}}><label style={fieldStyle}>Titre Hero régional<input style={inputStyle} value={policy.heroTitle||''} placeholder="Titre global si vide" onChange={(event)=>patch({heroTitle:event.target.value})}/></label><label style={fieldStyle}>CTA régional<input style={inputStyle} value={policy.primaryCta||''} placeholder="CTA global si vide" onChange={(event)=>patch({primaryCta:event.target.value})}/></label><label style={{...fieldStyle,gridColumn:'1 / -1'}}>Sous-titre régional<textarea style={{...inputStyle,minHeight:94,paddingTop:11}} value={policy.heroSubtitle||''} placeholder="Sous-titre global si vide" onChange={(event)=>patch({heroSubtitle:event.target.value})}/></label><label style={{...fieldStyle,gridColumn:'1 / -1'}}>Annonce régionale<input style={inputStyle} value={policy.announcement||''} placeholder="Ex. Offre spéciale Suisse" onChange={(event)=>patch({announcement:event.target.value})}/></label></div>:null}
    </section>
  </div>;
}

const fieldStyle={display:'grid',gap:7,color:'#f5f6f8',fontWeight:800,fontSize:12} as const;
const inputStyle={width:'100%',minHeight:44,borderRadius:11,border:'1px solid #3a4351',background:'#0c1016',color:'#fff',padding:'0 12px',fontWeight:600} as const;
