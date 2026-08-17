import Link from 'next/link';
import { SUBSCRIPTION_CATALOG } from '@/lib/subscriptions';

type PublicPlan={code:string;name:string;tagline:string;priceMonthlyChf:number|null;features:string[];highlighted:boolean};
type PublicSite={heroTitle:string;heroSubtitle:string;primaryCta:string;appDownloadUrl?:string|null;latestVersion?:string;releaseNotes?:string;paymentMethods?:string[];faq?:Array<{question?:string;answer?:string}>;plans:PublicPlan[]};

const API_BASE=(process.env.NEXT_PUBLIC_API_URL||'https://khebooth-api.vercel.app/api').replace(/\/$/,'');
const fallback:PublicSite={
  heroTitle:'Transformez chaque événement en moment que l’on partage.',
  heroSubtitle:'KHE Booth réunit capture, création, cloud et partage invité dans une expérience photobooth moderne conçue pour les professionnels de l’événementiel.',
  primaryCta:'Commencer avec KHE Booth',
  appDownloadUrl:'https://expo.dev/accounts/kurtis-hypnotic-event/projects/kurtis-hypnotic-events/builds',
  paymentMethods:['card','apple_pay','google_pay','twint'],
  plans:SUBSCRIPTION_CATALOG.map((plan)=>({code:plan.id,name:plan.name,tagline:plan.tagline,priceMonthlyChf:plan.priceMonthlyChf===null?null:Math.round(plan.priceMonthlyChf*100),features:[...plan.features],highlighted:Boolean(plan.highlighted)})),
};

async function siteConfig():Promise<PublicSite>{
  try{const response=await fetch(`${API_BASE}/commerce/public/site`,{cache:'no-store'});if(!response.ok)return fallback;return await response.json() as PublicSite;}catch{return fallback;}
}

const features=[
  ['CAPTURE instantané','Filmez et photographiez depuis une station dédiée, même lorsque le réseau devient instable.'],
  ['SHARING synchronisé','Une seconde tablette reçoit les médias sans interrompre la capture.'],
  ['Cloud sécurisé','Les médias finalisés sont vérifiés puis stockés avec des accès contrôlés.'],
  ['QR invité','Les invités récupèrent leur contenu depuis leur téléphone grâce à un lien KHE sécurisé.'],
  ['Studio créatif','Cadres, textes, effets, vitesse et identité visuelle pour chaque événement.'],
  ['Abonnement intelligent','Paiement, statut, messages et accès évoluent automatiquement avec le compte client.'],
];

export default async function HomePage(){
  const config=await siteConfig();
  const faq=config.faq?.filter((item)=>item?.question&&item?.answer)??[];
  const defaultFaq=[
    {question:'Faut-il une connexion internet permanente ?',answer:'Non. KHE Booth est offline-first : la capture reste locale et la synchronisation reprend dès que le réseau revient.'},
    {question:'Pourquoi CAPTURE et SHARING ?',answer:'Les deux stations permettent de filmer d’un côté et de laisser les invités consulter ou partager leurs médias de l’autre.'},
    {question:'Puis-je payer avec TWINT ?',answer:'Oui en Suisse lorsque TWINT est activé. Les cartes et les portefeuilles compatibles sont également proposés selon votre appareil.'},
    {question:'Les tarifs sont-ils les mêmes dans KHE Booth ?',answer:'Oui. Le site public et le portail KHE Booth lisent la même configuration commerciale serveur.'},
  ];
  return <main className="marketing-page">
    <header className="marketing-nav"><Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link><nav className="marketing-nav-links"><a href="#experience">Expérience</a><a href="#fonctionnalites">Fonctionnalités</a><a href="#tarifs">Tarifs</a><a href="#faq">FAQ</a></nav><div className="marketing-nav-actions"><Link className="marketing-login" href="/login">Connexion</Link><a className="marketing-cta small" href="#tarifs">Voir les offres</a></div></header>

    <section className="marketing-hero"><div className="hero-glow hero-glow-one"/><div className="hero-glow hero-glow-two"/><div className="hero-copy"><div className="marketing-kicker"><span/> KURTIS HYPNOTIC EVENTS PRÉSENTE</div><h1>{config.heroTitle}</h1><p className="hero-lead">{config.heroSubtitle}</p><div className="hero-actions"><a className="marketing-cta" href="#tarifs">{config.primaryCta}</a>{config.appDownloadUrl?<a className="marketing-ghost" href={config.appDownloadUrl}>↓ Télécharger l’application</a>:<Link className="marketing-ghost" href="/subscribe">Obtenir KHE Booth</Link>}</div><div className="hero-proof"><div><strong>2</strong><span>stations dédiées</span></div><div><strong>1</strong><span>profil synchronisé</span></div><div><strong>24/7</strong><span>automatisation KHE</span></div></div></div>
      <div className="hero-product"><div className="product-orbit orbit-one"/><div className="product-orbit orbit-two"/><div className="promo-device promo-device-back"><div className="device-top"><span>KHE BOOTH</span><b>SHARING</b></div><div className="gallery-grid"><div className="gallery-shot shot-one"><span>SYNCED</span></div><div className="gallery-shot shot-two"><span>QR</span></div><div className="gallery-shot shot-three"><span>SHARE</span></div><div className="gallery-shot shot-four"><span>CLOUD</span></div></div></div><div className="promo-device promo-device-front"><div className="device-top"><span>KHE BOOTH</span><b>CAPTURE</b></div><div className="capture-preview"><div className="capture-event">EVENT EXPERIENCE</div><div className="capture-title">Capturez.<br/>Synchronisez.<br/>Partagez.</div><div className="capture-ring"><i/></div><div className="capture-controls"><span>9:16</span><span>15s</span><span>GOLD</span></div></div></div><div className="floating-card sync-card"><b>✓ Synchronisé</b><span>CAPTURE → CLOUD</span></div><div className="floating-card qr-card"><b>QR invité</b><span>Prêt à scanner</span></div></div>
    </section>

    <section id="experience" className="marketing-section experience-section"><div className="section-heading centered"><div className="marketing-kicker"><span/> UNE EXPÉRIENCE FLUIDE</div><h2>De la capture au téléphone de l’invité.</h2><p>KHE Booth automatise la chaîne complète sans bloquer votre événement.</p></div><div className="experience-flow">{[['01','CAPTURE','Le média est créé et conservé localement.'],['02','SYNC','Le cloud reçoit et vérifie le fichier.'],['03','SHARING','La galerie se met à jour sur la seconde station.'],['04','QR','L’invité récupère et partage son média.']].map(([n,t,x])=><article className="flow-card" key={n}><div className="flow-number">{n}</div><h3>{t}</h3><p>{x}</p></article>)}</div></section>

    <section id="fonctionnalites" className="marketing-section features-section"><div className="section-heading"><div className="marketing-kicker"><span/> PLATEFORME KHE</div><h2>Tout ce qu’il faut pour exploiter un photobooth professionnel.</h2></div><div className="marketing-feature-grid">{features.map(([title,text],index)=><article className="marketing-feature" key={title}><div className="feature-icon">0{index+1}</div><h3>{title}</h3><p>{text}</p></article>)}</div></section>

    <section id="tarifs" className="marketing-section pricing-section"><div className="section-heading centered"><div className="marketing-kicker"><span/> ABONNEMENTS SYNCHRONISÉS</div><h2>Choisissez votre niveau KHE Booth.</h2><p>Les tarifs ci-dessous proviennent directement de la configuration KHE Booth.</p></div><div className="pricing-grid">{config.plans.map((plan)=><article className={`pricing-card${plan.highlighted?' pricing-highlighted':''}`} key={plan.code}>{plan.highlighted?<div className="popular-tag">LE PLUS POPULAIRE</div>:null}<div className="pricing-name">{plan.name}</div><p>{plan.tagline}</p><div className="pricing-price">{plan.priceMonthlyChf===null?<strong>Sur mesure</strong>:<><span>CHF</span><strong>{(plan.priceMonthlyChf/100).toFixed(0)}</strong><small>/mois</small></>}</div><ul>{plan.features.map((feature)=><li key={feature}>✓ {feature}</li>)}</ul><Link className={plan.highlighted?'marketing-cta pricing-button':'marketing-ghost pricing-button'} href={`/subscribe?plan=${encodeURIComponent(plan.code)}`}>{plan.priceMonthlyChf===null?'Nous contacter':plan.priceMonthlyChf===0?'Commencer gratuitement':'Choisir cette offre'}</Link></article>)}</div><div className="pricing-note"><strong>Paiement sécurisé :</strong> {(config.paymentMethods??[]).map((method)=>method==='card'?'Carte':method==='apple_pay'?'Apple Pay':method==='google_pay'?'Google Pay':method==='twint'?'TWINT':method).join(' · ')}</div></section>

    <section className="marketing-showcase"><div className="showcase-copy"><div className="marketing-kicker"><span/> APPLICATION KHE BOOTH</div><h2>Installez la station sur votre tablette et commencez.</h2><p>CAPTURE et SHARING utilisent le même profil, le même abonnement et les mêmes informations client.</p><ul><li>Mises à jour communiquées automatiquement</li><li>Statut d’abonnement visible dans le profil</li><li>Messages de maintenance et d’information</li><li>Promotions et recommandations adaptées</li></ul>{config.appDownloadUrl?<a className="marketing-cta" href={config.appDownloadUrl}>Télécharger KHE Booth {config.latestVersion?`v${config.latestVersion}`:''}</a>:null}</div><div className="studio-poster"><div className="poster-brand">KHE BOOTH</div><div className="poster-copy"><span>CAPTURE</span><strong>SHARING</strong><small>Une seule expérience synchronisée</small></div><div className="poster-tags"><span>QR</span><span>CLOUD</span><span>TWINT</span></div></div></section>

    <section id="faq" className="marketing-section faq-section"><div className="section-heading"><div className="marketing-kicker"><span/> QUESTIONS FRÉQUENTES</div><h2>Simple pour le client. Automatique pour KHE.</h2></div><div className="faq-grid">{(faq.length?faq:defaultFaq).map((item)=><article className="faq-item" key={item.question}><h3>{item.question}</h3><p>{item.answer}</p></article>)}</div></section>

    <section className="marketing-final-cta"><div><div className="marketing-kicker"><span/> PRÊT À PASSER À L’ACTION ?</div><h2>Votre abonnement KHE Booth peut commencer maintenant.</h2><p>Choisissez une offre, payez en ligne et votre compte est mis à jour automatiquement après confirmation du paiement.</p></div><div className="final-actions"><Link className="marketing-cta" href="/subscribe">Choisir mon abonnement</Link>{config.appDownloadUrl?<a className="marketing-ghost" href={config.appDownloadUrl}>Télécharger l’application</a>:null}</div></section>
    <footer className="marketing-footer"><div><Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link><p>Une solution Kurtis Hypnotic Events.</p></div><div className="footer-links"><a href="#fonctionnalites">Fonctionnalités</a><a href="#tarifs">Tarifs</a><a href="#faq">FAQ</a><Link href="/login">Connexion</Link></div><p className="footer-copy">© 2026 KHE Booth · Kurtis Hypnotic Events</p></footer>
  </main>;
}
