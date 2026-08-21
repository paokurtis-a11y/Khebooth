'use client';

import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type Dashboard={
  generatedAt:string;
  policy:{strictRouting:boolean};
  summary:{
    support:{open:number;critical:number;high:number;overdue:number;unassigned:number};
    live:{active:number;paused:number;scheduled:number;missed:number};
    brief:{open:number;ready:number;urgent:number;missingNotes:number};
    rescue:{open:number;prepared:number;overdue:number;urgent:number};
    handover:{batches:number;pending:number;withoutSuggestion:number};
    agents:{total:number;online:number;available:number;activeShift:number;pausedShift:number};
    coverage4h:{shifts:number;agents:number};
  };
  attention:Array<{severity:'CRITICAL'|'WATCH'|'INFO';title:string;detail:string;href:string}>;
  criticalConversations:Array<{id:string;subject:string;status:string;priority:string;routingTopic:string;requestedLanguage:string;lastMessageAt:string;escalationLevel:number;nextSlaDueAt?:string|null;assignedAgentName?:string|null}>;
  agents:Array<{id:string;name:string;email:string;role:string;availability?:string|null;acceptingAssignments?:boolean;online:boolean;liveStatus:string;shiftEndsAt?:string|null;activeConversations:number;maxConversations:number;activeTasks:number;maxTasks:number}>;
  coverage:Array<{id:string;userId:string;startsAt:string;endsAt:string;liveStatus:string;agentName:string}>;
};

function when(v?:string|null){return v?new Date(v).toLocaleString('fr-CH',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';}
function remaining(v?:string|null){if(!v)return'Pas d’échéance';const m=Math.round((new Date(v).getTime()-Date.now())/60000);if(m<0)return`dépassé de ${Math.abs(m)} min`;if(m<60)return`dans ${m} min`;return`dans ${Math.floor(m/60)} h ${m%60} min`;}
function capacity(active:number,max:number){return `${active}/${max}`;}

export default function OperationsCommandCenterPage(){
  const[data,setData]=useState<Dashboard|null>(null);const[loading,setLoading]=useState(true);const[message,setMessage]=useState('');
  const load=useCallback(async(quiet=false)=>{if(!quiet)setLoading(true);try{setData(await apiRequest<Dashboard>('/operations/command-center'));if(!quiet)setMessage('');}catch(e){if(!quiet)setMessage(e instanceof Error?e.message:'Command Center indisponible');}finally{if(!quiet)setLoading(false);}},[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(true),15000);return()=>window.clearInterval(timer);},[load]);
  const s=data?.summary;
  return <PortalShell>
    <div className="page-header"><div><div className="eyebrow">KHE • OPERATIONS COMMAND CENTER</div><h1>Supervision opérationnelle unifiée</h1><p className="muted">Une vue OWNER/ADMIN pour voir immédiatement ce qui nécessite une attention. Les décisions sensibles restent volontairement dans les modules spécialisés.</p><div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:8}}><Link href="/operations">Intelligence opérations</Link><Link href="/operations/routing">Routing & SLA</Link><Link href="/operations/workforce/live/team">Live équipe</Link><Link href="/operations/workforce/rescue">SLA Rescue</Link><Link href="/operations/workforce/handover">Relais</Link></div></div><button className="button secondary" onClick={()=>void load()}>{loading?'Chargement…':'↻ Actualiser'}</button></div>
    {message?<p className="error">{message}</p>:null}
    {!data||!s?null:<>
      <section className="card" style={{marginBottom:16,border:'1px solid rgba(133,184,255,.28)'}}><div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div><div className="eyebrow">MODE SUPERVISION</div><strong>Lecture centralisée · actions explicites uniquement</strong><div className="muted" style={{fontSize:12,marginTop:4}}>Dernière consolidation : {when(data.generatedAt)}</div></div><div style={{fontSize:12,fontWeight:900}}>Routing strict : {data.policy.strictRouting?'ACTIF':'DÉSACTIVÉ'}</div></div></section>

      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',marginBottom:16}}>
        {[
          ['SLA dépassés',s.support.overdue],['Critiques',s.support.critical],['Rescue à décider',s.rescue.open],['Relais en attente',s.handover.pending],['Agents en service',s.live.active],['Agents disponibles',s.agents.available],['Couverture 4 h',s.coverage4h.agents],['Conversations ouvertes',s.support.open]
        ].map(([label,value])=><div className="card" key={String(label)}><div className="eyebrow">{label}</div><div style={{fontSize:28,fontWeight:950,marginTop:8}}>{value}</div></div>)}
      </div>

      <div className="grid two" style={{alignItems:'start',marginBottom:16}}>
        <section className="card"><div className="eyebrow">ATTENTION OWNER / ADMIN</div><h2>Ce qui demande une décision</h2>{data.attention.map((a,i)=><Link href={a.href} key={`${a.title}-${i}`} style={{display:'block',padding:'11px 0',borderBottom:'1px solid #27303a',color:'inherit',textDecoration:'none'}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><strong>{a.title}</strong><span style={{fontSize:10,fontWeight:950}}>{a.severity}</span></div><div className="muted" style={{fontSize:12,marginTop:3}}>{a.detail}</div></Link>)}</section>
        <section className="card"><div className="eyebrow">CONTINUITÉ</div><h2>Brief, Rescue & Handover</h2><div className="grid two"><div><strong>{s.brief.open+s.brief.ready}</strong><div className="muted" style={{fontSize:11}}>brief(s) actifs</div></div><div><strong>{s.brief.urgent}</strong><div className="muted" style={{fontSize:11}}>SLA urgents dans briefs</div></div><div><strong>{s.rescue.prepared}</strong><div className="muted" style={{fontSize:11}}>relève(s) Rescue préparée(s)</div></div><div><strong>{s.handover.withoutSuggestion}</strong><div className="muted" style={{fontSize:11}}>relais sans suggestion</div></div></div><div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}><Link className="button secondary" href="/operations/workforce/brief/team">Brief équipe</Link><Link className="button secondary" href="/operations/workforce/rescue">SLA Rescue</Link><Link className="button secondary" href="/operations/workforce/handover">Handover</Link></div></section>
      </div>

      <section className="card" style={{marginBottom:16}}><div className="eyebrow">FILE PRIORITAIRE</div><h2>Conversations critiques ou à risque SLA</h2>{data.criticalConversations.length?<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:900}}><thead><tr>{['Conversation','Priorité','SLA','Agent','Escalade','Contexte','Action'].map(h=><th key={h} style={{textAlign:'left',padding:9,borderBottom:'1px solid #303945'}}>{h}</th>)}</tr></thead><tbody>{data.criticalConversations.map(c=><tr key={c.id}><td style={{padding:9}}><strong>{c.subject}</strong><div className="muted" style={{fontSize:11}}>{c.status}</div></td><td style={{padding:9,fontWeight:900}}>{c.priority}</td><td style={{padding:9}}><strong>{remaining(c.nextSlaDueAt)}</strong><div className="muted" style={{fontSize:11}}>{when(c.nextSlaDueAt)}</div></td><td style={{padding:9}}>{c.assignedAgentName||'Non assigné'}</td><td style={{padding:9}}>{c.escalationLevel||0}</td><td style={{padding:9}}>{c.routingTopic} · {c.requestedLanguage}</td><td style={{padding:9}}><Link href={`/help?agentConversation=${c.id}`}>Ouvrir →</Link></td></tr>)}</tbody></table></div>:<p className="muted">Aucune conversation critique ou SLA dépassée.</p>}</section>

      <div className="grid two" style={{alignItems:'start',marginBottom:16}}>
        <section className="card"><div className="eyebrow">CHARGE ÉQUIPE</div><h2>Agents & capacité</h2>{data.agents.length?data.agents.map(a=><div key={a.id} style={{padding:'10px 0',borderBottom:'1px solid #27303a'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><strong>{a.name}</strong><span style={{fontSize:11,fontWeight:900}}>{a.liveStatus==='ACTIVE'?'EN SERVICE':a.liveStatus==='PAUSED'?'PAUSE':a.online?'CONNECTÉ':'HORS SERVICE'}</span></div><div className="muted" style={{fontSize:11,marginTop:3}}>{a.role} · {a.availability||'UNAVAILABLE'} · conversations {capacity(a.activeConversations,a.maxConversations)} · tâches {capacity(a.activeTasks,a.maxTasks)}{a.shiftEndsAt?` · fin ${when(a.shiftEndsAt)}`:''}</div></div>):<p className="muted">Aucun agent actif.</p>}</section>
        <section className="card"><div className="eyebrow">COUVERTURE 4 HEURES</div><h2>Shifts actifs & entrants</h2>{data.coverage.length?data.coverage.map(x=><div key={x.id} style={{padding:'10px 0',borderBottom:'1px solid #27303a'}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><strong>{x.agentName}</strong><span style={{fontSize:11,fontWeight:900}}>{x.liveStatus}</span></div><div className="muted" style={{fontSize:11}}>{when(x.startsAt)} → {when(x.endsAt)}</div></div>):<p className="muted">Aucun shift confirmé couvrant les 4 prochaines heures.</p>}</section>
      </div>

      <section className="card"><div className="eyebrow">ACCÈS RAPIDES</div><h2>Modules spécialisés</h2><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Link className="button secondary" href="/operations/workforce/live/team">Live équipe</Link><Link className="button secondary" href="/operations/workforce/brief/team">Shift Brief</Link><Link className="button secondary" href="/operations/workforce/rescue">SLA Rescue</Link><Link className="button secondary" href="/operations/workforce/handover">Shift Handover</Link><Link className="button secondary" href="/operations/routing">Routing & SLA</Link><Link className="button secondary" href="/operations/workforce">Prévisions</Link><Link className="button secondary" href="/operations/workforce/optimizer">Optimiseur</Link><Link className="button secondary" href="/operations">Agents & intelligence</Link></div></section>
    </>}
  </PortalShell>;
}
