'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type PermissionMap=Record<string,boolean>;
type Member={id:string;email:string;firstName?:string|null;lastName?:string|null;phone?:string|null;role:string;isActive:boolean;permissions:PermissionMap;permissionOverrides?:PermissionMap;createdAt:string};
type Invitation={id:string;email:string;role:string;permissions:PermissionMap;permissionOverrides?:PermissionMap;expiresAt:string;createdAt:string};
type TeamPayload={availablePermissions:string[];members:Member[];invitations:Invitation[]};
const ROLES=['ADMIN','OPERATOR','SHARE_HOST'] as const;
const LABELS:Record<string,string>={
'dashboard.view':'Voir Dashboard','clients.view':'Voir clients','clients.manage':'Modifier clients','clients.delete':'Supprimer clients','enterprise.verify':'Vérifier les dossiers Enterprise','events.view':'Voir événements','events.manage':'Créer / modifier événements','events.delete':'Supprimer événements','studio.view':'Voir Studio / Presets','studio.manage':'Modifier Studio / Presets','studio.delete':'Supprimer Presets','marketing.view':'Voir Marketing','marketing.manage':'Gérer Marketing','communications.manage':'Communications clients','site.manage':'Configurer le site','billing.manage':'Gérer facturation','team.manage':'Gérer équipe','reports.export':'Exporter rapports'};
const DESCRIPTIONS:Record<string,string>={
'dashboard.view':'Accès aux indicateurs principaux.','clients.view':'Consulter les fiches clients.','clients.manage':'Créer et modifier les fiches.','clients.delete':'Supprimer définitivement un client.','enterprise.verify':'Accès sensible accordé par le OWNER pour examiner et valider pièce d’identité/passeport et preuve de domicile des clients Enterprise. Ne permet pas d’activer la plateforme ni de signer le contrat à la place du client.','events.view':'Consulter les événements.','events.manage':'Créer et mettre à jour un événement.','events.delete':'Supprimer un événement.','studio.view':'Consulter les designs et presets.','studio.manage':'Créer et modifier les designs.','studio.delete':'Supprimer un preset.','marketing.view':'Consulter les statistiques marketing.','marketing.manage':'Créer campagnes et automatisations.','communications.manage':'Gérer les messages clients.','site.manage':'Modifier la vitrine KHE Booth.','billing.manage':'Gérer abonnement et facturation.','team.manage':'Inviter et administrer les membres.','reports.export':'Télécharger les rapports.'};
const GROUP_META:Record<string,{icon:string;description:string}>={
  Gestion:{icon:'01',description:'Clients, événements, Studio et tableau de bord.'},
  Enterprise:{icon:'02',description:'Droit sensible de vérification documentaire accordé explicitement par le OWNER.'},
  Marketing:{icon:'03',description:'Analyses, campagnes, communications et rapports.'},
  Administration:{icon:'04',description:'Site, facturation, équipe et sécurité.'},
};

export default function TeamPage(){
 const[data,setData]=useState<TeamPayload|null>(null);const[message,setMessage]=useState('');const[error,setError]=useState('');const[email,setEmail]=useState('');const[role,setRole]=useState('OPERATOR');const[invitePermissions,setInvitePermissions]=useState<PermissionMap>({});const[busy,setBusy]=useState(false);
 const load=useCallback(()=>apiRequest<TeamPayload>('/team').then(setData).catch((e)=>setError(e instanceof Error?e.message:'Équipe indisponible')),[]);useEffect(()=>{void load();},[load]);
 const grouped=useMemo(()=>{const values=data?.availablePermissions||[];return{Gestion:values.filter((p)=>p.includes('clients')||p.includes('events')||p.includes('studio')||p.includes('dashboard')),Enterprise:values.filter((p)=>p==='enterprise.verify'),Marketing:values.filter((p)=>p.includes('marketing')||p.includes('communications')||p.includes('reports')),Administration:values.filter((p)=>p.includes('site')||p.includes('billing')||p.includes('team'))};},[data]);
 async function invite(){setBusy(true);setError('');setMessage('');try{const result=await apiRequest<{inviteUrl:string;emailSent:boolean}>('/team/invitations',{method:'POST',body:JSON.stringify({email,role,permissions:invitePermissions})});setMessage(result.emailSent?'✓ Invitation envoyée par e-mail.':`Invitation créée. E-mail serveur non configuré : ${result.inviteUrl}`);setEmail('');setInvitePermissions({});await load();}catch(e){setError(e instanceof Error?e.message:'Invitation impossible');}finally{setBusy(false);}}
 async function saveMember(member:Member,patch:Partial<Member>){setError('');setMessage('Enregistrement…');try{await apiRequest(`/team/members/${member.id}`,{method:'PATCH',body:JSON.stringify({role:patch.role??member.role,isActive:patch.isActive??member.isActive,permissions:patch.permissionOverrides??member.permissionOverrides??{}})});await load();setMessage('✓ Autorisations mises à jour.');}catch(e){setError(e instanceof Error?e.message:'Modification impossible');}}
 function updateLocal(memberId:string,patch:Partial<Member>){setData((current)=>current?{...current,members:current.members.map((member)=>member.id===memberId?{...member,...patch}:member)}:current);}
 if(!data)return <PortalShell><div className="portal-error-state"><div className="eyebrow">ÉQUIPE & SÉCURITÉ</div><h2>Chargement de l’équipe</h2><p>{error||'Chargement…'}</p>{error?<button className="button secondary" type="button" onClick={()=>void load()}>Réessayer</button>:null}</div></PortalShell>;
 return <PortalShell>
   <div className="page-header"><div><div className="eyebrow">ÉQUIPE & SÉCURITÉ</div><h1>Membres et autorisations</h1><p className="muted">Invitez un collaborateur, choisissez son rôle et contrôlez précisément les accès dont il a besoin.</p></div></div>
   {error?<div className="portal-error-state" style={{marginBottom:16}}><strong>Une action n’a pas abouti.</strong><p>{error}</p></div>:null}
   {message?<p className="success" style={{fontWeight:800}}>{message}</p>:null}

   <section className="card team-invite-card">
     <div className="portal-section-title"><div className="eyebrow">NOUVEL ACCÈS</div><h2>Inviter un membre</h2><p>Préparez un accès clair et sécurisé. Les droits pourront être modifiés plus tard.</p></div>
     <div className="grid two">
       <label>E-mail professionnel<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="membre@entreprise.ch"/></label>
       <label>Rôle de départ<select value={role} onChange={(e)=>setRole(e.target.value)}>{ROLES.map((item)=><option key={item}>{item}</option>)}</select></label>
     </div>
     <div className="team-permission-groups">{Object.entries(grouped).map(([group,permissions])=>{
       const meta=GROUP_META[group]||{icon:'•',description:''};
       return <section className="team-permission-group" key={group}>
         <div className="team-permission-group-title"><div>{group}</div><span>{meta.icon}</span></div>
         <div className="muted" style={{fontSize:12,lineHeight:1.45}}>{meta.description}</div>
         <div style={{display:'grid',gap:8}}>{permissions.map((permission)=><label className="team-permission-option" key={permission}><span><span style={{display:'block'}}>{LABELS[permission]||permission}</span><small style={{display:'block',marginTop:3,color:'#8f9bab',fontWeight:600,lineHeight:1.35}}>{DESCRIPTIONS[permission]||'Autorisation KHE Booth.'}</small></span><input type="checkbox" checked={Boolean(invitePermissions[permission])} onChange={(e)=>setInvitePermissions({...invitePermissions,[permission]:e.target.checked})}/></label>)}</div>
       </section>;
     })}</div>
     <button className="button" style={{width:'100%'}} disabled={busy||!email} onClick={()=>void invite()}>{busy?'Création de l’accès…':'Envoyer l’invitation'}</button>
   </section>

   <div style={{height:18}}/>
   <div className="portal-section-title"><div className="eyebrow">MEMBRES ACTIFS</div><h2>Accès de l’équipe</h2><p>Chaque membre dispose de son rôle et de ses autorisations propres.</p></div>
   <div className="team-member-grid">{data.members.map((member)=>{
     const overrides=member.permissionOverrides||{};const displayName=[member.firstName,member.lastName].filter(Boolean).join(' ')||member.email;
     return <section className="card team-member-card" key={member.id}>
       <div className="team-member-head"><div><div className="team-member-name">{displayName}</div><div className="team-member-email">{member.email}</div></div><span className={`team-status ${member.isActive?'active':'inactive'}`}>{member.isActive?'● ACTIF':'● DÉSACTIVÉ'}</span></div>
       <label className="team-role-box"><span>Rôle</span><select disabled={member.role==='OWNER'} value={member.role} onChange={(e)=>updateLocal(member.id,{role:e.target.value})}><option>OWNER</option><option>ADMIN</option><option>OPERATOR</option><option>SHARE_HOST</option></select></label>
       <div><div className="eyebrow" style={{marginBottom:9}}>AUTORISATIONS</div><div className="team-member-permissions">{data.availablePermissions.map((permission)=><label key={permission} className={`team-member-permission ${member.role==='OWNER'?'disabled':''}`}><span><span style={{display:'block'}}>{LABELS[permission]||permission}</span><small style={{display:'block',marginTop:3,color:'#8f9bab',fontWeight:600}}>{DESCRIPTIONS[permission]||'Autorisation KHE Booth.'}</small></span><input type="checkbox" disabled={member.role==='OWNER'} checked={member.role==='OWNER'?true:Boolean(member.permissions[permission])} onChange={(e)=>{const next={...overrides,[permission]:e.target.checked};updateLocal(member.id,{permissionOverrides:next,permissions:{...member.permissions,[permission]:e.target.checked}});}}/></label>)}</div></div>
       {member.role==='OWNER'?<div style={{padding:'12px 13px',border:'1px solid rgba(214,175,82,.3)',borderRadius:12,background:'rgba(214,175,82,.07)',color:'#e8d28d',fontSize:12,lineHeight:1.45}}>Le compte OWNER conserve automatiquement tous les droits.</div>:null}
       <div className="team-member-actions">{member.role!=='OWNER'?<button className="button" onClick={()=>void saveMember(member,{})}>Enregistrer les droits</button>:null}{member.role!=='OWNER'?<button className="button secondary" onClick={()=>void saveMember(member,{isActive:!member.isActive})}>{member.isActive?'Désactiver ce membre':'Réactiver ce membre'}</button>:null}</div>
     </section>;
   })}</div>

   {data.invitations.length?<><div style={{height:20}}/><section className="card"><div className="portal-section-title"><div className="eyebrow">EN ATTENTE</div><h2>Invitations en attente</h2><p>Les invitations non encore acceptées restent révocables.</p></div>{data.invitations.map((invitation)=><div className="team-invitation-row" key={invitation.id}><div><strong style={{color:'#fff',overflowWrap:'anywhere'}}>{invitation.email}</strong><div className="muted" style={{fontSize:12,marginTop:4}}>{invitation.role} · expire le {new Date(invitation.expiresAt).toLocaleDateString('fr-CH')}</div></div><button className="button secondary" onClick={()=>void apiRequest(`/team/invitations/${invitation.id}`,{method:'DELETE'}).then(load)}>Révoquer</button></div>)}</section></>:null}
 </PortalShell>;
}
