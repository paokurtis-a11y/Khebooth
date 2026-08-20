'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest, setSessionUser } from '@/lib/api';

type Profile = {
  id: string;
  organizationId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  username?: string | null;
  phone?: string | null;
  role: string;
  avatarUrl?: string | null;
  permissions?: Record<string, boolean>;
};
type UploadTicket={uploadUrl:string;contentType:string;byteSize:number};
const PERMISSION_LABELS:Record<string,string>={
  'dashboard.view':'Voir Dashboard','clients.view':'Voir clients','clients.manage':'Modifier clients','clients.delete':'Supprimer clients','events.view':'Voir événements','events.manage':'Créer / modifier événements','events.delete':'Supprimer événements','studio.view':'Voir Studio / Presets','studio.manage':'Modifier Studio / Presets','studio.delete':'Supprimer Presets','marketing.view':'Voir Marketing','marketing.manage':'Gérer Marketing','communications.manage':'Communications clients','site.manage':'Configurer le site','billing.manage':'Gérer facturation','team.manage':'Gérer équipe','reports.export':'Exporter rapports'
};

export default function ProfilePage() {
  const [profile,setProfile]=useState<Profile|null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy,setPhotoBusy]=useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef=useRef<HTMLInputElement|null>(null);

  const load=()=>apiRequest<Profile>('/auth/me').then((value)=>{setProfile(value);setFirstName(value.firstName??'');setLastName(value.lastName??'');setEmail(value.email);setPhone(value.phone??'');setRole(value.role);setSessionUser(value);});
  useEffect(() => { void load().catch((caught)=>setError(caught instanceof Error?caught.message:'Profil indisponible')); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setMessage('');
    try {
      const value = await apiRequest<Profile>('/auth/profile', {method:'PATCH',body:JSON.stringify({firstName:firstName.trim(),lastName:lastName.trim(),email:email.trim(),phone:phone.trim()})});
      setProfile(value);setSessionUser(value);setMessage('✓ Profil enregistré et synchronisé.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement impossible'); }
    finally { setBusy(false); }
  }

  async function uploadPhoto(file:File){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Utilisez une image JPEG, PNG ou WebP.');return;}
    if(file.size>5*1024*1024){setError('La photo doit faire moins de 5 Mo.');return;}
    setPhotoBusy(true);setError('');setMessage('Envoi de la photo…');
    try{
      const ticket=await apiRequest<UploadTicket>('/auth/profile/photo-upload',{method:'POST',body:JSON.stringify({contentType:file.type,byteSize:file.size})});
      const response=await fetch(ticket.uploadUrl,{method:'PUT',headers:{'Content-Type':ticket.contentType},body:file});
      if(!response.ok)throw new Error(`Upload photo HTTP ${response.status}`);
      const result=await apiRequest<{avatarUrl:string|null}>('/auth/profile/photo-finalize',{method:'POST'});
      setProfile((current)=>current?{...current,avatarUrl:result.avatarUrl}:current);setMessage('✓ Photo de profil mise à jour.');
    }catch(caught){setError(caught instanceof Error?caught.message:'Impossible de mettre à jour la photo.');setMessage('');}
    finally{setPhotoBusy(false);if(fileRef.current)fileRef.current.value='';}
  }

  const allowedPermissions=Object.entries(profile?.permissions||{}).filter(([,allowed])=>allowed).map(([permission])=>permission);
  return <PortalShell>
    <div className="header"><div><div className="eyebrow">KHE IDENTITY</div><h1>Profil</h1><p>Votre identité KHE Booth et vos informations de contact.</p></div></div>
    {error ? <div className="portal-error-state" style={{marginBottom:16}}><strong>Profil indisponible</strong><p>{error}</p></div> : null}{message ? <p className="success">{message}</p> : null}
    <div className="grid two" style={{alignItems:'start'}}>
      <section className="card">
        <div style={{display:'flex',gap:18,alignItems:'center',marginBottom:20,flexWrap:'wrap'}}>
          <div style={{width:96,height:96,borderRadius:48,overflow:'hidden',background:'#181818',border:'3px solid #d2ad4f',display:'grid',placeItems:'center',color:'#fff',fontSize:30,fontWeight:900,boxShadow:'0 0 0 5px rgba(214,175,82,.08)'}}>{profile?.avatarUrl?<img src={profile.avatarUrl} alt="Photo de profil" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{(firstName[0]||'K').toUpperCase()}{(lastName[0]||'').toUpperCase()}</span>}</div>
          <div style={{flex:'1 1 220px'}}><h2 style={{margin:'0 0 5px'}}>{[firstName,lastName].filter(Boolean).join(' ')||'Votre profil KHE'}</h2><div className="muted">{profile?.username?`@${profile.username} · `:''}{role}</div><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event)=>{const file=event.target.files?.[0];if(file)void uploadPhoto(file);}}/><button type="button" className="button secondary" style={{marginTop:10}} disabled={photoBusy} onClick={()=>fileRef.current?.click()}>{photoBusy?'Envoi…':'Changer la photo'}</button></div>
        </div>
        <form className="form" onSubmit={save}>
          <div className="grid two"><div className="field"><label htmlFor="lastName">Nom *</label><input id="lastName" required maxLength={120} value={lastName} onChange={(e)=>setLastName(e.target.value)}/></div><div className="field"><label htmlFor="firstName">Prénom *</label><input id="firstName" required maxLength={120} value={firstName} onChange={(e)=>setFirstName(e.target.value)}/></div></div>
          <div className="field"><label htmlFor="email">Adresse e-mail *</label><input id="email" type="email" required maxLength={320} value={email} onChange={(e)=>setEmail(e.target.value)}/><small className="muted">Une adresse e-mail déjà utilisée pour un accès KHE BOOTH ne peut pas être attribuée à un autre compte.</small></div>
          <div className="field"><label htmlFor="username">Nom d’utilisateur KHE</label><input id="username" value={profile?.username?`@${profile.username}`:'À créer lors de l’activation de votre accès'} readOnly/><small className="muted">Identifiant unique de connexion. Deux comptes ne peuvent jamais utiliser le même nom d’utilisateur.</small></div>
          <div className="field"><label htmlFor="phone">Numéro de téléphone</label><input id="phone" type="tel" maxLength={40} placeholder="+41 79 000 00 00" value={phone} onChange={(e)=>setPhone(e.target.value)}/></div>
          <div className="field"><label>Rôle</label><input value={role} readOnly/></div>
          <p className="muted" style={{fontSize:13}}>* Champs obligatoires. Photo privée stockée dans l’espace KHE.</p>
          <button className="button" disabled={busy}>{busy?'Enregistrement…':'Enregistrer le profil'}</button>
        </form>
      </section>
      <section className="card"><div className="eyebrow">ACCÈS & ÉQUIPE</div><h2 style={{marginBottom:8}}>Vos autorisations</h2><p className="muted" style={{marginTop:0}}>Votre rôle définit un plafond de droits. Les autorisations individuelles peuvent être ajustées par un Owner/Admin.</p>{allowedPermissions.length?<div className="profile-permission-grid">{allowedPermissions.map((permission)=><div className="profile-permission-pill" key={permission}>{PERMISSION_LABELS[permission]||permission}</div>)}</div>:<div style={{padding:'14px',borderRadius:12,border:'1px solid #303a47',background:'#111820',color:'#aeb8c5'}}>Aucune autorisation supplémentaire n’est active.</div>}{['OWNER','ADMIN'].includes(role)?<Link className="button secondary" href="/team" style={{marginTop:18,width:'100%',textAlign:'center'}}>Gérer l’équipe et les permissions</Link>:null}</section>
    </div>
  </PortalShell>;
}
