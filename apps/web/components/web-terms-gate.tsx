'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Terms={revision:string;title:string;sections:Array<{title:string;body:string}>};

export function WebTermsGate({onAccepted}:{onAccepted:()=>void}){
 const[terms,setTerms]=useState<Terms|null>(null);const[checked,setChecked]=useState(false);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
 useEffect(()=>{apiRequest<Terms>('/auth/terms').then(setTerms).catch((e)=>setError(e instanceof Error?e.message:'Conditions indisponibles'));},[]);
 async function accept(){setBusy(true);setError('');try{await apiRequest('/auth/terms/accept',{method:'POST'});onAccepted();}catch(e){setError(e instanceof Error?e.message:'Acceptation impossible');}finally{setBusy(false);}}
 return <main className="login" style={{alignItems:'flex-start',paddingTop:32}}><section className="login-card" style={{maxWidth:900,width:'100%'}}><div className="brand">KHE <span>BOOTH</span></div><div className="eyebrow" style={{marginTop:18}}>UTILISATION DE LA PLATEFORME</div><h1>{terms?.title||'Conditions d’utilisation'}</h1><p className="muted">Révision {terms?.revision||'…'}. Une nouvelle acceptation peut être demandée lorsqu’une révision importante est publiée.</p>{error?<p className="error">{error}</p>:null}<div style={{maxHeight:'52vh',overflow:'auto',display:'grid',gap:14,padding:'14px 2px'}}>{terms?.sections.map((section)=><article key={section.title} style={{borderTop:'1px solid #e8dfd1',paddingTop:12}}><strong>{section.title}</strong><p style={{lineHeight:1.6,marginBottom:0}}>{section.body}</p></article>)}</div><label style={{display:'flex',gap:10,alignItems:'flex-start',marginTop:18,padding:14,borderRadius:12,background:'#f7f2ea'}}><input type="checkbox" checked={checked} onChange={(e)=>setChecked(e.target.checked)}/><span>J’ai lu et j’accepte les conditions d’utilisation KHE Booth affichées ci-dessus.</span></label><button className="button" style={{marginTop:14,width:'100%'}} disabled={!checked||busy||!terms} onClick={()=>void accept()}>{busy?'Enregistrement…':'J’accepte et je continue'}</button></section></main>;
}
