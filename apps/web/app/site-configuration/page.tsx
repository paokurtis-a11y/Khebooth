'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest } from '@/lib/api';

type Plan = { code:string; name:string; tagline:string; priceMonthlyChf:number|null; features:string[]; active:boolean; highlighted:boolean; stripePriceId?:string|null; sortOrder:number };
type Config = { heroTitle:string; heroSubtitle:string; primaryCta:string; appDownloadUrl?:string|null; supportEmail?:string|null; latestVersion:string; releaseNotes:string; maintenanceActive:boolean; maintenanceMessage?:string|null; paymentMethods:string[]; faq:unknown[]; plans:Plan[] };

export default function SiteConfigurationPage() {
  const [config,setConfig]=useState<Config|null>(null);
  const [message,setMessage]=useState('');
  const load=useCallback(()=>apiRequest<Config>('/commerce/admin/site').then(setConfig).catch((e)=>setMessage(e instanceof Error?e.message:'Erreur de chargement')),[]);
  useEffect(()=>{ void load(); },[load]);

  async function saveSite(event:FormEvent){ event.preventDefault(); if(!config)return; setMessage('Enregistrement…'); try{ const updated=await apiRequest<Config>('/commerce/admin/site',{method:'PATCH',body:JSON.stringify(config)}); setConfig(updated); setMessage('✓ Site marketing synchronisé.'); }catch(e){setMessage(e instanceof Error?e.message:'Erreur');}}
  async function savePlan(plan:Plan){ setMessage(`Mise à jour de ${plan.name}…`); try{ const updated=await apiRequest<Config>(`/commerce/admin/plans/${plan.code}`,{method:'PATCH',body:JSON.stringify(plan)}); setConfig(updated); setMessage(`✓ Offre ${plan.name} synchronisée sur le site et la plateforme.`);}catch(e){setMessage(e instanceof Error?e.message:'Erreur');}}
  function patchPlan(code:string, patch:Partial<Plan>){ setConfig((current)=>current?{...current,plans:current.plans.map((p)=>p.code===code?{...p,...patch}:p)}:current); }
  if(!config)return <PortalShell><h1>Configuration du site web</h1><p>{message||'Chargement…'}</p></PortalShell>;

  return <PortalShell>
    <div className="page-header"><div><div className="eyebrow">MARKETING & COMMERCE</div><h1>Configuration du site web</h1><p className="muted">Modifiez le site public, les tarifs, le téléchargement de l’application, les moyens de paiement et les informations de service. Les changements proviennent de la même API que KHE Booth.</p></div></div>

    <form className="card" onSubmit={saveSite} style={{display:'grid',gap:14}}>
      <h2>Contenu principal</h2>
      <label>Titre principal<input value={config.heroTitle} onChange={(e)=>setConfig({...config,heroTitle:e.target.value})}/></label>
      <label>Sous-titre<textarea value={config.heroSubtitle} onChange={(e)=>setConfig({...config,heroSubtitle:e.target.value})}/></label>
      <label>Bouton principal<input value={config.primaryCta} onChange={(e)=>setConfig({...config,primaryCta:e.target.value})}/></label>
      <label>Lien de téléchargement de l’application<input placeholder="https://…apk" value={config.appDownloadUrl||''} onChange={(e)=>setConfig({...config,appDownloadUrl:e.target.value})}/></label>
      <label>E-mail commercial/support<input type="email" value={config.supportEmail||''} onChange={(e)=>setConfig({...config,supportEmail:e.target.value})}/></label>
      <div className="grid two"><label>Version publiée<input value={config.latestVersion} onChange={(e)=>setConfig({...config,latestVersion:e.target.value})}/></label><label>Maintenance active<select value={config.maintenanceActive?'yes':'no'} onChange={(e)=>setConfig({...config,maintenanceActive:e.target.value==='yes'})}><option value="no">Non</option><option value="yes">Oui</option></select></label></div>
      <label>Notes de mise à jour<textarea value={config.releaseNotes} onChange={(e)=>setConfig({...config,releaseNotes:e.target.value})}/></label>
      <label>Message de maintenance<textarea value={config.maintenanceMessage||''} onChange={(e)=>setConfig({...config,maintenanceMessage:e.target.value})}/></label>
      <fieldset><legend>Moyens de paiement visibles</legend>{['card','apple_pay','google_pay','twint'].map((method)=><label key={method} style={{marginRight:18}}><input type="checkbox" checked={config.paymentMethods.includes(method)} onChange={(e)=>setConfig({...config,paymentMethods:e.target.checked?[...config.paymentMethods,method]:config.paymentMethods.filter((x)=>x!==method)})}/>{' '}{method==='card'?'Carte':method==='apple_pay'?'Apple Pay':method==='google_pay'?'Google Pay':'TWINT'}</label>)}</fieldset>
      <button className="button" type="submit">Enregistrer et synchroniser le site</button>
    </form>

    <div style={{height:18}}/>
    <div className="page-header"><div><div className="eyebrow">ABONNEMENTS</div><h2>Tarifs synchronisés</h2><p className="muted">Les montants sont saisis en centimes CHF : 5900 = CHF 59.00. Une valeur vide signifie « sur mesure ».</p></div></div>
    <div className="grid two">
      {config.plans.map((plan)=><section className="card" key={plan.code} style={{display:'grid',gap:10}}>
        <div><strong>{plan.code}</strong>{plan.highlighted?' · Mis en avant':''}</div>
        <label>Nom<input value={plan.name} onChange={(e)=>patchPlan(plan.code,{name:e.target.value})}/></label>
        <label>Accroche<input value={plan.tagline} onChange={(e)=>patchPlan(plan.code,{tagline:e.target.value})}/></label>
        <label>Prix mensuel (centimes CHF)<input type="number" min="0" value={plan.priceMonthlyChf??''} onChange={(e)=>patchPlan(plan.code,{priceMonthlyChf:e.target.value===''?null:Number(e.target.value)})}/></label>
        <label>Avantages (1 par ligne)<textarea value={plan.features.join('\n')} onChange={(e)=>patchPlan(plan.code,{features:e.target.value.split('\n').filter(Boolean)})}/></label>
        <div><label><input type="checkbox" checked={plan.active} onChange={(e)=>patchPlan(plan.code,{active:e.target.checked})}/> Offre active</label>{' · '}<label><input type="checkbox" checked={plan.highlighted} onChange={(e)=>patchPlan(plan.code,{highlighted:e.target.checked})}/> Mettre en avant</label></div>
        <button className="button secondary" type="button" onClick={()=>void savePlan(plan)}>Synchroniser cette offre</button>
      </section>)}
    </div>
    {message?<p className="card" style={{marginTop:16}}>{message}</p>:null}
  </PortalShell>;
}
