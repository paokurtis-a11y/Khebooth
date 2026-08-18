'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type ClientItem = { id: string; name: string };
type PresetItem = { id: string; name: string; aspectRatio: string };

export default function NewEventPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [clientId, setClientId] = useState('');
  const [presetId, setPresetId] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([apiRequest<ClientItem[]>('/clients'), apiRequest<PresetItem[]>('/presets')])
      .then(([clientItems, presetItems]) => {
        setClients(clientItems);
        setPresets(presetItems);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Chargement impossible'));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/events', {
        method: 'POST',
        body: JSON.stringify({
          name,
          startsAt: new Date(startsAt).toISOString(),
          ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
          ...(clientId ? { clientId } : {}),
          ...(presetId ? { presetId } : {}),
          ...(venueName ? { venueName } : {}),
          ...(venueAddress ? { venueAddress } : {}),
          ...(description ? { description } : {}),
        }),
      });
      router.push('/events');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Création impossible');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell>
      <div className="header"><div><div className="eyebrow">NOUVEL ÉVÉNEMENT</div><h1>Créer un événement</h1><p>Configuration initiale de l’expérience photobooth.</p></div></div>
      {error ? <div className="portal-error-state" style={{marginBottom:16}}><strong>Création impossible</strong><p>{error}</p></div> : null}
      <section className="card">
        <form className="form" onSubmit={submit}>
          <div className="field"><label htmlFor="name">Nom de l’événement</label><input id="name" required maxLength={180} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="client">Client</label><select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">Aucun client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
          <div className="field"><label htmlFor="preset">Preset</label><select id="preset" value={presetId} onChange={(e) => setPresetId(e.target.value)}><option value="">Aucun preset</option>{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name} — {preset.aspectRatio}</option>)}</select></div>
          <div className="grid two">
            <div className="field"><label htmlFor="startsAt">Début</label><input id="startsAt" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
            <div className="field"><label htmlFor="endsAt">Fin</label><input id="endsAt" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="venueName">Lieu</label><input id="venueName" maxLength={180} value={venueName} onChange={(e) => setVenueName(e.target.value)} /></div>
          <div className="field"><label htmlFor="venueAddress">Adresse</label><input id="venueAddress" maxLength={300} value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} /></div>
          <div className="field"><label htmlFor="description">Description</label><textarea id="description" rows={4} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="toolbar"><button className="button" disabled={submitting}>{submitting ? 'Création…' : 'Créer l’événement'}</button><button type="button" className="button secondary" onClick={() => router.push('/events')}>Annuler</button></div>
        </form>
      </section>
    </PortalShell>
  );
}
