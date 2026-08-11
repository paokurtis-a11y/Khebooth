'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest, getSessionUser } from '@/lib/api';

type ClientItem = { id: string; name: string };
type PresetItem = { id: string; name: string; aspectRatio: string };
type EventItem = {
  id: string;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  status: string;
  clientId?: string | null;
  presetId?: string | null;
  client?: ClientItem | null;
  preset?: PresetItem | null;
};

type Activation = { code: string; expiresAt: string };
type Manifest = {
  version: number;
  event: Record<string, unknown>;
  preset: Record<string, unknown> | null;
  organization: { id: string; name: string } | null;
  capabilities: { capture: boolean; sharing: boolean; formats: string[] };
};

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [event, setEvent] = useState<EventItem | null>(null);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [clientId, setClientId] = useState('');
  const [presetId, setPresetId] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [activation, setActivation] = useState<Activation | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [eventItem, clientItems, presetItems] = await Promise.all([
        apiRequest<EventItem>(`/events/${id}`),
        apiRequest<ClientItem[]>('/clients'),
        apiRequest<PresetItem[]>('/presets'),
      ]);
      setEvent(eventItem);
      setClients(clientItems);
      setPresets(presetItems);
      setName(eventItem.name);
      setDescription(eventItem.description ?? '');
      setStartsAt(toLocalInput(eventItem.startsAt));
      setEndsAt(toLocalInput(eventItem.endsAt));
      setVenueName(eventItem.venueName ?? '');
      setVenueAddress(eventItem.venueAddress ?? '');
      setClientId(eventItem.clientId ?? '');
      setPresetId(eventItem.presetId ?? '');
      setStatus(eventItem.status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement impossible');
    }
  }, [id]);

  useEffect(() => {
    const role = getSessionUser()?.role;
    setCanDelete(role === 'OWNER' || role === 'ADMIN');
    void load();
  }, [load]);

  async function save(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const updated = await apiRequest<EventItem>(`/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          description: description || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
          venueName: venueName || undefined,
          venueAddress: venueAddress || undefined,
          clientId: clientId || undefined,
          presetId: presetId || undefined,
          status,
        }),
      });
      setEvent(updated);
      setMessage('Événement mis à jour.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Mise à jour impossible');
    } finally {
      setSubmitting(false);
    }
  }

  async function activate() {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest<Activation>(`/events/${id}/activate`, { method: 'POST' });
      setActivation(result);
      setStatus('ACTIVE');
      setMessage('Événement activé. Le code ci-dessous est temporaire.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Activation impossible');
    } finally {
      setSubmitting(false);
    }
  }

  async function loadManifest() {
    setError('');
    try {
      setManifest(await apiRequest<Manifest>(`/events/${id}/manifest`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Manifest indisponible');
    }
  }

  async function remove() {
    if (!canDelete || !window.confirm('Supprimer définitivement cet événement ?')) return;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest<{ deleted: true }>(`/events/${id}`, { method: 'DELETE' });
      router.replace('/events');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible');
      setSubmitting(false);
    }
  }

  return (
    <PortalShell>
      <div className="header">
        <div>
          <Link className="muted" href="/events">← Retour aux événements</Link>
          <h1 style={{ marginTop: 10 }}>{event?.name ?? 'Événement'}</h1>
          <p>Configuration, activation et manifest de la station.</p>
        </div>
        <div className="toolbar">
          <button className="button secondary" type="button" onClick={() => void loadManifest()}>Manifest</button>
          <button className="button" type="button" disabled={submitting} onClick={() => void activate()}>Activer</button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      {activation ? (
        <section className="card activation-card">
          <div>
            <div className="muted">Code d’activation temporaire</div>
            <div className="activation-code">{activation.code}</div>
            <div className="muted">Expire le {new Date(activation.expiresAt).toLocaleString('fr-CH')}</div>
          </div>
          <p className="warning">Copiez ce code maintenant. Une nouvelle activation révoquera le code actif précédent.</p>
        </section>
      ) : null}

      <div className="grid detail-grid" style={{ marginTop: 20 }}>
        <section className="card">
          <form className="form" onSubmit={save}>
            <div className="field"><label htmlFor="event-name">Nom</label><input id="event-name" required maxLength={180} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label htmlFor="description">Description</label><textarea id="description" rows={4} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="grid form-grid">
              <div className="field"><label htmlFor="starts-at">Début</label><input id="starts-at" required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
              <div className="field"><label htmlFor="ends-at">Fin</label><input id="ends-at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
            </div>
            <div className="field"><label htmlFor="venue-name">Lieu</label><input id="venue-name" maxLength={180} value={venueName} onChange={(e) => setVenueName(e.target.value)} /></div>
            <div className="field"><label htmlFor="venue-address">Adresse</label><input id="venue-address" maxLength={300} value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} /></div>
            <div className="grid form-grid">
              <div className="field"><label htmlFor="client">Client</label><select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Aucun</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
              <div className="field"><label htmlFor="preset">Preset</label><select id="preset" value={presetId} onChange={(e) => setPresetId(e.target.value)}><option value="">Aucun</option>{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name} · {preset.aspectRatio}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="status">Statut</label><select id="status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="DRAFT">DRAFT</option><option value="READY">READY</option><option value="ACTIVE">ACTIVE</option><option value="COMPLETED">COMPLETED</option><option value="ARCHIVED">ARCHIVED</option></select></div>
            <div className="toolbar">
              <button className="button" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
              {canDelete ? <button className="button danger" type="button" disabled={submitting} onClick={() => void remove()}>Supprimer</button> : null}
            </div>
          </form>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>Manifest station</h2>
          {manifest ? <pre className="manifest">{JSON.stringify(manifest, null, 2)}</pre> : <div className="empty">Chargez le manifest pour vérifier la configuration qui sera transmise à la station.</div>}
        </section>
      </div>
    </PortalShell>
  );
}
