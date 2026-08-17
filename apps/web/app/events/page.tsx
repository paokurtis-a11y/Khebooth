'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type EventItem = {
  id: string;
  name: string;
  startsAt: string;
  endsAt?: string | null;
  venueName?: string | null;
  status: string;
  client?: { id: string; name: string } | null;
};

function kheEventNumber(eventId: string): string {
  return `KHE-EVT-${eventId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<EventItem[]>('/events')
      .then(setEvents)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Chargement impossible'));
  }, []);

  return (
    <PortalShell>
      <div className="header">
        <div><h1>Événements</h1><p>Chaque événement possède un numéro d’identification KHE stable, aligné avec son client.</p></div>
        <Link className="button" href="/events/new">Nouvel événement</Link>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <section className="card">
        {events.length === 0 ? <div className="empty">Aucun événement enregistré.</div> : (
          <table className="table">
            <thead><tr><th>N° KHE</th><th>Événement</th><th>Client</th><th>Date</th><th>Lieu</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td><strong style={{ whiteSpace: 'nowrap' }}>{kheEventNumber(event.id)}</strong></td>
                  <td><Link className="table-link" href={`/events/${event.id}`}>{event.name}</Link></td>
                  <td>{event.client?.name ?? 'Aucun client associé'}</td>
                  <td>{new Date(event.startsAt).toLocaleString('fr-CH')}</td>
                  <td>{event.venueName ?? '—'}</td>
                  <td><span className="status-badge">{event.status}</span></td>
                  <td><Link className="muted" href={`/events/${event.id}`}>Ouvrir →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PortalShell>
  );
}
