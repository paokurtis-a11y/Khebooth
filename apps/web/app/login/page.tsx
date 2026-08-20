'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SecurePasswordField } from '@/components/secure-password-field';
import { apiRequest, getAccessToken, setAccessToken, setSessionUser } from '@/lib/api';

type LoginResponse={accessToken:string;user:{id:string;email:string;username?:string|null;role:string}};

export default function LoginPage(){
  const router=useRouter();const[identifier,setIdentifier]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[submitting,setSubmitting]=useState(false);
  useEffect(()=>{if(getAccessToken())router.replace('/dashboard');},[router]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');setSubmitting(true);
    try{
      const normalizedIdentifier=identifier.trim();
      const loginBody=normalizedIdentifier.includes('@')?{email:normalizedIdentifier.toLowerCase(),password}:{identifier:normalizedIdentifier.toLowerCase(),password};
      const result=await apiRequest<LoginResponse>('/auth/login',{method:'POST',body:JSON.stringify(loginBody)});
      setAccessToken(result.accessToken);setSessionUser(result.user);router.replace('/dashboard');
    }catch(caught){
      const text=caught instanceof Error?caught.message:'Connexion impossible';
      if(text.includes('PASSWORD_RESET_REQUIRED')){const email=identifier.includes('@')?identifier.trim():'';router.push(`/forgot-password${email?`?email=${encodeURIComponent(email)}`:''}`);return;}
      setError(text);
    }finally{setSubmitting(false);}
  }
  return <main className="login"><section className="login-card"><div className="brand">KHE <span>Booth</span></div><h1 style={{marginTop:24}}>Connexion</h1><p>Portail événementiel Kurtis Hypnotic Events</p><form className="form" onSubmit={submit}><div className="field"><label htmlFor="identifier">E-mail ou nom d’utilisateur</label><input id="identifier" type="text" autoComplete="username" required value={identifier} onChange={(e)=>setIdentifier(e.target.value)} placeholder="vous@entreprise.ch ou mon.identifiant"/></div><SecurePasswordField label="Mot de passe" name="password" autoComplete="current-password" required value={password} onChange={setPassword}/><div style={{display:'flex',justifyContent:'flex-end'}}><Link href={`/forgot-password${identifier.includes('@')?`?email=${encodeURIComponent(identifier.trim())}`:''}`} style={{color:'#d2ad4f',fontWeight:800,fontSize:13}}>Mot de passe oublié ?</Link></div>{error?<div className="error" role="alert">{error}</div>:null}<button className="button" type="submit" disabled={submitting}>{submitting?'Connexion…':'Se connecter'}</button></form><p className="muted" style={{fontSize:12,marginTop:16}}>Votre nom d’utilisateur est unique. Une même adresse e-mail ne peut être attribuée qu’à un seul accès KHE BOOTH.</p></section></main>;
}
