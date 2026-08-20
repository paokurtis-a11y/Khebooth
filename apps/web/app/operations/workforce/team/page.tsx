'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type Shift={id:string;userId:string;startsAt:string;endsAt:string;confirmationStatus:string;responseNote?:string|null;languages:string[];skills:string[];availabilityConflict:boolean;agentName:string;agentEmail:string;replacementNeeded:boolean};
type Availability={id:string;userId:string;startsAt:string;endsAt:string;note?:string|null;email:string;firstName?:string|null;lastName?:string|null};
type Team={summary:{planned:number;pending:number;accepted:number;declined:number;replacementNeeded:number};shifts:Shift[];availability:Availability[]};
type Candidate={id:string;name:string;email:string;role:string;skills:string[];languages:string[];score:number;reason:string};
type Replacement={shift:Shift;candidates:Candidate[]};

function when(value:string){return new Date(value).toLocaleString('fr-CH',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
function statusColor(value:string){return value==='ACCEPTED'?'#78d59c':value==='DECLINED'?'#ff9aa4':'#f5c76b';}
function person(a:Availability){return[a.firstName,a.lastName].filter(Boolean).join(' ')||a.email;}

export default function WorkforceTeamPage(){
  const[data,setData]=useState<Team|null>(null);const[loading,setLoading]=useState(true);const[message,setMessage]=useState('');const[replacement,setReplacement]=useState<Replacement|null>(null);const[busy,setBusy]=useState('');
  const load=useCallback(async(quiet=false)=>{if(!quiet)setLoading(true);try{setData(await apiRequest<Team>('/operations/workforce/agent/team'));if(!quiet)setMessage('');}catch(e){if(!quiet)setMessage(e instanceof Error?e.message:'Vue équipe indisponible');}finally{if(!quiet)setLoading(false);}},[]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(true),30000);return()=>window.clearInterval(timer);},[load]);
  async function findReplacement(id:string){setBusy(id);try{setReplacement(await apiRequest<Replacement>(`/operations/workforce/agent/shifts/${id}/replacements`));}catch(e){setMessage(e instanceof Error?e.message:'Recherche impossible');}finally{setBusy('');}}
  async function reassign(shiftId:string,agentId:string){setBusy(agentId);try{await apiRequest(`/operations/workforce/agent/shifts/${shiftId}/reassign`,{method:'POST',body:JSON.stringify({agentId})});setMessage('✓ Shift réassigné. Le nouvel agent doit maintenant confirmer sa disponibilité.');setReplacement(null);await load(true);}catch(e){setMessage(e instanceof Error?e.message:'Réaffectation impossible');}finally{setBusy('');}}

  return <PortalShell><div className="page-header"><div><div className="eyebrow">KHE • AGENT WORKFORCE</div><h1>Confirmation des shifts</h1><p className="muted">Suivez les réponses de l’équipe, les conflits déclarés et les remplacements à valider. KHE ne réaffecte jamais automatiquement un shift refusé.</p><div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:8}}><Link href="/operations/workforce">← Workforce</Link><Link href="/operations/workforce/optimizer">Planning optimal</Link></div></div><button className="button secondary" onClick={()=>void load()}>{loading?'Chargement…':'↻ Actualiser'}</button></div>
  {message?<p className={message.startsWith('✓')?'success':'error'}>{message}</p>:null}
  {!data?null:<><div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',marginBottom:16}}>{[['Planifiés',data.summary.planned],['À confirmer',data.summary.pending],['Acceptés',data.summary.accepted],['Refusés',data.summary.declined],['Remplacements requis',data.summary.replacementNeeded]].map(([label,value])=><div className="card" key={String(label)}><div className="eyebrow">{label}</div><div style={{fontSize:28,fontWeight:950,marginTop:8}}>{value}</div></div>)}</div>

  <section className="card"><div className="eyebrow">30 PROCHAINS JOURS</div><h2>Shifts et confirmations</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:1000}}><thead><tr>{['Agent','Shift','Réponse','Compétences','Langues','Disponibilité','Action'].map(h=><th key={h} style={{textAlign:'left',padding:9,borderBottom:'1px solid #303945'}}>{h}</th>)}</tr></thead><tbody>{data.shifts.map(s=><tr key={s.id}><td style={{padding:9}}><strong>{s.agentName}</strong><div className="muted" style={{fontSize:10}}>{s.agentEmail}</div></td><td style={{padding:9}}>{when(s.startsAt)}<div className="muted" style={{fontSize:10}}>→ {when(s.endsAt)}</div></td><td style={{padding:9,color:statusColor(s.confirmationStatus),fontWeight:900}}>{s.confirmationStatus}{s.responseNote?<div className="muted" style={{fontSize:10,maxWidth:220}}>{s.responseNote}</div>:null}</td><td style={{padding:9}}>{s.skills.join(', ')||'Général'}</td><td style={{padding:9}}>{s.languages.join(', ')||'—'}</td><td style={{padding:9,color:s.availabilityConflict?'#ff9aa4':'inherit'}}>{s.availabilityConflict?'Conflit déclaré':'OK'}</td><td style={{padding:9}}>{s.replacementNeeded?<button className="button secondary" disabled={busy===s.id} onClick={()=>void findReplacement(s.id)}>{busy===s.id?'Recherche…':'Proposer un remplacement'}</button>:<span className="muted">—</span>}</td></tr>)}</tbody></table></div></section>

  {replacement?<section className="card" style={{marginTop:16,border:'1px solid rgba(210,173,79,.45)'}}><div className="eyebrow">REMPLACEMENT À VALIDER</div><h2>{replacement.shift.agentName} · {when(replacement.shift.startsAt)}</h2><p className="muted">Le classement utilise uniquement les compétences/langues du shift, les conflits de planning, les indisponibilités déclarées et la charge déjà planifiée. Les refus passés ne sont pas utilisés.</p>{replacement.candidates.length?replacement.candidates.map(c=><div key={c.id} style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'center',padding:'10px 0',borderBottom:'1px solid #27303a'}}><div><strong>{c.name}</strong> · score {c.score}<div className="muted" style={{fontSize:11}}>{c.reason}</div></div><button className="button" disabled={busy===c.id} onClick={()=>void reassign(replacement.shift.id,c.id)}>{busy===c.id?'Réaffectation…':'Réassigner'}</button></div>):<p className="muted">Aucun agent sans conflit n’est disponible pour ce créneau.</p>}<button className="button secondary" style={{marginTop:10}} onClick={()=>setReplacement(null)}>Fermer</button></section>:null}

  <section className="card" style={{marginTop:16}}><div className="eyebrow">INDISPONIBILITÉS DÉCLARÉES</div><h2>Couverture à surveiller</h2>{data.availability.length?data.availability.map(a=><div key={a.id} style={{padding:'9px 0',borderBottom:'1px solid #27303a'}}><strong>{person(a)}</strong> · {when(a.startsAt)} → {when(a.endsAt)}{a.note?<div className="muted" style={{fontSize:11}}>{a.note}</div>:null}</div>):<p className="muted">Aucune indisponibilité active.</p>}<p className="muted" style={{fontSize:11,marginTop:10}}>Les notes d’indisponibilité sont informatives et ne servent pas à classer ou évaluer les agents.</p></section>
  </>}
  </PortalShell>;
}
