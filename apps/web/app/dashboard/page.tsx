'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type Client = { id: string; name: string };
type EventItem = { id: string; name: string; startsAt: string; status: string; venueName?: string | null };

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiRequest<Client[]>('/clients'), apiRequest<EventItem[]>('/events')])
      .then(([clientItems, eventItems]) => {
        setClients(clientItems);
        setEvents(eventItems);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Chargement impossible'));
  }, []);

  const upcoming = events.filter((event) => new Date(event.startsAt).getTime() >= Date.now());

  return (
    <PortalShell>
      <div className="header">
        <div><h1>Tableau de bord</h1><p>Vue d’ensemble de l’activité KHE Booth.</p></div>
        <Link className="button" href="/events/new">Créer un événement</Link>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <section className="grid">
        <article className="card"><div className="muted">Clients</div><div className="metric">{clients.length}</div></article>
        <article className="card"><div className="muted">Événements à venir</div><div className="metric">{upcoming.length}</div></article>
        <article className="card"><div className="muted">Événements enregistrés</div><div className="metric">{events.length}</div></article>
      </section>
      <section className="card" style={{ marginTop: 20 }}>
        <div className="header" style={{ marginBottom: 12 }}><div><h1 style={{ fontSize: 20 }}>Prochains événements</h1></div><Link href="/events" className="muted">Tout voir</Link></div>
        {upcoming.length === 0 ? <div className="empty">Aucun événement à venir.</div> : (
          <table className="table"><thead><tr><th>Événement</th><th>Date</th><th>Lieu</th><th>Statut</th></tr></thead><tbody>
            {upcoming.slice(0, 5).map((event) => <tr key={event.id}><td>{event.name}</td><td>{new Date(event.startsAt).toLocaleString('fr-CH')}</td><td>{event.venueName ?? '—'}</td><td>{event.status}</td></tr>)}
          </tbody></table>
        )}
      </section>
    </PortalShell>
  );
}
