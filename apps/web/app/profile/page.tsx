'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest, setSessionUser } from '@/lib/api';

type Profile = {
  id: string;
  organizationId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
};

export default function ProfilePage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<Profile>('/auth/me')
      .then((profile) => {
        setFirstName(profile.firstName ?? '');
        setLastName(profile.lastName ?? '');
        setEmail(profile.email);
        setRole(profile.role);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Profil indisponible'));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const profile = await apiRequest<Profile>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() }),
      });
      setSessionUser(profile);
      setMessage('Profil enregistré.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible');
    } finally { setBusy(false); }
  }

  return <PortalShell>
    <div className="header"><div><h1>Profil</h1><p>Identité du compte KHE Booth.</p></div></div>
    {error ? <p className="error">{error}</p> : null}
    {message ? <p className="success">{message}</p> : null}
    <section className="card" style={{ maxWidth: 720 }}>
      <form className="form" onSubmit={save}>
        <div className="field"><label htmlFor="lastName">Nom *</label><input id="lastName" required maxLength={120} value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
        <div className="field"><label htmlFor="firstName">Prénom *</label><input id="firstName" required maxLength={120} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div className="field"><label htmlFor="email">Adresse e-mail *</label><input id="email" type="email" required maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Rôle</label><input value={role} readOnly /></div>
        <p className="muted" style={{ fontSize: 13 }}>* Champs obligatoires.</p>
        <button className="button" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
      </form>
    </section>
  </PortalShell>;
}
