'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';

function ForgotPasswordContent(){
  const params=useSearchParams();
  const[email,setEmail]=useState('');
  const[message,setMessage]=useState('');
  const[busy,setBusy]=useState(false);
  useEffect(()=>{const initial=params.get('email');if(initial)setEmail(initial);},[params]);
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setMessage('');try{const result=await apiRequest<{message?:string}>('/auth/password-reset/request',{method:'POST',body:JSON.stringify({email})});setMessage(result.message||'Si ce compte existe, un e-mail sécurisé a été envoyé.');}catch{setMessage('Si ce compte existe, un e-mail sécurisé a été envoyé.');}finally{setBusy(false);}}
  return <main className="login"><section className="login-card"><div className="brand">KHE <span>Booth</span></div><div className="eyebrow" style={{marginTop:22}}>SÉCURITÉ DU COMPTE</div><h1>Mot de passe oublié</h1><p className="muted">Entrez l’adresse e-mail liée à votre accès KHE BOOTH. Le lien envoyé expire après 30 minutes et ne fonctionne qu’une fois.</p><form className="form" onSubmit={submit}><div className="field"><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></div><button className="button" disabled={busy}>{busy?'Envoi…':'Envoyer le lien sécurisé'}</button></form>{message?<div className="success" style={{marginTop:14}}>{message}</div>:null}<Link href="/login" className="button secondary" style={{display:'block',textAlign:'center',marginTop:14}}>Retour à la connexion</Link></section></main>;
}

export default function ForgotPasswordPage(){
  return <Suspense fallback={<main className="login"><section className="login-card"><div className="brand">KHE <span>Booth</span></div><p className="muted">Chargement…</p></section></main>}><ForgotPasswordContent/></Suspense>;
}
