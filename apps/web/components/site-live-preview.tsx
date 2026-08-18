'use client';

type Plan={code:string;name:string;tagline:string;priceMonthlyChf:number|null;localizedPrices?:Record<string,number>;active:boolean;highlighted:boolean};
type Props={mode:'desktop'|'mobile';regionName:string;currency:string;enabled:boolean;announcement?:string;title:string;subtitle:string;cta:string;showDownload:boolean;downloadUrl?:string|null;showPrices:boolean;showReviews:boolean;plans:Plan[];heroImageUrl?:string};
function money(cents:number|null,currency:string){if(cents===null)return'Sur mesure';return new Intl.NumberFormat(currency==='CHF'?'fr-CH':'fr-FR',{style:'currency',currency,maximumFractionDigits:2}).format(cents/100);}

export function SiteLivePreview(props:Props){
  const width=props.mode==='mobile'?360:'100%';
  if(!props.enabled)return <div className="site-preview-shell" style={{width}}><div className="site-preview-browser"/><div className="site-preview-unavailable"><div>KHE BOOTH</div><h2>Site temporairement indisponible dans cette région</h2><p>Le visiteur verra un message clair de disponibilité régionale.</p></div></div>;
  return <div className="site-preview-shell" style={{width}}>
    <div className="site-preview-browser"><i/><i/><i/></div>
    {props.announcement?<div className="site-preview-announcement">{props.announcement}</div>:null}
    <div className="site-preview-hero" style={props.heroImageUrl?{backgroundImage:`linear-gradient(90deg,rgba(6,7,9,.95),rgba(6,7,9,.45)),url(${props.heroImageUrl})`}:undefined}>
      <div className="site-preview-kicker">KURTIS HYPNOTIC EVENTS</div><h1>{props.title}</h1><p>{props.subtitle}</p><div className="site-preview-actions"><span>{props.cta}</span>{props.showDownload&&props.downloadUrl?<span className="outline">↓ Télécharger</span>:null}</div>
    </div>
    {props.showPrices?<div className="site-preview-pricing"><div className="site-preview-section-title">Abonnements · {props.currency}</div><div className={props.mode==='mobile'?'site-preview-plan-grid mobile':'site-preview-plan-grid'}>{props.plans.slice(0,3).map((plan)=>{const localized=props.currency==='CHF'?plan.priceMonthlyChf:plan.localizedPrices?.[props.currency]??plan.priceMonthlyChf;return <article key={plan.code} className={plan.highlighted?'highlighted':''}><strong>{plan.name}</strong><b>{money(localized,props.currency)}</b><p>{plan.tagline}</p></article>})}</div></div>:null}
    {props.showReviews?<div className="site-preview-review"><span>★★★★★</span><strong>Avis abonnés vérifiés</strong><small>La preuve sociale reste visible et lisible.</small></div>:null}
    <div className="site-preview-footer">Aperçu · {props.regionName}</div>
  </div>;
}
