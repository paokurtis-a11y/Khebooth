'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE=(process.env.NEXT_PUBLIC_API_URL||'https://khebooth-api.vercel.app/api').replace(/\/$/,'');

function UnsubscribeContent(){const params=useSearchParams();const client=params.get('client')||'';const token=params.get('token')||'';const[message,setMessage]=useState('Traitement de votre demande…');const[error,setError]=useState(false);useEffect(()=>{if(!client||!token){setError(true);setMessage('Lien de désabonnement incomplet.');return;}fetch(`${API_BASE}/marketing/email/public/unsubscribe?client=${encodeURIComponent(client)}&token=${encodeURIComponent(token)}`).then(async(response)=>{const data=await response.json() as {message?:string};if(!response.ok)throw new Error(data.message||'Lien invalide');setMessage(data.message||'Vous êtes désabonné des e-mails marketing KHE BOOTH.');}).catch((e)=>{setError(true);setMessage(e instanceof Error?e.message:'Désabonnement impossible.');});},[client,token]);return <main className="login"><section className="login-card"><div className="brand">KHE <span>Booth</span></div><div className="eyebrow" style={{marginTop:22}}>PRÉFÉRENCES E-MAIL</div><h1>{error?'Action impossible':'Désabonnement'}</h1><div className={error?'error':'success'}>{message}</div><p className="muted">Les communications transactionnelles, factures, sécurité et informations nécessaires au fonctionnement de votre compte ne sont pas concernées.</p><Link className="button secondary" href="/">Retour à KHE BOOTH</Link></section></main>;}

export default function UnsubscribePage(){return <Suspense fallback={<main className="login"><section className="login-card"><div className="brand">KHE <span>Booth</span></div><p className="muted">Chargement…</p></section></main>}><UnsubscribeContent/></Suspense>;}
