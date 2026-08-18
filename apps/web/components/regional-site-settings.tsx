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
  return <label className="region-option-card">
    <span className="region-option-copy"><strong>{label}</strong><span>{help}</span></span>
    <span className={`region-switch${checked?' is-on':''}`} aria-hidden="true"><i/></span>
    <input className="region-native-toggle" type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)}/>
  </label>;
}

export function RegionalSiteSettings({value,onChange,selected,onSelectedChange,compact=false}:{value:RegionalSettings;onChange:(next:RegionalSettings)=>void;selected:RegionKey;onSelectedChange:(next:RegionKey)=>void;compact?:boolean}){
  const policy=value[selected];const patch=(next:Partial<RegionPolicy>)=>onChange({...value,[selected]:{...policy,...next}});const current=REGION_OPTIONS.find((region)=>region.key===selected)!;
  return <div className="regional-settings">
    <div className="region-selector-grid">{REGION_OPTIONS.map((region)=>{
      const active=selected===region.key;
      return <button key={region.key} type="button" className={`region-selector${active?' active':''}`} onClick={()=>onSelectedChange(region.key)}><span className="region-selector-icon">{region.icon}</span><span><strong>{region.label}</strong><small>{region.hint}</small></span></button>})}</div>

    <section className="region-editor-panel">
      <header className="region-editor-header">
        <div className="region-current"><span className="region-current-icon">{current.icon}</span><div><strong>{current.label}</strong><p>{current.hint}</p></div></div>
        <span className={`region-status${policy.enabled?' active':''}`}>{policy.enabled?'SITE ACTIF':'SITE MASQUÉ'}</span>
      </header>

      <div className="region-section-title"><span>VISIBILITÉ</span><strong>Ce que les visiteurs de cette région peuvent voir</strong></div>
      <div className="region-options-grid">
        <Toggle label="Site accessible" help="Autoriser l’accès à la vitrine KHE Booth dans cette zone." checked={policy.enabled} onChange={(enabled)=>patch({enabled})}/>
        <Toggle label="Afficher les prix" help="Afficher les abonnements et les tarifs localisés." checked={policy.showPrices} onChange={(showPrices)=>patch({showPrices})}/>
        <Toggle label="Téléchargement" help="Afficher le bouton de téléchargement de l’application." checked={policy.showDownload} onChange={(showDownload)=>patch({showDownload})}/>
        <Toggle label="Avis clients" help="Afficher les témoignages des abonnés vérifiés." checked={policy.showReviews} onChange={(showReviews)=>patch({showReviews})}/>
        <Toggle label="Vidéos promotionnelles" help="Afficher les séquences vidéo et animations marketing." checked={policy.showPromoVideo} onChange={(showPromoVideo)=>patch({showPromoVideo})}/>
        <label className="region-currency-card"><span><strong>Devise imposée</strong><small>Laissez automatique pour utiliser la devise du visiteur.</small></span><select value={policy.forceCurrency||''} onChange={(event)=>patch({forceCurrency:event.target.value||undefined})}><option value="">Détection automatique</option>{['CHF','EUR','GBP','USD','CAD','AUD'].map((currency)=><option key={currency}>{currency}</option>)}</select></label>
      </div>

      {!compact?<>
        <div className="region-section-title region-section-spacing"><span>MESSAGE LOCALISÉ</span><strong>Personnaliser le texte uniquement pour cette région</strong></div>
        <div className="region-fields-grid">
          <label>Titre principal<input value={policy.heroTitle||''} placeholder="Utiliser le titre global" onChange={(event)=>patch({heroTitle:event.target.value})}/></label>
          <label>Bouton principal<input value={policy.primaryCta||''} placeholder="Utiliser le CTA global" onChange={(event)=>patch({primaryCta:event.target.value})}/></label>
          <label className="wide">Sous-titre<textarea rows={4} value={policy.heroSubtitle||''} placeholder="Utiliser le sous-titre global" onChange={(event)=>patch({heroSubtitle:event.target.value})}/></label>
          <label className="wide">Annonce régionale<input value={policy.announcement||''} placeholder="Ex. Offre spéciale Suisse" onChange={(event)=>patch({announcement:event.target.value})}/></label>
        </div>
      </>:null}
    </section>
  </div>;
}
