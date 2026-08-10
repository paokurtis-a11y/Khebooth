'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type ClientItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadClients = useCallback(() => {
    apiRequest<ClientItem[]>('/clients')
      .then(setClients)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Chargement impossible'));
  }, []);

  useEffect(() => loadClients(), [loadClients]);

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiRequest<ClientItem>('/clients', {
        method: 'POST',
        body: JSON.stringify({
          name,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
        }),
      });
      setName('');
      setEmail('');
      setPhone('');
      loadClients();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Création impossible');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell>
      <div className="header"><div><h1>Clients</h1><p>Contacts rattachés à votre organisation.</p></div></div>
      {error ? <p className="error">{error}</p> : null}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(280px, 380px) 1fr' }}>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Nouveau client</h2>
          <form className="form" onSubmit={createClient}>
            <div className="field"><label htmlFor="name">Nom</label><input id="name" required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="phone">Téléphone</label><input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <button className="button" disabled={submitting}>{submitting ? 'Création…' : 'Ajouter le client'}</button>
          </form>
        </section>
        <section className="card">
          {clients.length === 0 ? <div className="empty">Aucun client.</div> : (
            <table className="table"><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th></tr></thead><tbody>
              {clients.map((client) => <tr key={client.id}><td>{client.name}</td><td>{client.email ?? '—'}</td><td>{client.phone ?? '—'}</td></tr>)}
            </tbody></table>
          )}
        </section>
      </div>
    </PortalShell>
  );
}
