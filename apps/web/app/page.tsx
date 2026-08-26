import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { AnalyticsBeacon } from '@/components/analytics-beacon';
import { CurrencySelector } from '@/components/currency-selector';
import { HowItWorksShowcase } from '@/components/how-it-works-showcase';
import { AddToCartButton, MarketingCart } from '@/components/marketing-cart';
import { MarketingLanguageSelector } from '@/components/marketing-language-selector';
import { PromoStoryReel } from '@/components/promo-story-reel';
import { getMarketingCopy, getMarketingPlan, resolveMarketingLanguage } from '@/lib/marketing-i18n';
import { SUBSCRIPTION_CATALOG } from '@/lib/subscriptions';

type Market={country:string;region?:string;currency:string;locale:string;unitSystem:'metric'|'imperial';billingUnit:'month'};
type RegionPolicy={enabled:boolean;showPrices:boolean;showDownload:boolean;showReviews:boolean;showPromoVideo:boolean;forceCurrency?:string;announcement?:string};
type Plan={code:string;name:string;tagline:string;priceMonthlyChf:number|null;priceMonthlyCents:number|null;currency:string;features:string[];highlighted:boolean};
type Site={heroTitle:string;heroSubtitle:string;primaryCta:string;appDownloadUrl?:string|null;latestVersion?:string;paymentMethods?:string[];faq?:Array<{question?:string;answer?:string}>;plans:Plan[];market:Market;supportedCurrencies:string[];regionPolicy?:RegionPolicy;media?:Record<string,string>};
type Promotion={id:string;name:string;planCode?:string|null;discountPercent:number;endsAt:string;messageTitle?:string|null;messageBody?:string|null}|null;
type Review={id:string;rating:number;title?:string|null;body:string;displayName:string;verifiedSubscriber:boolean};

const API=(process.env.NEXT_PUBLIC_API_URL||'https://khebooth-api.vercel.app/api').replace(/\/$/,'');
const fallbackMarket:Market={country:'CH',region:'SWITZERLAND',currency:'CHF',locale:'fr-CH',unitSystem:'metric',billingUnit:'month'};
const fallback:Site={heroTitle:'Transformez chaque événement en un moment que l’on partage.',heroSubtitle:'Capture, création, cloud et partage avec les invités sont réunis dans KHE Booth.',primaryCta:'Commencer avec KHE Booth',appDownloadUrl:'https://expo.dev/accounts/kurtis-hypnotic-event/projects/kurtis-hypnotic-events/builds',paymentMethods:['card','apple_pay','google_pay','twint'],market:fallbackMarket,supportedCurrencies:['CHF','EUR','GBP','USD','CAD','AUD'],regionPolicy:{enabled:true,showPrices:true,showDownload:true,showReviews:true,showPromoVideo:true},media:{},plans:SUBSCRIPTION_CATALOG.map((plan)=>({code:plan.id,name:plan.name,tagline:plan.tagline,priceMonthlyChf:plan.priceMonthlyChf===null?null:Math.round(plan.priceMonthlyChf*100),priceMonthlyCents:plan.priceMonthlyChf===null?null:Math.round(plan.priceMonthlyChf*100),currency:'CHF',features:[...plan.features],highlighted:Boolean(plan.highlighted)}))};
const FEATURE_VISUALS=[
  {src:'/marketing/features/capture.webp',tag:'Photobooth Station · CAPTURE'},
  {src:'/marketing/features/sharing.webp',tag:'Photobooth 360° · SHARING'},
  {src:'/marketing/features/studio.webp',tag:'Photobooth Station · STUDIO'},
  {src:'/marketing/features/qr.webp',tag:'Photobooth Station · QR'},
  {src:'/marketing/features/subscription.webp',tag:'Photobooth Station · ABONNEMENT'},
  {src:'/marketing/features/marketing.webp',tag:'Station + 360° · MARKETING'},
] as const;
const COUNTRY_FLAGS:Record<string,string>={CH:'🇨🇭',FR:'🇫🇷',DE:'🇩🇪',AT:'🇦🇹',IT:'🇮🇹',ES:'🇪🇸',PT:'🇵🇹',GB:'🇬🇧',US:'🇺🇸',CA:'🇨🇦',AU:'🇦🇺',BE:'🇧🇪',LU:'🇱🇺',LI:'🇱🇮',BR:'🇧🇷',MX:'🇲🇽'};

async function get<T>(path:string,value:T):Promise<T>{try{const response=await fetch(`${API}${path}`,{cache:'no-store'});return response.ok?await response.json() as T:value;}catch{return value;}}
function money(cents:number,currency:string,locale:string){return new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:0,maximumFractionDigits:2}).format(cents/100);}
function period(language:string){if(language==='en')return'/month';if(language==='de')return'/Monat';if(language==='it')return'/mese';if(language==='es')return'/mes';if(language==='pt')return'/mês';return'/mois';}
function readCookie(raw:string|null,name:string){const found=(raw||'').split(';').map((part)=>part.trim()).find((part)=>part.startsWith(`${name}=`));return found?decodeURIComponent(found.slice(name.length+1)):null;}

export default async function HomePage({searchParams}:{searchParams:Promise<{currency?:string;lang?:string}>}){
  const requestHeaders=await headers();
  const query=await searchParams;
  const country=requestHeaders.get('x-vercel-ip-country')||'CH';
  const requestedCurrency=(query.currency||'').toUpperCase();
  const sitePath=`/commerce/public/site?country=${encodeURIComponent(country)}${requestedCurrency?`&currency=${encodeURIComponent(requestedCurrency)}`:''}`;
  const[site,promo,reviews]=await Promise.all([get<Site>(sitePath,fallback),get<Promotion>('/marketing/public/promotion',null),get<Review[]>('/commerce/public/reviews',[])]);
  const market=site.market||fallbackMarket;
  const language=resolveMarketingLanguage({requested:query.lang,saved:readCookie(requestHeaders.get('cookie'),'khe_marketing_language'),locale:market.locale,country});
  const t=getMarketingCopy(language);
  const region=site.regionPolicy||fallback.regionPolicy!;
  const media=site.media||{};
  const localizedPlans=site.plans.map((plan)=>({...plan,...getMarketingPlan(language,plan.code,plan)}));
  const planCart=localizedPlans.map((plan)=>{
    const base=plan.priceMonthlyCents;
    const applies=Boolean(promo&&(!promo.planCode||promo.planCode===plan.code)&&base&&base>0);
    const price=applies?Math.round(base!*(100-promo!.discountPercent)/100):base;
    return{code:plan.code,name:plan.name,tagline:plan.tagline,priceLabel:price===null?t.pricing.custom:money(price,market.currency,market.locale)+period(language)};
  });
  if(!region.enabled)return <main className="marketing-page" lang={language}><header className="marketing-nav"><Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link><div className="marketing-nav-actions"><MarketingLanguageSelector compact language={language} label={t.selectors.language}/><Link className="marketing-login" href="/login">{t.nav.login}</Link></div></header><section className="marketing-hero marketing-unavailable"><div className="hero-copy"><div className="marketing-kicker"><span/> KHE BOOTH</div><h1>{t.unavailable.title}</h1><p className="hero-lead">{t.unavailable.body}</p><div className="hero-actions"><Link className="marketing-ghost" href="/login">{t.unavailable.login}</Link></div></div></section></main>;

  return <main className="marketing-page" lang={language}><AnalyticsBeacon/>
    <header className="marketing-nav">
      <Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link>
      <nav className="marketing-nav-links" aria-label="Navigation"><a href="#features">{t.nav.features}</a><a href="#mode-emploi">{t.nav.how}</a>{region.showPrices?<a href="#tarifs">{t.nav.pricing}</a>:null}{region.showReviews?<a href="#avis">{t.nav.reviews}</a>:null}<a href="#faq">{t.nav.faq}</a></nav>
      <div className="marketing-nav-actions"><MarketingCart language={language} currency={market.currency} plans={planCart}/><CurrencySelector compact language={language} currency={market.currency} supportedCurrencies={site.supportedCurrencies||fallback.supportedCurrencies}/><MarketingLanguageSelector compact language={language} label={t.selectors.language}/><Link className="marketing-login" href="/account/subscription">{t.nav.subscription}</Link><Link className="marketing-login" href="/login">{t.nav.login}</Link></div>
    </header>
    {region.announcement?<div className="marketing-announcement">{region.announcement}</div>:promo?<div className="marketing-promotion">{promo.messageTitle||promo.name} · -{promo.discountPercent}% · {new Date(promo.endsAt).toLocaleDateString(market.locale)}</div>:null}

    <section className="marketing-hero"><div className="hero-glow hero-glow-one"/><div className="hero-copy"><div className="marketing-kicker"><span/> {t.hero.kicker}</div><h1>{t.hero.title}</h1><p className="hero-lead">{t.hero.subtitle}</p><div className="hero-actions">{region.showPrices?<a className="marketing-cta" href="#tarifs">{t.hero.primary}</a>:<a className="marketing-cta" href="#features">{t.hero.primary}</a>}{region.showDownload&&site.appDownloadUrl?<a className="marketing-ghost" href={site.appDownloadUrl}>↓ {t.hero.download}</a>:null}</div><div className="hero-proof"><div><strong>2</strong><span>{t.hero.stations}</span></div><div><strong>1</strong><span>{t.hero.profile}</span></div><div><strong>24/7</strong><span>{t.hero.automation}</span></div></div></div><div className="hero-product"><div className="promo-device promo-device-front"><div className="device-top"><span>KHE BOOTH</span><b>CAPTURE</b></div><div className="capture-preview"><div className="capture-event">{t.hero.experience}</div><div className="capture-title">{t.hero.capture.split('\n').map((line)=><span key={line}>{line}<br/></span>)}</div><div className="capture-ring"><i/></div><div className="capture-controls"><span>9:16</span><span>CLOUD</span><span>QR</span></div></div></div></div></section>

    {region.showPromoVideo?<PromoStoryReel media={media} language={language}/>:null}
    <HowItWorksShowcase media={media} language={language}/>

    <section id="features" className="marketing-section"><div className="section-heading centered"><div className="marketing-kicker"><span/> {t.features.kicker}</div><h2>{t.features.title}</h2><p>{t.features.intro}</p></div><div className="marketing-feature-grid">{t.features.items.map((feature,index)=>{const visual=FEATURE_VISUALS[index];return <details className="marketing-feature marketing-feature-detail" key={feature.title}><summary><div className="feature-icon">0{index+1}</div><div className="feature-summary-copy"><h3>{feature.title}</h3><p>{feature.summary}</p></div><span className="feature-expand-icon" aria-hidden="true">+</span></summary><div className="feature-detail-body"><figure className="feature-motion-shot" aria-hidden="true"><Image src={visual.src} alt="" width={960} height={640} sizes="(max-width: 720px) 92vw, 31vw"/><span className="feature-motion-sheen"/><figcaption>{visual.tag}</figcaption></figure><p>{feature.detail}</p><ul>{feature.benefits.map((benefit)=><li key={benefit}>{benefit}</li>)}</ul><a className="marketing-cta" href="#tarifs">{feature.cta} →</a></div></details>;})}</div></section>

    {region.showPrices?<section id="tarifs" className="marketing-section pricing-section"><div className="section-heading centered"><div className="marketing-kicker"><span/> {t.pricing.kicker}</div><h2>{t.pricing.title}</h2><p>{t.pricing.intro}</p><div className="pricing-market"><span>{t.pricing.currency}: <strong>{market.currency}</strong></span><span>{COUNTRY_FLAGS[market.country]||'🌍'} {t.pricing.country}: <strong>{market.country}</strong></span></div></div><div className="pricing-grid">{localizedPlans.map((plan)=>{
      const base=plan.priceMonthlyCents;
      const applies=Boolean(promo&&(!promo.planCode||promo.planCode===plan.code)&&base&&base>0);
      const price=applies?Math.round(base!*(100-promo!.discountPercent)/100):base;
      const cartPlan={code:plan.code,name:plan.name,tagline:plan.tagline,priceLabel:price===null?t.pricing.custom:money(price,market.currency,market.locale)+period(language)};
      const detailLabel=plan.priceMonthlyChf===0?t.pricing.free:plan.priceMonthlyChf===null?t.pricing.quote:t.pricing.details;
      return <details className={'pricing-card pricing-plan-details'+(plan.highlighted?' pricing-highlighted':'')} key={plan.code} open={plan.highlighted}><summary className="pricing-plan-summary">{plan.highlighted?<span className="popular-tag">{t.pricing.popular}</span>:null}{applies?<span className="eyebrow">{t.pricing.discount} -{promo!.discountPercent}%</span>:null}<span className="pricing-name">{plan.name}</span><span className="pricing-tagline">{plan.tagline}</span><span className="pricing-price">{price===null?<strong>{t.pricing.custom}</strong>:<><strong>{money(price,market.currency,market.locale)}</strong><small>{period(language)}</small></>}</span><span className="pricing-select-hint">{t.pricing.select}<b aria-hidden="true">+</b></span></summary><div className="pricing-plan-body">{applies&&base!==price?<p className="muted">{t.pricing.instead} {money(base!,market.currency,market.locale)}</p>:null}<ul>{plan.features.map((feature)=><li key={feature}>✓ {feature}</li>)}</ul><div className="pricing-actions"><AddToCartButton plan={cartPlan} language={language}/><Link className="marketing-ghost pricing-button pricing-secondary-action" href={`/subscribe?plan=${encodeURIComponent(plan.code)}&currency=${encodeURIComponent(market.currency)}&lang=${language}`}>{detailLabel}</Link></div></div></details>;
    })}</div><p className="pricing-note">{t.pricing.payments}: {(site.paymentMethods??[]).map((method)=>method==='card'?'Carte':method==='apple_pay'?'Apple Pay':method==='google_pay'?'Google Pay':method==='twint'?'TWINT':method).join(' · ')}. {t.pricing.twint}</p></section>:null}

    {region.showReviews?<section id="avis" className="marketing-section reviews-section"><div className="section-heading centered"><div className="marketing-kicker"><span/> {t.reviews.kicker}</div><h2>{t.reviews.title}</h2><p>{t.reviews.intro}</p></div>{reviews.length?<div className="marketing-feature-grid">{reviews.slice(0,6).map((review)=><article className="marketing-feature review-card" key={review.id}><div className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</div><h3>{review.title||t.reviews.experience}</h3><p>{review.body}</p><strong>{review.displayName}</strong><div className="muted">✓ {t.reviews.verified}</div></article>)}</div>:<div className="card review-empty">{t.reviews.empty}</div>}<div className="review-action"><Link className="marketing-ghost" href="/review">{t.reviews.leave}</Link></div></section>:null}

    <section id="faq" className="marketing-section faq-section"><div className="section-heading"><div className="marketing-kicker"><span/> {t.faq.kicker}</div><h2>{t.faq.title}</h2></div><div className="faq-grid">{t.faq.items.map((item)=><article className="faq-item" key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></article>)}</div></section>

    <section className="marketing-final-cta"><div><div className="marketing-kicker"><span/> {t.final.kicker}</div><h2>{t.final.title}</h2><p>{t.final.body}</p></div><div className="final-actions">{region.showPrices?<Link className="marketing-cta" href={`/subscribe?currency=${market.currency}&lang=${language}`}>{t.final.choose}</Link>:null}{region.showDownload&&site.appDownloadUrl?<a className="marketing-ghost" href={site.appDownloadUrl}>{t.final.download}</a>:null}</div></section>

    <footer className="marketing-footer"><div><Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link><p>{t.footer.solution}</p></div><div className="footer-links"><Link href="/account/subscription">{t.nav.subscription}</Link>{region.showReviews?<Link href="/review">{t.footer.reviews}</Link>:null}<Link href="/login">{t.nav.login}</Link></div><p className="footer-copy">© 2026 KHE Booth</p></footer>
  </main>;
}
