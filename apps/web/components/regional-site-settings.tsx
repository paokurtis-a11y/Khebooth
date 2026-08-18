'use client';

export type RegionKey='SWITZERLAND'|'EUROZONE'|'AFRICA'|'ASIA'|'AMERICAS'|'OTHER';
export type RegionPolicy={enabled:boolean;showPrices:boolean;showDownload:boolean;showReviews:boolean;showPromoVideo:boolean;forceCurrency?:string;heroTitle?:string;heroSubtitle?:string;primaryCta?:string;announcement?:string};
export type RegionalSettings=Record<RegionKey,RegionPolicy>;

export const REGION_OPTIONS:Array<{key:RegionKey;label:string;hint:string;defaultCurrency?:string}>=[
  {key:'SWITZERLAND',label:'Suisse',hint:'Suisse et Liechtenstein',defaultCurrency:'CHF'},
  {key:'EUROZONE',label:'Zone euro',hint:'Pays utilisant l’euro',defaultCurrency:'EUR'},
  {key:'AFRICA',label:'Afrique',hint:'Pays du continent africain'},
  {key:'ASIA',label:'Asie',hint:'Pays du continent asiatique'},
  {key:'AMERICAS',label:'Amériques',hint:'Amérique du Nord, centrale, Caraïbes et Amérique du Sud'},
  {key:'OTHER',label:'Autres régions',hint:'Royaume-Uni, Océanie et pays non classés ci-dessus'},
];

export const DEFAULT_REGIONAL_SETTINGS:RegionalSettings=Object.fromEntries(REGION_OPTIONS.map((region)=>[region.key,{enabled:true,showPrices:true,showDownload:true,showReviews:true,showPromoVideo:true,forceCurrency:region.defaultCurrency}])) as RegionalSettings;

export function normalizeRegionalSettings(value:Partial<RegionalSettings>|undefined):RegionalSettings{
  const result={...DEFAULT_REGIONAL_SETTINGS} as RegionalSettings;
  for(const region of REGION_OPTIONS){result[region.key]={...DEFAULT_REGIONAL_SETTINGS[region.key],...(value?.[region.key]||{})};}
  return result;
}

function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(checked:boolean)=>void}){
  return <label style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'10px 12px',border:'1px solid #e8dfd1',borderRadius:12,background:'#fff'}}><span style={{fontWeight:800,fontSize:13}}>{label}</span><input type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)}/></label>;
}

export function RegionalSiteSettings({value,onChange,selected,onSelectedChange,compact=false}:{value:RegionalSettings;onChange:(next:RegionalSettings)=>void;selected:RegionKey;onSelectedChange:(next:RegionKey)=>void;compact?:boolean}){
  const policy=value[selected];const patch=(next:Partial<RegionPolicy>)=>onChange({...value,[selected]:{...policy,...next}});
  return <div style={{display:'grid',gap:14}}>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{REGION_OPTIONS.map((region)=><button key={region.key} type="button" className={selected===region.key?'button':'button secondary'} onClick={()=>onSelectedChange(region.key)}>{region.label}</button>)}</div>
    <div style={{padding:16,borderRadius:18,background:'#f8f3eb',border:'1px solid #e5d6c2',display:'grid',gap:12}}>
      <div><strong>{REGION_OPTIONS.find((region)=>region.key===selected)?.label}</strong><div className="muted" style={{fontSize:12,marginTop:3}}>{REGION_OPTIONS.find((region)=>region.key===selected)?.hint}</div></div>
      <div className="grid two">
        <Toggle label="Site accessible" checked={policy.enabled} onChange={(enabled)=>patch({enabled})}/>
        <Toggle label="Afficher les prix" checked={policy.showPrices} onChange={(showPrices)=>patch({showPrices})}/>
        <Toggle label="Afficher le téléchargement" checked={policy.showDownload} onChange={(showDownload)=>patch({showDownload})}/>
        <Toggle label="Afficher les avis" checked={policy.showReviews} onChange={(showReviews)=>patch({showReviews})}/>
        <Toggle label="Afficher la vidéo promo" checked={policy.showPromoVideo} onChange={(showPromoVideo)=>patch({showPromoVideo})}/>
        <label>Devise imposée<select value={policy.forceCurrency||''} onChange={(event)=>patch({forceCurrency:event.target.value||undefined})}><option value="">Détection automatique</option>{['CHF','EUR','GBP','USD','CAD','AUD'].map((currency)=><option key={currency}>{currency}</option>)}</select></label>
      </div>
      {!compact?<div className="grid two"><label>Titre Hero régional<input value={policy.heroTitle||''} placeholder="Laisser vide = titre global" onChange={(event)=>patch({heroTitle:event.target.value})}/></label><label>CTA régional<input value={policy.primaryCta||''} placeholder="Laisser vide = CTA global" onChange={(event)=>patch({primaryCta:event.target.value})}/></label><label style={{gridColumn:'1 / -1'}}>Sous-titre régional<textarea value={policy.heroSubtitle||''} placeholder="Laisser vide = sous-titre global" onChange={(event)=>patch({heroSubtitle:event.target.value})}/></label><label style={{gridColumn:'1 / -1'}}>Annonce régionale<input value={policy.announcement||''} placeholder="Ex. Offre spéciale Suisse" onChange={(event)=>patch({announcement:event.target.value})}/></label></div>:null}
    </div>
  </div>;
}
