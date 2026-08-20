'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SecurePasswordField } from '@/components/secure-password-field';
import { apiRequest, getAccessToken, setAccessToken, setSessionUser } from '@/lib/api';

type LoginResponse={accessToken:string;user:{id:string;email:string;role:string}};

export default function LoginPage(){
  const router=useRouter();const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[submitting,setSubmitting]=useState(false);
  useEffect(()=>{if(getAccessToken())router.replace('/dashboard');},[router]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');setSubmitting(true);try{const result=await apiRequest<LoginResponse>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});setAccessToken(result.accessToken);setSessionUser(result.user);router.replace('/dashboard');}catch(caught){const text=caught instanceof Error?caught.message:'Connexion impossible';if(text.includes('PASSWORD_RESET_REQUIRED')){router.push(`/forgot-password?email=${encodeURIComponent(email)}`);return;}setError(text);}finally{setSubmitting(false);}}
  return <main className="login"><section className="login-card"><div className="brand">KHE <span>Booth</span></div><h1 style={{marginTop:24}}>Connexion</h1><p>Portail événementiel Kurtis Hypnotic Events</p><form className="form" onSubmit={submit}><div className="field"><label htmlFor="email">Adresse email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(e)=>setEmail(e.target.value)}/></div><SecurePasswordField label="Mot de passe" name="password" autoComplete="current-password" required value={password} onChange={setPassword}/><div style={{display:'flex',justifyContent:'flex-end'}}><Link href={`/forgot-password${email?`?email=${encodeURIComponent(email)}`:''}`} style={{color:'#d2ad4f',fontWeight:800,fontSize:13}}>Mot de passe oublié ?</Link></div>{error?<div className="error" role="alert">{error}</div>:null}<button className="button" type="submit" disabled={submitting}>{submitting?'Connexion…':'Se connecter'}</button></form><p className="muted" style={{fontSize:12,marginTop:16}}>Après plusieurs tentatives incorrectes, KHE Booth peut exiger une réinitialisation par e-mail afin de protéger le compte.</p></section></main>;
}