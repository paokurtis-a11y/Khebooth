'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SecurePasswordField } from '@/components/secure-password-field';
import { apiRequest } from '@/lib/api';

export default function ResetPasswordPage(){
  const params=useSearchParams();const token=params.get('token')||'';const[password,setPassword]=useState('');const[confirm,setConfirm]=useState('');const[message,setMessage]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[done,setDone]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setError('');if(password!==confirm){setError('Les deux mots de passe ne correspondent pas.');return;}setBusy(true);try{const result=await apiRequest<{message?:string}>('/auth/password-reset/complete',{method:'POST',body:JSON.stringify({token,password})});setDone(true);setMessage(result.message||'Mot de passe modifié.');}catch(e){setError(e instanceof Error?e.message:'Réinitialisation impossible.');}finally{setBusy(false);}}
  if(!token)return <main className="login"><section className="login-card"><div className="brand">KHE <span>Booth</span></div><h1>Lien invalide</h1><p className="muted">Demandez un nouveau lien sécurisé.</p><Link href="/forgot-password" className="button">Demander un nouveau lien</Link></section></main>;
  return <main className="login"><section className="login-card"><div className="brand">KHE <span>Booth</span></div><div className="eyebrow" style={{marginTop:22}}>RÉINITIALISATION SÉCURISÉE</div><h1>Nouveau mot de passe</h1>{done?<><div className="success">{message}</div><p className="muted">Toutes les anciennes sessions web ont été invalidées. Reconnectez-vous maintenant.</p><Link href="/login" className="button" style={{display:'block',textAlign:'center'}}>Se connecter</Link></>:<form className="form" onSubmit={submit}><p className="muted">Utilisez au moins 10 caractères avec des lettres et des chiffres.</p><SecurePasswordField label="Nouveau mot de passe" name="password" autoComplete="new-password" required value={password} onChange={setPassword}/><SecurePasswordField label="Confirmer le mot de passe" name="confirm" autoComplete="new-password" required value={confirm} onChange={setConfirm}/>{error?<div className="error">{error}</div>:null}<button className="button" disabled={busy}>{busy?'Sécurisation…':'Enregistrer le nouveau mot de passe'}</button></form>}</section></main>;
}
