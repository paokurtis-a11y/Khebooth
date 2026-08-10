'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, getAccessToken, setAccessToken } from '@/lib/api';

type LoginResponse = {
  accessToken: string;
  user: { id: string; email: string; role: string };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (getAccessToken()) router.replace('/dashboard');
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(result.accessToken);
      router.replace('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Connexion impossible');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login">
      <section className="login-card">
        <div className="brand">KHE <span>Booth</span></div>
        <h1 style={{ marginTop: 24 }}>Connexion</h1>
        <p>Portail événementiel Kurtis Hypnotic Events</p>
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Adresse email</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error ? <div className="error" role="alert">{error}</div> : null}
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </section>
    </main>
  );
}
