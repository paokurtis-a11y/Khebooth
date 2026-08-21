'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type Me={email:string;firstName?:string|null;lastName?:string|null;role:string};
type Workforce={nextShift?:{id:string;startsAt:string;endsAt:string;confirmationStatus:string}|null;unreadNotices:number};
type Live={shift?:{id:string;startsAt:string;endsAt:string;liveStatus:string;confirmationStatus:string}|null;policy?:{requireActiveShiftForRouting:boolean}};
type Brief={brief?:{id:string;status:string;shiftEndsAt:string;openConversationCount:number;urgentSlaCount:number;missingNoteCount:number}|null};
type Rescue={open:number;prepared:number;overdue:number;urgent:number};

type Data={me:Me;workforce:Workforce;live:Live;brief:Brief;rescue:Rescue};
function when(v?:string|null){return v?new Date(v).toLocaleString('fr-CH',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';}
function name(me?:Me|null){return [me?.firstName,me?.lastName].filter(Boolean).join(' ')||me?.email||'Agent KHE';}

export default function AgentWorkspacePage(){
  const[data,setData]=useState<Data|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState('');
  const load=useCallback(async(quiet=false)=>{if(!quiet)setLoading(true);try{const[me,workforce,live,brief,rescue]=await Promise.all([apiRequest<Me>('/auth/me'),apiRequest<Workforce>('/operations/workforce/agent/compact'),apiRequest<Live>('/operations/workforce/live/compact'),apiRequest<Brief>('/operations/workforce/brief/compact'),apiRequest<Rescue>('/operations/workforce/rescue/compact')]);setData({me,workforce,live,brief,rescue});if(!quiet)setError('');}catch(e){if(!quiet)setError(e instanceof Error?e.message:'Espace Agent indisponible');}finally{if(!quiet)setLoading(false);}},[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(true),30000);return()=>window.clearInterval(timer);},[load]);
  const activeShift=useMemo(()=>data?.live.shift&&['ACTIVE','PAUSED'].includes(data.live.shift.liveStatus)?data.live.shift:null,[data]);
  const nextShift=data?.workforce.nextShift;
  return <PortalShell>
    <div className="page-header"><div><div className="eyebrow">KHE • ESPACE AGENT</div><h1>{data?`Bonjour ${name(data.me)}`:'Espace de travail Agent KHE'}</h1><p className="muted">Un seul point d’entrée pour votre planning, votre service Live, la messagerie support et les passages de relais.</p></div><button className="button secondary" onClick={()=>void load()}>{loading?'Chargement…':'↻ Actualiser'}</button></div>
    {error?<p className="error">{error}</p>:null}
    <section className="card" style={{marginBottom:16,border:'1px solid rgba(210,173,79,.35)'}}><div className="eyebrow">AVANT DE RECEVOIR DES DOSSIERS</div><h2>Confirmez votre disponibilité</h2><p>Le panneau <strong>Agent KHE</strong> en bas à droite permet de choisir Disponible, Occupé, Pause ou Indisponible. KHE ne vous attribue pas automatiquement de conversation tant que vous n’avez pas confirmé que vous êtes disponible pour cette session.</p><p className="muted" style={{fontSize:12,marginBottom:0}}>Le partage de zone approximative est facultatif. Il n’utilise pas de GPS précis en continu.</p></section>
    <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',marginBottom:16}}>
      <div className="card"><div className="eyebrow">SERVICE</div><div style={{fontSize:19,fontWeight:950,marginTop:8}}>{activeShift?activeShift.liveStatus==='ACTIVE'?'🟢 En service':'⏸ En pause':'Hors service'}</div><div className="muted" style={{fontSize:11,marginTop:5}}>{activeShift?`jusqu’à ${when(activeShift.endsAt)}`:nextShift?`Prochain : ${when(nextShift.startsAt)}`:'Aucun shift proche'}</div></div>
      <div className="card"><div className="eyebrow">PLANNING</div><div style={{fontSize:27,fontWeight:950,marginTop:8}}>{data?.workforce.unreadNotices??0}</div><div className="muted" style={{fontSize:11}}>notification(s) non lue(s)</div></div>
      <div className="card"><div className="eyebrow">SHIFT BRIEF</div><div style={{fontSize:27,fontWeight:950,marginTop:8}}>{data?.brief.brief?.openConversationCount??0}</div><div className="muted" style={{fontSize:11}}>{data?.brief.brief?`${data.brief.brief.urgentSlaCount} SLA urgent(s) · ${data.brief.brief.missingNoteCount} note(s) manquante(s)`:'Aucun brief actif'}</div></div>
      <div className="card"><div className="eyebrow">SLA RESCUE</div><div style={{fontSize:27,fontWeight:950,marginTop:8}}>{(data?.rescue.open??0)+(data?.rescue.prepared??0)}</div><div className="muted" style={{fontSize:11}}>{data?.rescue.overdue??0} dépassé(s) · {data?.rescue.urgent??0} urgent(s)</div></div>
    </div>
    <div className="grid two" style={{alignItems:'start'}}>
      <section className="card"><div className="eyebrow">MA JOURNÉE</div><h2>Parcours de travail</h2>{[
        ['1','Mon planning','Confirmez vos shifts et signalez vos indisponibilités.','/operations/workforce/me'],
        ['2','Live Shift','Démarrez le service, mettez en pause, reprenez puis terminez votre shift.','/operations/workforce/live'],
        ['3','Help & Messagerie','Répondez aux demandes support, suivez les conversations et les tâches équipe.','/help'],
        ['4','Shift Brief','Avant la fin du service, complétez les notes de continuité des dossiers encore ouverts.','/operations/workforce/brief'],
        ['5','SLA Rescue','Consultez les dossiers à risque. Les décisions de transfert/escalade restent manager.','/operations/workforce/rescue/me'],
        ['6','Passage de relais','Ajoutez vos notes et suivez les conversations préparées pour la relève.','/operations/workforce/handover/me'],
      ].map(([n,t,b,href])=><Link key={n} href={href} style={{display:'block',padding:'11px 0',borderBottom:'1px solid #27303a',color:'inherit',textDecoration:'none'}}><div style={{display:'flex',gap:10}}><strong style={{color:'#d2ad4f'}}>{n}</strong><div><strong>{t}</strong><div className="muted" style={{fontSize:11,marginTop:3}}>{b}</div></div></div></Link>)}</section>
      <section className="card"><div className="eyebrow">ACCÈS DIRECTS</div><h2>Outils agent</h2><div style={{display:'grid',gap:9}}><Link className="button" href="/help">Aide / Messagerie</Link><Link className="button secondary" href="/operations/workforce/me">Mon planning</Link><Link className="button secondary" href="/operations/workforce/live">Live Shift</Link><Link className="button secondary" href="/operations/workforce/brief">Shift Brief</Link><Link className="button secondary" href="/operations/workforce/rescue/me">SLA Rescue</Link><Link className="button secondary" href="/operations/workforce/handover/me">Passage de relais</Link><Link className="button secondary" href="/guide#agents-khe">Mode d’emploi Agents KHE</Link></div><p className="muted" style={{fontSize:11,marginTop:14}}>Les compétences, langues, capacités, horaires de routing et politiques globales sont configurés par OWNER/ADMIN dans Paramètres → Agents KHE.</p></section>
    </div>
  </PortalShell>;
}
