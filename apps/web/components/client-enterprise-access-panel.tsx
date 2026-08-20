'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type SecurityEvent={id:string;eventType:string;ipAddress?:string|null;createdAt:string;metadata?:Record<string,unknown>|null};
type ManagedUser={id:string;email:string;role:string;isActive:boolean;failedLoginAttempts:number;passwordResetRequired:boolean;passwordChangedAt?:string|null;passwordChangeCount:number;createdAt:string};
type EnterpriseReport={
  client:{id:string;name:string;email?:string|null;subscriptionPlan:string;subscriptionStatus:string;paymentStatus:string};
  accessEnabled:boolean;
  users:ManagedUser[];
  passwordReport:{resetRequests:number;failedAttempts:number;passwordChanges:number;lastPasswordChangeAt?:string|null;events:SecurityEvent[]};
  ownerControlsOnly:boolean;
  isolation:string;
  securityVisibility:string;
};

export function ClientEnterpriseAccessPanel({clientId,clientName,plan}:{clientId:string;clientName:string;plan:string}){
  const[report,setReport]=useState<EnterpriseReport|null>(null);
  const[loading,setLoading]=useState(false);
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');

  const load=useCallback(async()=>{
    if(plan!=='ENTERPRISE'){setReport(null);return;}
    setLoading(true);setError('');
    try{setReport(await apiRequest<EnterpriseReport>(`/clients/${clientId}/enterprise-access-report`));}
    catch(caught){setError(caught instanceof Error?caught.message:'Rapport Enterprise indisponible.');}
    finally{setLoading(false);}
  },[clientId,plan]);

  useEffect(()=>{void load();},[load]);

  async function setAccess(enabled:boolean){
    const action=enabled?'activer':'désactiver';
    if(!window.confirm(`${action[0].toUpperCase()+action.slice(1)} l’accès KHE BOOTH Enterprise de « ${clientName} » ?`))return;
    setBusy(true);setMessage('');setError('');
    try{
      const next=await apiRequest<EnterpriseReport>(`/clients/${clientId}/enterprise-access`,{method:'POST',body:JSON.stringify({enabled})});
      setReport(next);
      setMessage(enabled?'✓ Accès Enterprise activé. KHE a envoyé la procédure sécurisée de création/réinitialisation du mot de passe au client.':'✓ Accès Enterprise désactivé et sessions précédentes invalidées.');
    }catch(caught){setError(caught instanceof Error?caught.message:'Modification impossible.');}
    finally{setBusy(false);}
  }

  if(plan!=='ENTERPRISE')return <section className="card" style={{marginTop:16,borderColor:'#3c4652'}}><div className="eyebrow">ACCÈS KHE BOOTH</div><h3>Portail Enterprise</h3><p className="muted">L’accès direct à KHE BOOTH est réservé à l’abonnement Enterprise. Le client reste géré normalement dans le portefeuille avec les autres offres.</p></section>;

  return <section className="card" style={{marginTop:16,border:'1px solid rgba(210,173,79,.45)',background:'linear-gradient(145deg,#11161d,#17140d)'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexWrap:'wrap'}}>
      <div><div className="eyebrow" style={{color:'#d2ad4f'}}>PORTEFEUILLE CLIENT • ENTERPRISE</div><h2 style={{margin:'6px 0'}}>Accès KHE BOOTH</h2><p className="muted" style={{maxWidth:760}}>Tenant client isolé de la plateforme KHE principale. L’activation et la désactivation restent exclusivement sous contrôle du propriétaire KHE.</p></div>
      <span style={{padding:'8px 12px',borderRadius:999,background:report?.accessEnabled?'#143621':'#3a2525',color:report?.accessEnabled?'#8fe0aa':'#ffaaaa',fontWeight:900,fontSize:12}}>{report?.accessEnabled?'ACCÈS ACTIF':'ACCÈS INACTIF'}</span>
    </div>

    {loading?<p className="muted">Chargement du rapport d’accès…</p>:null}
    {error?<p className="error">{error}</p>:null}{message?<p className="success">{message}</p>:null}

    {report?<>
      <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',marginTop:14}}>
        {[
          ['Réinitialisations',report.passwordReport.resetRequests],
          ['Erreurs mot de passe',report.passwordReport.failedAttempts],
          ['Mots de passe changés',report.passwordReport.passwordChanges],
          ['Utilisateurs gérés',report.users.length],
        ].map(([label,value])=><div key={String(label)} style={{padding:14,border:'1px solid #303944',borderRadius:13,background:'#10151b'}}><div className="eyebrow">{label}</div><div style={{fontSize:26,fontWeight:950,color:'#e2c36b',marginTop:5}}>{value}</div></div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:12,marginTop:14}}>
        <div style={{padding:14,border:'1px solid #303944',borderRadius:13}}><strong>Isolation</strong><p className="muted" style={{marginBottom:0}}>{report.isolation==='ENTERPRISE_CLIENT_TENANT'?'Organisation Enterprise séparée du tenant KHE racine.':report.isolation}</p></div>
        <div style={{padding:14,border:'1px solid #303944',borderRadius:13}}><strong>Visibilité sécurité</strong><p className="muted" style={{marginBottom:0}}>Le client voit uniquement l’état de santé général. Les incidents, règles et commandes de maintenance restent masqués.</p></div>
        <div style={{padding:14,border:'1px solid #303944',borderRadius:13}}><strong>Dernier changement</strong><p className="muted" style={{marginBottom:0}}>{report.passwordReport.lastPasswordChangeAt?new Date(report.passwordReport.lastPasswordChangeAt).toLocaleString('fr-CH'):'Aucun changement enregistré'}</p></div>
      </div>
      {report.users.length?<div style={{overflowX:'auto',marginTop:16}}><table className="table"><thead><tr><th>Compte</th><th>État</th><th>Échecs</th><th>Reset requis</th><th>Changements</th></tr></thead><tbody>{report.users.map(user=><tr key={user.id}><td>{user.email}</td><td>{user.isActive?'Actif':'Désactivé'}</td><td>{user.failedLoginAttempts}</td><td>{user.passwordResetRequired?'Oui':'Non'}</td><td>{user.passwordChangeCount}</td></tr>)}</tbody></table></div>:null}
      {report.passwordReport.events.length?<details style={{marginTop:14}}><summary style={{cursor:'pointer',fontWeight:900}}>Historique sécurité du client ({report.passwordReport.events.length})</summary><div style={{display:'grid',gap:7,marginTop:10}}>{report.passwordReport.events.slice(0,30).map(event=><div key={event.id} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'9px 11px',border:'1px solid #303944',borderRadius:10,fontSize:12}}><span>{event.eventType}</span><span className="muted">{new Date(event.createdAt).toLocaleString('fr-CH')}</span></div>)}</div></details>:null}
      <div className="toolbar" style={{marginTop:18}}><button type="button" className={report.accessEnabled?'button danger':'button'} disabled={busy} onClick={()=>void setAccess(!report.accessEnabled)}>{busy?'Traitement…':report.accessEnabled?'Désactiver l’accès Enterprise':'Activer l’accès Enterprise'}</button><button type="button" className="button secondary" disabled={loading||busy} onClick={()=>void load()}>↻ Actualiser le rapport</button></div>
    </>:null}
  </section>;
}
