'use client';

import { translateWebPhrase, type WebLanguage } from '@/lib/web-i18n';
import { useWebLanguage } from './use-web-language';

export type RegionKey='SWITZERLAND'|'EUROZONE'|'AFRICA'|'ASIA'|'AMERICAS'|'OTHER';
export type RegionPolicy={enabled:boolean;showPrices:boolean;showDownload:boolean;showReviews:boolean;showPromoVideo:boolean;forceCurrency?:string;heroTitle?:string;heroSubtitle?:string;primaryCta?:string;announcement?:string};
export type RegionalSettings=Record<RegionKey,RegionPolicy>;

type RegionBase={key:RegionKey;defaultCurrency?:string;icon:string};
export const REGION_OPTIONS:Array<RegionBase & {label:string;hint:string}>=[
  {key:'SWITZERLAND',label:'Suisse',hint:'Suisse et Liechtenstein',defaultCurrency:'CHF',icon:'🇨🇭'},
  {key:'EUROZONE',label:'Zone euro',hint:'Pays utilisant l’euro',defaultCurrency:'EUR',icon:'🇪🇺'},
  {key:'AFRICA',label:'Afrique',hint:'Pays du continent africain',icon:'🌍'},
  {key:'ASIA',label:'Asie',hint:'Pays du continent asiatique',icon:'🌏'},
  {key:'AMERICAS',label:'Amériques',hint:'Amérique du Nord, Amérique centrale, Caraïbes et Amérique du Sud',icon:'🌎'},
  {key:'OTHER',label:'Autres régions',hint:'Royaume-Uni, Océanie et autres pays',icon:'✦'},
];

const REGION_COPY:Record<WebLanguage,Record<RegionKey,{label:string;hint:string}>>={
  fr:{SWITZERLAND:{label:'Suisse',hint:'Suisse et Liechtenstein'},EUROZONE:{label:'Zone euro',hint:'Pays utilisant l’euro'},AFRICA:{label:'Afrique',hint:'Pays du continent africain'},ASIA:{label:'Asie',hint:'Pays du continent asiatique'},AMERICAS:{label:'Amériques',hint:'Amérique du Nord, Amérique centrale, Caraïbes et Amérique du Sud'},OTHER:{label:'Autres régions',hint:'Royaume-Uni, Océanie et autres pays'}},
  en:{SWITZERLAND:{label:'Switzerland',hint:'Switzerland and Liechtenstein'},EUROZONE:{label:'Eurozone',hint:'Countries using the euro'},AFRICA:{label:'Africa',hint:'Countries on the African continent'},ASIA:{label:'Asia',hint:'Countries on the Asian continent'},AMERICAS:{label:'Americas',hint:'North, Central and South America, plus the Caribbean'},OTHER:{label:'Other regions',hint:'United Kingdom, Oceania and other countries'}},
  de:{SWITZERLAND:{label:'Schweiz',hint:'Schweiz und Liechtenstein'},EUROZONE:{label:'Eurozone',hint:'Länder mit dem Euro'},AFRICA:{label:'Afrika',hint:'Länder des afrikanischen Kontinents'},ASIA:{label:'Asien',hint:'Länder des asiatischen Kontinents'},AMERICAS:{label:'Amerika',hint:'Nord-, Mittel- und Südamerika sowie die Karibik'},OTHER:{label:'Andere Regionen',hint:'Vereinigtes Königreich, Ozeanien und andere Länder'}},
  it:{SWITZERLAND:{label:'Svizzera',hint:'Svizzera e Liechtenstein'},EUROZONE:{label:'Zona euro',hint:'Paesi che utilizzano l’euro'},AFRICA:{label:'Africa',hint:'Paesi del continente africano'},ASIA:{label:'Asia',hint:'Paesi del continente asiatico'},AMERICAS:{label:'Americhe',hint:'Nord, Centro e Sud America, più i Caraibi'},OTHER:{label:'Altre regioni',hint:'Regno Unito, Oceania e altri paesi'}},
  es:{SWITZERLAND:{label:'Suiza',hint:'Suiza y Liechtenstein'},EUROZONE:{label:'Zona euro',hint:'Países que utilizan el euro'},AFRICA:{label:'África',hint:'Países del continente africano'},ASIA:{label:'Asia',hint:'Países del continente asiático'},AMERICAS:{label:'Américas',hint:'Norte, Centro y Sudamérica, además del Caribe'},OTHER:{label:'Otras regiones',hint:'Reino Unido, Oceanía y otros países'}},
  pt:{SWITZERLAND:{label:'Suíça',hint:'Suíça e Liechtenstein'},EUROZONE:{label:'Zona euro',hint:'Países que utilizam o euro'},AFRICA:{label:'África',hint:'Países do continente africano'},ASIA:{label:'Ásia',hint:'Países do continente asiático'},AMERICAS:{label:'Américas',hint:'América do Norte, Central e do Sul, além das Caraíbas'},OTHER:{label:'Outras regiões',hint:'Reino Unido, Oceânia e outros países'}},
};

const HELP:Record<WebLanguage,Record<string,string>>={
  fr:{visibility:'Ce que les visiteurs de cette région peuvent voir',site:'Autoriser l’accès à la vitrine KHE Booth dans cette zone.',prices:'Afficher les abonnements et les tarifs localisés.',download:'Afficher le bouton de téléchargement de l’application.',reviews:'Afficher les témoignages des abonnés vérifiés.',video:'Afficher les séquences vidéo et animations marketing.',currency:'Laissez la détection automatique pour utiliser la devise du visiteur.',localized:'Personnaliser le texte uniquement pour cette région',globalTitle:'Utiliser le titre global',globalCta:'Utiliser le bouton principal global',globalSubtitle:'Utiliser le sous-titre global',announcement:'Ex. Offre spéciale Suisse'},
  en:{visibility:'What visitors from this region can see',site:'Allow access to the KHE Booth showcase in this region.',prices:'Show localized subscriptions and prices.',download:'Show the application download button.',reviews:'Show testimonials from verified subscribers.',video:'Show promotional videos and marketing animations.',currency:'Leave automatic detection enabled to use the visitor’s currency.',localized:'Customize text only for this region',globalTitle:'Use global title',globalCta:'Use global primary button',globalSubtitle:'Use global subtitle',announcement:'e.g. Special offer Switzerland'},
  de:{visibility:'Was Besucher aus dieser Region sehen können',site:'Zugriff auf die KHE-Booth-Präsentation in dieser Region erlauben.',prices:'Lokalisierte Abonnements und Preise anzeigen.',download:'Download-Schaltfläche der Anwendung anzeigen.',reviews:'Bewertungen verifizierter Abonnenten anzeigen.',video:'Werbevideos und Marketinganimationen anzeigen.',currency:'Automatische Erkennung verwenden, um die Währung des Besuchers zu nutzen.',localized:'Text nur für diese Region anpassen',globalTitle:'Globalen Titel verwenden',globalCta:'Globale Hauptschaltfläche verwenden',globalSubtitle:'Globalen Untertitel verwenden',announcement:'z. B. Sonderangebot Schweiz'},
  it:{visibility:'Cosa possono vedere i visitatori di questa regione',site:'Consenti l’accesso alla vetrina KHE Booth in questa regione.',prices:'Mostra abbonamenti e prezzi localizzati.',download:'Mostra il pulsante di download dell’applicazione.',reviews:'Mostra le recensioni degli abbonati verificati.',video:'Mostra video promozionali e animazioni di marketing.',currency:'Lascia il rilevamento automatico per usare la valuta del visitatore.',localized:'Personalizza il testo solo per questa regione',globalTitle:'Usa il titolo globale',globalCta:'Usa il pulsante principale globale',globalSubtitle:'Usa il sottotitolo globale',announcement:'Es. Offerta speciale Svizzera'},
  es:{visibility:'Lo que pueden ver los visitantes de esta región',site:'Permitir el acceso al escaparate de KHE Booth en esta región.',prices:'Mostrar suscripciones y precios localizados.',download:'Mostrar el botón de descarga de la aplicación.',reviews:'Mostrar opiniones de suscriptores verificados.',video:'Mostrar vídeos promocionales y animaciones de marketing.',currency:'Deje la detección automática para usar la moneda del visitante.',localized:'Personalizar el texto solo para esta región',globalTitle:'Usar el título global',globalCta:'Usar el botón principal global',globalSubtitle:'Usar el subtítulo global',announcement:'Ej. Oferta especial Suiza'},
  pt:{visibility:'O que os visitantes desta região podem ver',site:'Permitir o acesso à montra KHE Booth nesta região.',prices:'Mostrar subscrições e preços localizados.',download:'Mostrar o botão de transferência da aplicação.',reviews:'Mostrar avaliações de subscritores verificados.',video:'Mostrar vídeos promocionais e animações de marketing.',currency:'Deixe a deteção automática para usar a moeda do visitante.',localized:'Personalizar o texto apenas para esta região',globalTitle:'Usar o título global',globalCta:'Usar o botão principal global',globalSubtitle:'Usar o subtítulo global',announcement:'Ex. Oferta especial Suíça'},
};

export const DEFAULT_REGIONAL_SETTINGS:RegionalSettings=Object.fromEntries(REGION_OPTIONS.map((region)=>[region.key,{enabled:true,showPrices:true,showDownload:true,showReviews:true,showPromoVideo:true,forceCurrency:region.defaultCurrency}])) as RegionalSettings;

export function normalizeRegionalSettings(value:Partial<RegionalSettings>|undefined):RegionalSettings{
  const result={...DEFAULT_REGIONAL_SETTINGS} as RegionalSettings;
  for(const region of REGION_OPTIONS)result[region.key]={...DEFAULT_REGIONAL_SETTINGS[region.key],...(value?.[region.key]||{})};
  return result;
}

function Toggle({label,help,checked,onChange}:{label:string;help:string;checked:boolean;onChange:(checked:boolean)=>void}){
  return <label className="region-option-card"><span className="region-option-copy"><strong>{label}</strong><span>{help}</span></span><span className={`region-switch${checked?' is-on':''}`} aria-hidden="true"><i/></span><input className="region-native-toggle" type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)}/></label>;
}

export function RegionalSiteSettings({value,onChange,selected,onSelectedChange,compact=false}:{value:RegionalSettings;onChange:(next:RegionalSettings)=>void;selected:RegionKey;onSelectedChange:(next:RegionKey)=>void;compact?:boolean}){
  const{language}=useWebLanguage();const t=(source:string)=>translateWebPhrase(source,language);const help=HELP[language];
  const policy=value[selected];const patch=(next:Partial<RegionPolicy>)=>onChange({...value,[selected]:{...policy,...next}});const current=REGION_OPTIONS.find((region)=>region.key===selected)!;
  const currentCopy=REGION_COPY[language][current.key];
  return <div className="regional-settings">
    <div className="region-selector-grid">{REGION_OPTIONS.map((region)=>{const active=selected===region.key;const copy=REGION_COPY[language][region.key];return <button key={region.key} type="button" className={`region-selector${active?' active':''}`} onClick={()=>onSelectedChange(region.key)}><span className="region-selector-icon">{region.icon}</span><span><strong>{copy.label}</strong><small>{copy.hint}</small></span></button>})}</div>
    <section className="region-editor-panel">
      <header className="region-editor-header"><div className="region-current"><span className="region-current-icon">{current.icon}</span><div><strong>{currentCopy.label}</strong><p>{currentCopy.hint}</p></div></div><span className={`region-status${policy.enabled?' active':''}`}>{t(policy.enabled?'SITE ACTIF':'SITE MASQUÉ')}</span></header>
      <div className="region-section-title"><span>{t('VISIBILITÉ')}</span><strong>{help.visibility}</strong></div>
      <div className="region-options-grid">
        <Toggle label={t('Site accessible')} help={help.site} checked={policy.enabled} onChange={(enabled)=>patch({enabled})}/>
        <Toggle label={t('Afficher les prix')} help={help.prices} checked={policy.showPrices} onChange={(showPrices)=>patch({showPrices})}/>
        <Toggle label={t('Téléchargement')} help={help.download} checked={policy.showDownload} onChange={(showDownload)=>patch({showDownload})}/>
        <Toggle label={t('Avis clients')} help={help.reviews} checked={policy.showReviews} onChange={(showReviews)=>patch({showReviews})}/>
        <Toggle label={t('Vidéos promotionnelles')} help={help.video} checked={policy.showPromoVideo} onChange={(showPromoVideo)=>patch({showPromoVideo})}/>
        <label className="region-currency-card"><span><strong>{t('Devise imposée')}</strong><small>{help.currency}</small></span><select value={policy.forceCurrency||''} onChange={(event)=>patch({forceCurrency:event.target.value||undefined})}><option value="">{t('Détection automatique')}</option>{['CHF','EUR','GBP','USD','CAD','AUD'].map((currency)=><option key={currency}>{currency}</option>)}</select></label>
      </div>
      {!compact?<><div className="region-section-title region-section-spacing"><span>{t('MESSAGE LOCALISÉ')}</span><strong>{help.localized}</strong></div><div className="region-fields-grid">
        <label>{t('Titre principal')}<input value={policy.heroTitle||''} placeholder={help.globalTitle} onChange={(event)=>patch({heroTitle:event.target.value})}/></label>
        <label>{t('Bouton principal')}<input value={policy.primaryCta||''} placeholder={help.globalCta} onChange={(event)=>patch({primaryCta:event.target.value})}/></label>
        <label className="wide">{t('Sous-titre')}<textarea rows={4} value={policy.heroSubtitle||''} placeholder={help.globalSubtitle} onChange={(event)=>patch({heroSubtitle:event.target.value})}/></label>
        <label className="wide">{t('Annonce régionale')}<input value={policy.announcement||''} placeholder={help.announcement} onChange={(event)=>patch({announcement:event.target.value})}/></label>
      </div></>:null}
    </section>
  </div>;
}
