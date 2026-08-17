'use client';

import { useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';

const languages = [
  ['fr', 'Français'],
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['it', 'Italiano'],
  ['es', 'Español'],
  ['pt', 'Português'],
] as const;

export default function SettingsPage() {
  const [language, setLanguage] = useState('fr');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const value = window.localStorage.getItem('khe.web.language');
    if (value) setLanguage(value);
  }, []);

  function choose(next: string) {
    setLanguage(next);
    window.localStorage.setItem('khe.web.language', next);
    window.dispatchEvent(new CustomEvent('khe-language-changed', { detail: next }));
    setSaved(true);
  }

  return <PortalShell>
    <div className="header"><div><h1>Paramètres de l’application</h1><p>Réglages généraux de KHE Booth.</p></div></div>
    <div className="grid client-grid">
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Langue</h2>
        <p className="muted">La langue sélectionnée est mémorisée sur cet appareil.</p>
        <div className="form">
          {languages.map(([code, label]) => (
            <button key={code} type="button" className={language === code ? 'button' : 'button secondary'} onClick={() => choose(code)}>{language === code ? '✓ ' : ''}{label}</button>
          ))}
        </div>
        {saved ? <p className="success">Langue enregistrée.</p> : null}
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Application</h2>
        <p><strong>KHE Booth</strong></p>
        <p className="muted">Les paramètres de langue, de profil et les futurs réglages d’application sont regroupés ici.</p>
      </section>
    </div>
  </PortalShell>;
}
