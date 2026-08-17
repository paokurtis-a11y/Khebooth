import { SUBSCRIPTION_CATALOG } from '@khe/contracts';
import Link from 'next/link';

const featureCards = [
  ['CAPTURE instantané', 'Filmez et photographiez depuis une station dédiée, avec une expérience pensée pour les événements.'],
  ['SHARING séparé', 'Une seconde tablette devient la régie de partage : les invités accèdent aux moments sans interrompre les prises.'],
  ['Cloud sécurisé', 'Les médias validés sont synchronisés vers le cloud avec liens privés et contrôle de téléchargement.'],
  ['QR invité', 'Un QR KHE stable et révocable permet aux invités de récupérer leur contenu depuis leur téléphone.'],
  ['Studio créatif', 'Textes, cadres, effets, vitesse et musique donnent une identité visuelle à chaque événement.'],
  ['Offline-first', 'La capture continue même quand le réseau est instable. Les médias restent localement protégés puis se synchronisent.'],
];

const useCases = ['Mariages', 'Anniversaires', 'Galas', 'Événements corporate', 'Festivals', 'Agences événementielles'];

export default function HomePage() {
  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link>
        <nav className="marketing-nav-links" aria-label="Navigation principale">
          <a href="#experience">Expérience</a>
          <a href="#fonctionnalites">Fonctionnalités</a>
          <a href="#tarifs">Tarifs</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="marketing-nav-actions">
          <Link className="marketing-login" href="/login">Connexion</Link>
          <a className="marketing-cta small" href="#tarifs">Découvrir les offres</a>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-copy">
          <div className="marketing-kicker"><span /> KURTIS HYPNOTIC EVENTS PRÉSENTE</div>
          <h1>Transformez chaque événement en <em>moment que l’on partage.</em></h1>
          <p className="hero-lead">KHE Booth réunit capture, création, cloud et partage invité dans une expérience photobooth moderne conçue pour les professionnels de l’événementiel.</p>
          <div className="hero-actions">
            <a className="marketing-cta" href="#tarifs">Commencer avec KHE Booth</a>
            <a className="marketing-ghost" href="#experience"><span className="play-dot">▶</span> Voir l’expérience</a>
          </div>
          <div className="hero-proof">
            <div><strong>2</strong><span>stations dédiées</span></div>
            <div><strong>1</strong><span>expérience synchronisée</span></div>
            <div><strong>∞</strong><span>moments à partager</span></div>
          </div>
        </div>

        <div className="hero-product" aria-label="Aperçu animé de KHE Booth">
          <div className="product-orbit orbit-one" />
          <div className="product-orbit orbit-two" />
          <div className="promo-device promo-device-back">
            <div className="device-top"><span>KHE BOOTH</span><b>SHARING</b></div>
            <div className="gallery-grid">
              <div className="gallery-shot shot-one"><span>SYNCED</span></div>
              <div className="gallery-shot shot-two"><span>QR</span></div>
              <div className="gallery-shot shot-three"><span>SHARE</span></div>
              <div className="gallery-shot shot-four"><span>CLOUD</span></div>
            </div>
          </div>
          <div className="promo-device promo-device-front">
            <div className="device-top"><span>KHE BOOTH</span><b>CAPTURE</b></div>
            <div className="capture-preview">
              <div className="capture-event">MARIAGE · 2026</div>
              <div className="capture-title">Votre moment.<br />Votre signature.</div>
              <div className="capture-ring"><i /></div>
              <div className="capture-controls"><span>9:16</span><span>15s</span><span>GOLD</span></div>
            </div>
          </div>
          <div className="floating-card sync-card"><b>✓ Synchronisé</b><span>CAPTURE → CLOUD</span></div>
          <div className="floating-card qr-card"><b>QR invité</b><span>Prêt à scanner</span></div>
        </div>
      </section>

      <section className="brand-strip" aria-label="Cas d’usage">
        {useCases.map((useCase) => <span key={useCase}>{useCase}</span>)}
      </section>

      <section id="experience" className="marketing-section experience-section">
        <div className="section-heading centered">
          <div className="marketing-kicker"><span /> UNE EXPÉRIENCE FLUIDE</div>
          <h2>De la prise de vue au téléphone de l’invité.</h2>
          <p>Un parcours pensé pour que l’équipe reste concentrée sur l’événement pendant que KHE Booth gère la synchronisation.</p>
        </div>
        <div className="experience-flow">
          {[
            ['01', 'CAPTURE', 'La première tablette filme ou photographie et conserve immédiatement le média en local.'],
            ['02', 'SYNC', 'KHE Booth envoie le média vers le cloud, le vérifie et le marque comme disponible.'],
            ['03', 'SHARING', 'La seconde tablette reçoit automatiquement les moments synchronisés sans interrompre CAPTURE.'],
            ['04', 'QR INVITÉ', 'L’invité scanne son QR sécurisé et récupère son média depuis son propre téléphone.'],
          ].map(([number, title, text]) => <article className="flow-card" key={number}><div className="flow-number">{number}</div><h3>{title}</h3><p>{text}</p></article>)}
        </div>

        <div className="promo-reel">
          <div className="reel-copy">
            <div className="marketing-kicker"><span /> DÉMONSTRATION KHE</div>
            <h3>Une interface qui donne envie d’être utilisée.</h3>
            <p>Le visuel promotionnel animé ci-contre reproduit le rythme de l’application : capture, traitement, synchronisation puis partage. Il est entièrement créé pour KHE Booth et peut accueillir ensuite vos propres séquences événementielles.</p>
            <div className="reel-badges"><span>Photobooth 360</span><span>Photo</span><span>Vidéo</span><span>QR</span><span>Cloud</span></div>
          </div>
          <div className="reel-stage">
            <div className="reel-frame">
              <div className="reel-scene reel-scene-one"><span>CAPTURE</span><strong>Créez le moment</strong></div>
              <div className="reel-scene reel-scene-two"><span>SYNC</span><strong>Retrouvez-le partout</strong></div>
              <div className="reel-scene reel-scene-three"><span>SHARE</span><strong>Partagez instantanément</strong></div>
              <div className="reel-progress"><i /></div>
            </div>
          </div>
        </div>
      </section>

      <section id="fonctionnalites" className="marketing-section features-section">
        <div className="section-heading">
          <div className="marketing-kicker"><span /> TOUT CE QU’IL FAUT</div>
          <h2>Conçu pour les événements réels.</h2>
          <p>KHE Booth rassemble les fonctions indispensables dans une seule plateforme visuelle et opérationnelle.</p>
        </div>
        <div className="marketing-feature-grid">
          {featureCards.map(([title, text], index) => <article className="marketing-feature" key={title}><div className="feature-icon">0{index + 1}</div><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className="marketing-showcase">
        <div className="showcase-copy">
          <div className="marketing-kicker"><span /> BRANDING & CRÉATIVITÉ</div>
          <h2>Votre événement ne ressemble à aucun autre. Votre contenu non plus.</h2>
          <p>Adaptez chaque expérience grâce au Studio créatif KHE : textes, cadres, effets, ralentis, ambiance musicale et identité visuelle.</p>
          <ul>
            <li>Aperçu du design avant la capture</li>
            <li>Modèles mariage, anniversaire, gala et création libre</li>
            <li>Choix du passage musical et du niveau sonore</li>
            <li>Source originale conservée pour sécuriser vos médias</li>
          </ul>
        </div>
        <div className="studio-poster">
          <div className="poster-brand">KHE BOOTH</div>
          <div className="poster-copy"><span>HEUREUX</span><strong>MARIAGE</strong><small>Merci de partager ce moment avec nous</small></div>
          <div className="poster-tags"><span>GOLD</span><span>0.75×</span><span>MUSIQUE</span></div>
        </div>
      </section>

      <section id="tarifs" className="marketing-section pricing-section">
        <div className="section-heading centered">
          <div className="marketing-kicker"><span /> ABONNEMENTS</div>
          <h2>Une offre pour chaque ambition.</h2>
          <p>Les mêmes niveaux sont utilisés dans le portail Clients KHE Booth. Les tarifs ci-dessous constituent le catalogue commercial central de l’application.</p>
        </div>
        <div className="pricing-grid">
          {SUBSCRIPTION_CATALOG.map((plan) => <article className={`pricing-card${plan.highlighted ? ' pricing-highlighted' : ''}`} key={plan.id}>
            {plan.highlighted ? <div className="popular-tag">LE PLUS POPULAIRE</div> : null}
            <div className="pricing-name">{plan.name}</div>
            <p>{plan.tagline}</p>
            <div className="pricing-price">{plan.priceMonthlyChf === null ? <><strong>Sur mesure</strong></> : <><span>CHF</span><strong>{plan.priceMonthlyChf}</strong><small>/mois</small></>}</div>
            <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
            <a className={plan.highlighted ? 'marketing-cta pricing-button' : 'marketing-ghost pricing-button'} href="mailto:contact@khebooth.ch?subject=KHE%20Booth%20-%20Abonnement">{plan.actionLabel}</a>
          </article>)}
        </div>
        <p className="pricing-note">Les prix peuvent être ajustés dans le catalogue central avant commercialisation définitive. Les données privées des clients ne sont jamais publiées sur cette page.</p>
      </section>

      <section className="marketing-testimonial">
        <div className="quote-mark">“</div>
        <blockquote>Chaque invité doit repartir avec plus qu’une vidéo : il doit repartir avec l’envie de la partager.</blockquote>
        <p>KHE Booth · Une expérience Kurtis Hypnotic Events</p>
      </section>

      <section id="faq" className="marketing-section faq-section">
        <div className="section-heading"><div className="marketing-kicker"><span /> QUESTIONS FRÉQUENTES</div><h2>Simple à comprendre. Puissant à utiliser.</h2></div>
        <div className="faq-grid">
          {[
            ['Faut-il une connexion internet permanente ?', 'Non. KHE Booth est conçu en offline-first : CAPTURE conserve les médias localement et synchronise lorsque la connexion est disponible.'],
            ['Pourquoi deux stations ?', 'La séparation CAPTURE / SHARING permet de continuer à filmer pendant que les invités consultent et partagent leurs contenus sur une autre tablette.'],
            ['Le QR contient-il directement le fichier ?', 'Non. Le QR utilise une URL KHE sécurisée et révocable. Les liens de stockage privés restent temporaires.'],
            ['Puis-je personnaliser le rendu ?', 'Oui. Le Studio créatif permet de préparer l’identité visuelle et sonore de l’événement.'],
            ['À qui KHE Booth est-il destiné ?', 'Aux DJs, agences événementielles, photographes, wedding planners, exploitants de photobooth et équipes qui veulent professionnaliser le partage média.'],
            ['Puis-je commencer petit ?', 'Oui. Le niveau Découverte permet de découvrir l’écosystème avant de passer à une formule adaptée à votre activité.'],
          ].map(([question, answer]) => <article className="faq-item" key={question}><h3>{question}</h3><p>{answer}</p></article>)}
        </div>
      </section>

      <section className="marketing-final-cta">
        <div><div className="marketing-kicker"><span /> PRÊT POUR LE PROCHAIN ÉVÉNEMENT ?</div><h2>Faites de votre photobooth une expérience de marque.</h2><p>CAPTURE, SHARING, Studio créatif, cloud et QR invité réunis dans KHE Booth.</p></div>
        <div className="final-actions"><a className="marketing-cta" href="#tarifs">Choisir mon offre</a><Link className="marketing-ghost" href="/login">Accéder à KHE Booth</Link></div>
      </section>

      <footer className="marketing-footer">
        <div><Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link><p>Une solution Kurtis Hypnotic Events.</p></div>
        <div className="footer-links"><a href="#fonctionnalites">Fonctionnalités</a><a href="#tarifs">Tarifs</a><a href="#faq">FAQ</a><Link href="/login">Connexion</Link></div>
        <p className="footer-copy">© 2026 KHE Booth · Kurtis Hypnotic Events</p>
      </footer>
    </main>
  );
}
