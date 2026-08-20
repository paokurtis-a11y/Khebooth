'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { getApproximateLocationSharing, getOperationsSessionKey, setApproximateLocationSharing } from '@/lib/operations-session';

type Presence={isAgent:boolean;online:boolean;availability:string;acceptingAssignments:boolean;requiresAvailabilityConfirmation:boolean;lastHeartbeatAt?:string|null;availableSince?:string|null;locationSharingEnabled?:boolean};
const LABELS:Record<string,string>={AVAILABLE:'Disponible',BUSY:'Occupé',AWAY:'Pause',UNAVAILABLE:'Indisponible'};

export function OperationsPresenceControl({role}:{role?:string}){
  const pathname=usePathname();const isAgent=['OWNER','ADMIN','OPERATOR'].includes(role??'');const isManager=['OWNER','ADMIN'].includes(role??'');
  const[presence,setPresence]=useState<Presence|null>(null);const[shareLocation,setShareLocation]=useState(false);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  const actionCount=useRef(0);const lastPath=useRef<string|null>(null);const lastWorkforcePulse=useRef(0);

  useEffect(()=>setShareLocation(getApproximateLocationSharing()),[]);
  useEffect(()=>{const handler=()=>{actionCount.current=Math.min(50,actionCount.current+1);};document.addEventListener('click',handler,{passive:true});return()=>document.removeEventListener('click',handler);},[]);

  const pulseOperations=()=>{if(!isAgent)return;void apiRequest('/operations/routing/pulse',{method:'POST'}).catch(()=>undefined);const now=Date.now();if(now-lastWorkforcePulse.current>=300000){lastWorkforcePulse.current=now;void apiRequest('/operations/workforce/pulse',{method:'POST'}).catch(()=>undefined);}};

  const heartbeat=async(pageView=0)=>{
    const sessionKey=getOperationsSessionKey();if(!sessionKey)return;
    const actions=actionCount.current;actionCount.current=0;
    try{
      const next=await apiRequest<Presence>('/operations/presence/heartbeat',{method:'POST',body:JSON.stringify({sessionKey,surface:'WEB_PORTAL',shareApproximateLocation:shareLocation,pageViews:pageView,actions})});
      setPresence(next);setError('');pulseOperations();
    }catch(e){actionCount.current=Math.min(50,actionCount.current+actions);setError(e instanceof Error?e.message:'Présence indisponible');}
  };

  useEffect(()=>{const pageView=lastPath.current===pathname?0:1;lastPath.current=pathname;void heartbeat(pageView);const timer=window.setInterval(()=>void heartbeat(0),30000);return()=>window.clearInterval(timer);},[pathname,shareLocation,isAgent]);

  const setAvailability=async(availability:string)=>{
    setBusy(true);setError('');
    try{
      const next=await apiRequest<Presence>('/operations/presence/availability',{method:'POST',body:JSON.stringify({sessionKey:getOperationsSessionKey(),availability,shareApproximateLocation:shareLocation})});
      setPresence(next);lastWorkforcePulse.current=0;pulseOperations();
    }catch(e){setError(e instanceof Error?e.message:'Statut impossible à modifier');}finally{setBusy(false);}
  };

  const changeLocation=(enabled:boolean)=>{setShareLocation(enabled);setApproximateLocationSharing(enabled);};
  if(!presence)return null;

  return <>
    {isAgent&&presence.requiresAvailabilityConfirmation?<div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,.72)',display:'grid',placeItems:'center',padding:20}}>
      <section className="card" style={{maxWidth:560,width:'100%',border:'1px solid rgba(210,173,79,.55)',boxShadow:'0 30px 90px rgba(0,0,0,.55)'}}>
        <div className="eyebrow">KHE • DISPONIBILITÉ AGENT</div><h2 style={{marginTop:8}}>Souhaitez-vous recevoir des assignations ?</h2>
        <p>Vous êtes connecté à KHE Booth, mais KHE ne vous attribuera aucune conversation ni tâche tant que vous n’avez pas activé votre disponibilité pour cette session.</p>
        <label style={{display:'flex',gap:10,alignItems:'flex-start',padding:'12px 0'}}><input type="checkbox" checked={shareLocation} onChange={e=>changeLocation(e.target.checked)}/><span><strong>Partager ma zone approximative</strong><br/><span className="muted" style={{fontSize:12}}>Pays, région et commune estimés à partir de la connexion. Pas de GPS précis en continu.</span></span></label>
        {error?<p className="error">{error}</p>:null}
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="button" disabled={busy} onClick={()=>void setAvailability('AVAILABLE')}>{busy?'Activation…':'Me rendre disponible'}</button><button className="button secondary" disabled={busy} onClick={()=>void setAvailability('UNAVAILABLE')}>Rester indisponible</button></div>
      </section>
    </div>:null}

    {isAgent?<div className="card" style={{position:'fixed',right:18,bottom:18,zIndex:900,padding:10,minWidth:225,boxShadow:'0 16px 44px rgba(0,0,0,.35)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><strong style={{fontSize:12}}>Agent KHE</strong><span style={{fontSize:11,fontWeight:900,color:presence.online?'#78d59c':'#ff9aa4'}}>● {presence.online?'Connecté':'Déconnecté'}</span></div>
      <select className="input" aria-label="Disponibilité agent" disabled={busy} value={presence.availability||'UNAVAILABLE'} onChange={e=>void setAvailability(e.target.value)} style={{marginTop:8,padding:'7px 9px'}}>
        <option value="AVAILABLE">Disponible — recevoir les tâches</option><option value="BUSY">Occupé</option><option value="AWAY">Pause</option><option value="UNAVAILABLE">Indisponible</option>
      </select>
      <div className="muted" style={{fontSize:10,marginTop:6}}>{LABELS[presence.availability]??presence.availability}{presence.acceptingAssignments?' · Routing intelligent actif':' · Aucune auto-assignation'}</div>
      {isManager?<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:7}}><Link href="/operations/routing" style={{fontSize:11,fontWeight:900,color:'#d2ad4f'}}>Routing & SLA →</Link><Link href="/operations/workforce" style={{fontSize:11,fontWeight:900,color:'#d2ad4f'}}>Workforce →</Link><Link href="/operations/workforce/optimizer" style={{fontSize:11,fontWeight:900,color:'#d2ad4f'}}>Planning optimal →</Link></div>:null}
    </div>:null}
  </>;
}
