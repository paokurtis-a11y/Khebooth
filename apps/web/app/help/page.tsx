'use client';

import { useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest, getSessionUser } from '@/lib/api';

type Msg = { id: string; author: string; body: string; createdAt: string };
type Task = { id: string; title: string; status: 'TODO' | 'IN_PROGRESS' | 'DONE'; assignedTo?: { id: string; email: string } | null };
type Conv = {
  id: string;
  requesterUserId?: string;
  subject: string;
  status: 'BOT' | 'HANDOFF_REQUESTED' | 'ASSIGNED' | 'RESOLVED';
  messages: Msg[];
  tasks?: Task[];
  assignedTo?: { id?: string; email: string } | null;
  requester?: { id?: string; email: string };
};
type Agent = { id: string; email: string; role: string };

const STATUS_LABELS: Record<Conv['status'], string> = {
  BOT: 'Avec KHE',
  HANDOFF_REQUESTED: 'En attente d’un agent',
  ASSIGNED: 'Assignée',
  RESOLVED: 'Résolue',
};

const TASK_LABELS: Record<Task['status'], string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminée',
};

export default function HelpPage() {
  const user = getSessionUser();
  const isAgent = ['OWNER', 'ADMIN', 'OPERATOR'].includes(user?.role ?? '');
  const [mine, setMine] = useState<Conv[]>([]);
  const [inbox, setInbox] = useState<Conv[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [active, setActive] = useState<Conv | null>(null);
  const [message, setMessage] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [error, setError] = useState('');

  const loadConversation = async (id: string) => {
    const conversation = await apiRequest<Conv>(`/support/conversations/${id}`);
    setActive(conversation);
    return conversation;
  };

  const refresh = async (activeId?: string) => {
    try {
      const myItems = await apiRequest<Conv[]>('/support/conversations/me');
      setMine(myItems);
      if (isAgent) {
        const [items, team] = await Promise.all([
          apiRequest<Conv[]>('/support/inbox'),
          apiRequest<Agent[]>('/support/agents'),
        ]);
        setInbox(items);
        setAgents(team);
      }
      const id = activeId ?? active?.id;
      if (id) await loadConversation(id);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible');
    }
  };

  useEffect(() => {
    const requestedConversation = new URLSearchParams(window.location.search).get('conversation');
    refresh(requestedConversation ?? undefined);
  }, []);

  const start = async () => {
    if (!message.trim()) return;
    try {
      const created = await apiRequest<Conv>('/support/conversations', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      setMessage('');
      setActive(created);
      await refresh(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible');
    }
  };

  const send = async () => {
    if (!active || !message.trim()) return;
    try {
      await apiRequest(`/support/conversations/${active.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      setMessage('');
      await refresh(active.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible');
    }
  };

  const requestAgent = async () => {
    if (!active) return;
    await apiRequest(`/support/conversations/${active.id}/request-agent`, { method: 'POST' });
    await refresh(active.id);
  };

  const assign = async (conversationId: string, userId: string) => {
    if (!userId) return;
    await apiRequest(`/support/conversations/${conversationId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ userId }),
    });
    await refresh(conversationId);
  };

  const resolve = async () => {
    if (!active) return;
    await apiRequest(`/support/conversations/${active.id}/resolve`, { method: 'POST' });
    await refresh(active.id);
  };

  const createTask = async () => {
    if (!active || !taskTitle.trim()) return;
    await apiRequest(`/support/conversations/${active.id}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: taskTitle,
        ...(taskAssignee ? { assignedToUserId: taskAssignee } : {}),
      }),
    });
    setTaskTitle('');
    setTaskAssignee('');
    await refresh(active.id);
  };

  const updateTask = async (taskId: string, status: Task['status']) => {
    if (!active) return;
    await apiRequest(`/support/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await refresh(active.id);
  };

  const activeIsHumanTicket =
    isAgent && active?.requester?.email && active.requester.email !== user?.email && active.status !== 'BOT';

  return (
    <PortalShell>
      <div className="header">
        <div>
          <h1>Help & Messagerie</h1>
          <p>KHE répond immédiatement. Si nécessaire, la conversation passe à l’équipe support sans perdre l’historique.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <section className="grid" style={{ alignItems: 'start' }}>
        <article className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>Assistant KHE</h2>
              <p className="muted">Activation, Capture, Sharing, impression, hors ligne, compte et utilisation de KHE Booth.</p>
            </div>
            {active ? (
              <button className="button secondary" onClick={() => { setActive(null); setMessage(''); }}>
                Nouvelle conversation
              </button>
            ) : null}
          </div>
          <textarea
            className="input"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={activeIsHumanTicket ? 'Répondre à l’utilisateur…' : 'Ex. Ma tablette Sharing ne voit pas les vidéos…'}
          />
          <button className="button" onClick={active ? send : start} style={{ marginTop: 10 }}>
            {active ? 'Envoyer' : 'Démarrer avec KHE'}
          </button>
          {active && !activeIsHumanTicket && active.status !== 'RESOLVED' ? (
            <button className="button secondary" style={{ marginTop: 10, marginLeft: 8 }} onClick={requestAgent}>
              Parler à un agent
            </button>
          ) : null}
        </article>

        <article className="card">
          <h2 style={{ marginTop: 0 }}>Mes conversations</h2>
          {mine.length === 0 ? <div className="empty">Aucune conversation.</div> : mine.map((c) => (
            <button
              key={c.id}
              className="button secondary"
              style={{ width: '100%', marginBottom: 8, textAlign: 'left' }}
              onClick={() => loadConversation(c.id)}
            >
              {c.subject}<br />
              <span className="muted">{STATUS_LABELS[c.status]}</span>
            </button>
          ))}
        </article>
      </section>

      {active ? (
        <section className="card" style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>{active.subject}</h2>
              <span className="muted">{STATUS_LABELS[active.status]}</span>
              {active.assignedTo ? <span className="muted"> · Agent : {active.assignedTo.email}</span> : null}
            </div>
            {activeIsHumanTicket && active.status !== 'RESOLVED' ? (
              <button className="button secondary" onClick={resolve}>Marquer comme résolue</button>
            ) : null}
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
            {active.messages.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: m.author === 'KHE' ? 'rgba(255,194,74,.08)' : 'rgba(127,127,127,.08)',
                }}
              >
                <strong>{m.author === 'KHE' ? 'KHE' : m.author === 'AGENT' ? 'Agent KHE' : m.author === 'SYSTEM' ? 'Système' : 'Utilisateur'}</strong>
                <div style={{ marginTop: 4 }}>{m.body}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{new Date(m.createdAt).toLocaleString('fr-CH')}</div>
              </div>
            ))}
          </div>

          {activeIsHumanTicket ? (
            <div style={{ borderTop: '1px solid rgba(127,127,127,.22)', marginTop: 20, paddingTop: 18 }}>
              <h3>Tâches équipe</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                <label style={{ flex: '1 1 260px' }}>
                  <span className="muted">Nouvelle tâche</span>
                  <input className="input" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Ex. Vérifier la synchronisation de la tablette" />
                </label>
                <label style={{ flex: '0 1 240px' }}>
                  <span className="muted">Responsable</span>
                  <select className="input" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                    <option value="">Non assignée</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
                  </select>
                </label>
                <button className="button" onClick={createTask}>Créer la tâche</button>
              </div>

              <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                {(active.tasks?.length ?? 0) === 0 ? <div className="empty">Aucune tâche pour cette conversation.</div> : active.tasks?.map((task) => (
                  <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 10, border: '1px solid rgba(127,127,127,.18)', borderRadius: 10, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{task.title}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{task.assignedTo?.email ?? 'Non assignée'} · {TASK_LABELS[task.status]}</div>
                    </div>
                    <select className="input" style={{ width: 170 }} value={task.status} onChange={(e) => updateTask(task.id, e.target.value as Task['status'])}>
                      <option value="TODO">À faire</option>
                      <option value="IN_PROGRESS">En cours</option>
                      <option value="DONE">Terminée</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {isAgent ? (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>Back-office — Messagerie équipe</h2>
          <p className="muted">Les demandes transférées arrivent ici. L’équipe peut les ouvrir, les assigner et suivre les tâches jusqu’à résolution.</p>
          {inbox.length === 0 ? <div className="empty">Aucun message à traiter.</div> : inbox.map((c) => (
            <div key={c.id} style={{ padding: 12, borderBottom: '1px solid rgba(127,127,127,.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <strong>{c.requester?.email ?? c.subject}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{STATUS_LABELS[c.status]}{c.assignedTo ? ` · ${c.assignedTo.email}` : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="button secondary" onClick={() => loadConversation(c.id)}>Ouvrir</button>
                  {c.status !== 'RESOLVED' ? (
                    <select className="input" style={{ width: 220 }} value={c.assignedTo?.id ?? ''} onChange={(e) => assign(c.id, e.target.value)}>
                      <option value="">Assigner à…</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
                    </select>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </PortalShell>
  );
}
