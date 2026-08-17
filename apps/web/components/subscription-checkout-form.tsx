'use client';

import { FormEvent, useEffect, useState } from 'react';

type Plan={code:string;name:string;tagline:string;priceMonthlyChf:number|null};
type Site={paymentMethods?:string[];plans:Plan[]};
const API_BASE=(process.env.NEXT_PUBLIC_API_URL||'https://khebooth-api.vercel.app/api').replace(/\/$/,'');

export function SubscriptionCheckoutForm({initialPlan}:{initialPlan?:string}){
  const [site,setSite]=useState<Site|null>(null);const [plan,setPlan]=useState(initialPlan||'PRO');const [email,setEmail]=useState('');const [name,setName]=useState('');const [paymentMethod,setPaymentMethod]=useState('card');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{fetch(`${API_BASE}/commerce/public/site`).then((r)=>r.json()).then((data:Site)=>{setSite(data);if(!data.plans.some((p)=>p.code===plan)&&data.plans[0])setPlan(data.plans[0].code);}).catch(()=>setMessage('Impossible de charger les offres pour le moment.'));},[plan]);
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setMessage('Ouverture du paiement sécurisé…');try{const response=await fetch(`${API_BASE}/commerce/public/checkout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,planCode:plan,paymentMethod})});const data=await response.json() as {checkoutUrl?:string;free?:boolean;kheCode?:string;requiresContact?:boolean;message?:string};if(!response.ok)throw new Error(data.message||'Paiement indisponible');if(data.checkoutUrl){window.location.assign(data.checkoutUrl);return;}if(data.free){setMessage(`✓ Offre activée. Votre KHE ID : ${data.kheCode||'en préparation'}`);return;}setMessage(data.message||'Nous allons vous contacter pour cette offre.');}catch(error){setMessage(error instanceof Error?error.message:'Impossible de démarrer le paiement.');}finally{setBusy(false);}}
  const methods=(site?.paymentMethods||['card','apple_pay','google_pay','twint']);
  return <form className="card" onSubmit={submit} style={{display:'grid',gap:14,maxWidth:680,margin:'0 auto'}}>
    <label>Offre<select value={plan} onChange={(e)=>setPlan(e.target.value)}>{site?.plans.map((p)=><option value={p.code} key={p.code}>{p.name}{p.priceMonthlyChf===null?' · Sur mesure':` · CHF ${(p.priceMonthlyChf/100).toFixed(2)}/mois`}</option>)}</select></label>
    <label>Nom / entreprise<input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Votre nom ou entreprise"/></label>
    <label>Adresse e-mail<input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="vous@entreprise.ch"/></label>
    <fieldset><legend>Moyen de paiement</legend>{methods.map((method)=><label key={method} style={{display:'block',margin:'8px 0'}}><input type="radio" name="payment" checked={paymentMethod===method} onChange={()=>setPaymentMethod(method)}/>{' '}{method==='card'?'Carte bancaire':method==='apple_pay'?'Apple Pay':method==='google_pay'?'Google Pay':method==='twint'?'TWINT':'Paiement sécurisé'}</label>)}</fieldset>
    <p className="muted">Le statut KHE Booth n’est activé qu’après confirmation serveur du paiement. Pour TWINT, le paiement standard couvre la période choisie ; le prélèvement TWINT récurrent nécessite l’activation marchand « User on File ».</p>
    <button className="button" disabled={busy} type="submit">{busy?'Connexion au paiement…':'Continuer vers le paiement sécurisé'}</button>
    {message?<p>{message}</p>:null}
  </form>;
}
