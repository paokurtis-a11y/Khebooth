'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest, getSessionUser } from '@/lib/api';

type ClientItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  notes?: string | null;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadClients = useCallback(() => {
    apiRequest<ClientItem[]>('/clients')
      .then(setClients)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Chargement impossible'));
  }, []);

  useEffect(() => {
    const role = getSessionUser()?.role;
    setCanDelete(role === 'OWNER' || role === 'ADMIN');
    loadClients();
  }, [loadClients]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setEmail('');
    setPhone('');
    setCompanyName('');
    setNotes('');
  }

  function editClient(client: ClientItem) {
    setEditingId(client.id);
    setName(client.name);
    setEmail(client.email ?? '');
    setPhone(client.phone ?? '');
    setCompanyName(client.companyName ?? '');
    setNotes(client.notes ?? '');
    setMessage('');
    setError('');
  }

  async function submitClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const body = JSON.stringify({
        name,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(companyName ? { companyName } : {}),
        ...(notes ? { notes } : {}),
      });
      if (editingId) {
        await apiRequest<ClientItem>(`/clients/${editingId}`, { method: 'PATCH', body });
        setMessage('Client mis à jour.');
      } else {
        await apiRequest<ClientItem>('/clients', { method: 'POST', body });
        setMessage('Client ajouté.');
      }
      resetForm();
      loadClients();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeClient(client: ClientItem) {
    if (!canDelete || !window.confirm(`Supprimer définitivement le client « ${client.name} » ?`)) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await apiRequest<{ deleted: true }>(`/clients/${client.id}`, { method: 'DELETE' });
      if (editingId === client.id) resetForm();
      setMessage('Client supprimé.');
      loadClients();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell>
      <div className="header"><div><h1>Clients</h1><p>Contacts rattachés à votre organisation.</p></div></div>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}
      <div className="grid client-grid">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>{editingId ? 'Modifier le client' : 'Nouveau client'}</h2>
          <form className="form" onSubmit={submitClient}>
            <div className="field"><label htmlFor="name">Nom</label><input id="name" required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="company">Entreprise</label><input id="company" maxLength={160} value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
            <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label htmlFor="phone">Téléphone</label><input id="phone" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" rows={4} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="toolbar">
              <button className="button" disabled={submitting}>{submitting ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Ajouter le client'}</button>
              {editingId ? <button className="button secondary" type="button" onClick={resetForm}>Annuler</button> : null}
            </div>
          </form>
        </section>
        <section className="card">
          {clients.length === 0 ? <div className="empty">Aucun client.</div> : (
            <table className="table"><thead><tr><th>Nom</th><th>Entreprise</th><th>Email</th><th>Téléphone</th><th></th></tr></thead><tbody>
              {clients.map((client) => (
                <tr key={client.id}>
                  <td><button className="link-button" type="button" onClick={() => editClient(client)}>{client.name}</button></td>
                  <td>{client.companyName ?? '—'}</td>
                  <td>{client.email ?? '—'}</td>
                  <td>{client.phone ?? '—'}</td>
                  <td><div className="toolbar"><button className="button secondary compact" type="button" onClick={() => editClient(client)}>Modifier</button>{canDelete ? <button className="button danger compact" type="button" disabled={submitting} onClick={() => void removeClient(client)}>Supprimer</button> : null}</div></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </section>
      </div>
    </PortalShell>
  );
}
