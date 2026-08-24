'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type Health = { overall: string; surfaces: Array<{ surface: string; status: string; openIncidents: number }> };
type AgentStatus = { name: string; version: string; access: string; executionPolicy: string; health: Health };
type Message = { id?: string; role: 'OWNER' | 'ASSISTANT'; body: string; createdAt?: string };

export default function HypnoticConceptionPage() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<AgentStatus>('/hypnotic-conception/status'),
      apiRequest<Message[]>('/hypnotic-conception/messages'),
    ]).then(([nextStatus, history]) => { setStatus(nextStatus); setMessages(history); })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Accès indisponible'));
  }, []);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft(''); setError(''); setBusy(true);
    setMessages(previous => [...previous, { role: 'OWNER', body: message }]);
    try {
      const result = await apiRequest<{ answer: string }>('/hypnotic-conception/chat', {
        method: 'POST', body: JSON.stringify({ message }),
      });
      setMessages(previous => [...previous, { role: 'ASSISTANT', body: result.answer }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Réponse indisponible');
    } finally { setBusy(false); }
  }

  return <PortalShell><div style={{maxWidth:1180,margin:'0 auto',display:'grid',gap:18}}>
    <header className="card" style={{background:'linear-gradient(135deg,rgba(210,173,79,.16),rgba(14,21,39,.96))'}}>
      <div className="muted" style={{fontSize:12,fontWeight:900,letterSpacing:'.14em'}}>ROBO PROGRAMMEUR · PROPRIÉTAIRE UNIQUEMENT</div>
      <h1 style={{margin:'8px 0 6px'}}>Hypnotic Conception {status?.version ?? '0.3.1'}</h1>
      <p className="muted" style={{margin:0}}>Questions, diagnostic, solutions et préparation d’exécution pour KHE BOOTH.</p>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>
        <span className="badge">Accès ROOT OWNER</span><span className="badge">Journal d’audit actif</span>
        <span className="badge">Actions sensibles sur approbation</span>
      </div>
    </header>

    <section style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 260px',gap:16,alignItems:'start'}}>
      <div className="card" style={{minHeight:560,display:'flex',flexDirection:'column'}}>
        <div aria-live="polite" style={{display:'grid',gap:12,flex:1,alignContent:'start',maxHeight:'62vh',overflowY:'auto',paddingRight:4}}>
          {!messages.length && !error ? <div className="muted">Je suis prêt. Demandez-moi l’état de la plateforme, une analyse ou une solution.</div> : null}
          {messages.map((message,index)=><article key={message.id ?? `${message.role}-${index}`} style={{maxWidth:'88%',justifySelf:message.role==='OWNER'?'end':'start',padding:'12px 14px',borderRadius:14,whiteSpace:'pre-wrap',background:message.role==='OWNER'?'rgba(210,173,79,.18)':'rgba(255,255,255,.055)',border:'1px solid rgba(255,255,255,.09)'}}>
            <strong style={{display:'block',fontSize:11,marginBottom:6,color:'#d2ad4f'}}>{message.role==='OWNER'?'PROPRIÉTAIRE':'HYPNOTIC CONCEPTION'}</strong>{message.body}
          </article>)}
          {busy?<div className="muted">Hypnotic Conception analyse…</div>:null}<div ref={endRef}/>
        </div>
        {error?<div role="alert" style={{color:'#ff9f9f',marginTop:12}}>{error}</div>:null}
        <form onSubmit={submit} style={{display:'flex',gap:10,marginTop:16}}>
          <textarea aria-label="Question pour Hypnotic Conception" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={4000} rows={3} placeholder="Posez une question ou demandez un diagnostic…" style={{flex:1,resize:'vertical'}}/>
          <button className="button" disabled={busy||!draft.trim()} type="submit">Envoyer</button>
        </form>
      </div>
      <aside className="card">
        <div className="muted" style={{fontSize:11,fontWeight:900}}>SANTÉ ACTUELLE</div>
        <div style={{fontSize:24,fontWeight:900,margin:'8px 0 14px',color:status?.health.overall==='HEALTHY'?'#76e6a2':'#f4c15d'}}>{status?.health.overall ?? 'CHARGEMENT'}</div>
        <div style={{display:'grid',gap:8}}>{status?.health.surfaces.map(item=><div key={item.surface} style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:12}}><span>{item.surface}</span><strong>{item.status}</strong></div>)}</div>
        <hr style={{borderColor:'rgba(255,255,255,.1)',margin:'18px 0'}}/>
        <p className="muted" style={{fontSize:12,lineHeight:1.55,margin:0}}>L’agent peut diagnostiquer et proposer. Déploiements, secrets, suppressions et actions de sécurité sensibles exigent votre confirmation.</p>
      </aside>
    </section>
  </div></PortalShell>;
}
