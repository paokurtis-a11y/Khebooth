'use client';

import { useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest, getSessionUser } from '@/lib/api';

type Msg = { id: string; author: string; body: string; createdAt: string };
type Conv = { id: string; subject: string; status: string; messages: Msg[]; assignedTo?: { email: string } | null; requester?: { email: string } };
type Agent = { id: string; email: string; role: string };

export default function HelpPage() {
  const user = getSessionUser();
  const isAgent = ['OWNER', 'ADMIN', 'OPERATOR'].includes(user?.role ?? '');
  const [mine, setMine] = useState<Conv[]>([]);
  const [inbox, setInbox] = useState<Conv[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [active, setActive] = useState<Conv | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    try {
      setMine(await apiRequest<Conv[]>('/support/conversations/me'));
      if (isAgent) {
        const [items, team] = await Promise.all([
          apiRequest<Conv[]>('/support/inbox'),
          apiRequest<Agent[]>('/support/agents'),
        ]);
        setInbox(items);
        setAgents(team);
      }
      if (active) setActive(await apiRequest<Conv>(`/support/conversations/${active.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible');
    }
  };

  useEffect(() => { refresh(); }, []);

  const start = async () => {
    if (!message.trim()) return;
    const created = await apiRequest<Conv>('/support/conversations', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    setMessage('');
    setActive(created);
    await refresh();
  };

  const send = async () => {
    if (!active || !message.trim()) return;
    await apiRequest(`/support/conversations/${active.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    setMessage('');
    setActive(await apiRequest<Conv>(`/support/conversations/${active.id}`));
    await refresh();
  };

  return (
    <PortalShell>
      <div className="header"><div><h1>Help & Messagerie</h1><p>KHE répond immédiatement. Un agent reprend la conversation si nécessaire.</p></div></div>
      {error ? <p className="error">{error}</p> : null}

      <section className="grid" style={{ alignItems: 'start' }}>
        <article className="card">
          <h2 style={{ marginTop: 0 }}>Assistant KHE</h2>
          <p className="muted">Pose une question sur l’activation, la capture, le partage, l’impression, le mode hors ligne ou ton compte.</p>
          <textarea className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. Ma tablette Sharing ne voit pas les vidéos…" />
          <button className="button" onClick={active ? send : start} style={{ marginTop: 10 }}>{active ? 'Envoyer' : 'Démarrer avec KHE'}</button>
          {active ? <button className="button secondary" style={{ marginTop: 10, marginLeft: 8 }} onClick={() => apiRequest(`/support/conversations/${active.id}/request-agent`, { method: 'POST' }).then(refresh)}>Parler à un agent</button> : null}
        </article>

        <article className="card">
          <h2 style={{ marginTop: 0 }}>Mes conversations</h2>
          {mine.length === 0 ? <div className="empty">Aucune conversation.</div> : mine.map((c) => (
            <button key={c.id} className="button secondary" style={{ width: '100%', marginBottom: 8, textAlign: 'left' }} onClick={() => apiRequest<Conv>(`/support/conversations/${c.id}`).then(setActive)}>
              {c.subject}<br /><span className="muted">{c.status}</span>
            </button>
          ))}
        </article>
      </section>

      {active ? (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>{active.subject}</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {active.messages.map((m) => (
              <div key={m.id} style={{ padding: 12, borderRadius: 12, background: m.author === 'KHE' ? 'rgba(255,194,74,.08)' : 'rgba(127,127,127,.08)' }}>
                <strong>{m.author === 'KHE' ? 'KHE' : m.author === 'AGENT' ? 'Agent KHE' : m.author === 'SYSTEM' ? 'Système' : 'Vous'}</strong>
                <div style={{ marginTop: 4 }}>{m.body}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isAgent ? (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>Back-office — Messagerie équipe</h2>
          <p className="muted">Conversations transférées à l’équipe. Ouvre un message puis assigne-le à un agent.</p>
          {inbox.length === 0 ? <div className="empty">Aucun message à traiter.</div> : inbox.map((c) => (
            <div key={c.id} style={{ padding: 12, borderBottom: '1px solid rgba(127,127,127,.2)' }}>
              <strong>{c.requester?.email ?? c.subject}</strong> — {c.status}
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="button secondary" onClick={() => apiRequest<Conv>(`/support/conversations/${c.id}`).then(setActive)}>Ouvrir</button>
                <select className="input" style={{ width: 220 }} defaultValue="" onChange={(e) => e.target.value && apiRequest(`/support/conversations/${c.id}/assign`, { method: 'PATCH', body: JSON.stringify({ userId: e.target.value }) }).then(refresh)}>
                  <option value="">Assigner à…</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
                </select>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </PortalShell>
  );
}
