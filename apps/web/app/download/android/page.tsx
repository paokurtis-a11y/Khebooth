import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Télécharger KHE Booth pour Android',
  description: 'Canal officiel de téléchargement de KHE Booth pour Android.',
};

const RELEASE_PAGE = 'https://github.com/paokurtis-a11y/Khebooth/releases/tag/android-latest';

export default function AndroidDownloadPage() {
  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <Link className="marketing-brand" href="/">
          KHE <span>BOOTH</span>
        </Link>
        <div className="marketing-nav-actions">
          <Link className="marketing-login" href="/login">
            Connexion
          </Link>
        </div>
      </header>

      <section className="marketing-hero" style={{ minHeight: '72vh', alignItems: 'center' }}>
        <div className="hero-glow hero-glow-one" />
        <div className="hero-copy">
          <div className="marketing-kicker">
            <span /> APPLICATION ANDROID
          </div>
          <h1>Télécharger KHE Booth pour Android.</h1>
          <p className="hero-lead">
            Installez la dernière version Android disponible depuis le canal officiel KHE Booth.
            Le bouton ci-dessous reste identique à chaque nouvelle compilation publiée.
          </p>

          <div className="hero-actions">
            <a className="marketing-cta" href="/download/android/latest">
              ↓ Télécharger l’APK Android
            </a>
            <a className="marketing-ghost" href={RELEASE_PAGE} target="_blank" rel="noreferrer">
              Voir la version sur GitHub
            </a>
          </div>

          <div className="hero-proof">
            <div>
              <strong>APK</strong>
              <span>installation directe</span>
            </div>
            <div>
              <strong>CI</strong>
              <span>compilation vérifiée</span>
            </div>
            <div>
              <strong>Stable</strong>
              <span>même lien de téléchargement</span>
            </div>
          </div>
        </div>

        <div className="hero-product">
          <div className="promo-device promo-device-front">
            <div className="device-top">
              <span>KHE BOOTH</span>
              <b>ANDROID</b>
            </div>
            <div className="capture-preview">
              <div className="capture-event">KHE BOOTH MOBILE</div>
              <div className="capture-title">
                Téléchargez.<br />Installez.<br />Testez.
              </div>
              <div className="capture-ring">
                <i />
              </div>
              <div className="capture-controls">
                <span>APK</span>
                <span>ANDROID</span>
                <span>BÊTA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="section-heading centered">
          <div className="marketing-kicker">
            <span /> INSTALLATION
          </div>
          <h2>Installation en quelques étapes.</h2>
          <p>
            Cette version est actuellement une bêta technique signée pour les tests Android. Elle
            sera remplacée par la version de production signée sans changer cette adresse.
          </p>
        </div>

        <div className="marketing-feature-grid">
          <article className="marketing-feature">
            <div className="feature-icon">01</div>
            <h3>Télécharger</h3>
            <p>Appuyez sur le bouton de téléchargement et enregistrez le fichier APK.</p>
          </article>
          <article className="marketing-feature">
            <div className="feature-icon">02</div>
            <h3>Autoriser</h3>
            <p>Si Android le demande, autorisez temporairement l’installation depuis votre navigateur.</p>
          </article>
          <article className="marketing-feature">
            <div className="feature-icon">03</div>
            <h3>Installer</h3>
            <p>Ouvrez le fichier APK téléchargé puis confirmez l’installation de KHE Booth.</p>
          </article>
        </div>
      </section>

      <section className="marketing-final-cta">
        <div>
          <div className="marketing-kicker">
            <span /> KHE BOOTH
          </div>
          <h2>Un seul lien pour les prochaines versions.</h2>
          <p>
            Les futures compilations Android pourront être publiées automatiquement derrière ce même
            canal de téléchargement.
          </p>
        </div>
        <div className="final-actions">
          <a className="marketing-cta" href="/download/android/latest">
            Télécharger maintenant
          </a>
          <Link className="marketing-ghost" href="/">
            Retour à l’accueil
          </Link>
        </div>
      </section>

      <footer className="marketing-footer">
        <div>
          <Link className="marketing-brand" href="/">
            KHE <span>BOOTH</span>
          </Link>
          <p>Une solution Kurtis Hypnotic Events.</p>
        </div>
        <p className="footer-copy">© 2026 KHE Booth</p>
      </footer>
    </main>
  );
}
