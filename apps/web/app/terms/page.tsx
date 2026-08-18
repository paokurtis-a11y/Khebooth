'use client';

import { useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type Terms={revision:string;title:string;sections:Array<{title:string;body:string}>};
export default function TermsPage(){const[terms,setTerms]=useState<Terms|null>(null);const[error,setError]=useState('');useEffect(()=>{apiRequest<Terms>('/auth/terms').then(setTerms).catch((e)=>setError(e instanceof Error?e.message:'Conditions indisponibles'));},[]);return <PortalShell><div className="page-header"><div><div className="eyebrow">LÉGAL</div><h1>Conditions d’utilisation</h1><p className="muted">Révision {terms?.revision||'…'}</p></div></div>{error?<p className="error">{error}</p>:null}<section className="card" style={{maxWidth:900,display:'grid',gap:18}}><h2 style={{margin:0}}>{terms?.title||'Chargement…'}</h2>{terms?.sections.map((section)=><article key={section.title} style={{borderTop:'1px solid #e8dfd1',paddingTop:14}}><strong>{section.title}</strong><p style={{lineHeight:1.65,marginBottom:0}}>{section.body}</p></article>)}</section></PortalShell>;}
