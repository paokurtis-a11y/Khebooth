'use client';

import { useEffect, useRef, useState } from 'react';
const API_BASE=(process.env.NEXT_PUBLIC_API_URL||'https://khebooth-api.vercel.app/api').replace(/\/$/,'');
const CONSENT_KEY='khe.analytics.consent';const ID_KEY='khe.analytics.id';const SESSION_KEY='khe.analytics.session';
type Consent='accepted'|'declined'|null;
function anonymousId(){let value=window.localStorage.getItem(ID_KEY);if(!value){value=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;window.localStorage.setItem(ID_KEY,value);}return value;}
function sessionId(){let value=window.sessionStorage.getItem(SESSION_KEY);if(!value){value=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;window.sessionStorage.setItem(SESSION_KEY,value);}return value;}
function referrer(){if(!document.referrer)return null;try{return new URL(document.referrer).hostname;}catch{return null;}}

export function AnalyticsBeacon(){
  const[consent,setConsent]=useState<Consent>(null);const startedAt=useRef(Date.now());const started=useRef(false);
  useEffect(()=>{if(navigator.doNotTrack==='1'){setConsent('declined');return;}const saved=window.localStorage.getItem(CONSENT_KEY);setConsent(saved==='accepted'||saved==='declined'?saved:null);},[]);

  useEffect(()=>{
    if(consent!=='accepted')return;
    const aid=anonymousId(),sid=sessionId();
    const send=(eventType:string,metadata:Record<string,unknown>={},extra:Record<string,unknown>={})=>{void fetch(`${API_BASE}/operations/public/track`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventType,anonymousId:aid,sessionId:sid,consent:true,metadata,...extra}),keepalive:true}).catch(()=>undefined);};
    if(!started.current){started.current=true;startedAt.current=Date.now();send('SESSION_STARTED',{path:window.location.pathname,referrer:referrer()});send('PAGE_VIEW',{path:window.location.pathname,referrer:referrer()});}
    const click=(event:MouseEvent)=>{const target=event.target instanceof Element?event.target.closest('a,button'):null;if(!target)return;const label=(target.textContent||'').trim().replace(/\s+/g,' ').slice(0,120);const href=target instanceof HTMLAnchorElement?target.href:'';if(href.includes('/subscribe?plan=')){let planCode:null|string=null;try{planCode=new URL(href).searchParams.get('plan');}catch{}send('PLAN_SELECTED',{path:window.location.pathname,label,href:new URL(href).pathname},{planCode});return;}if(href.includes('expo.dev')){send('APP_DOWNLOAD',{path:window.location.pathname,label});return;}send('CTA_CLICKED',{path:window.location.pathname,label,href:href?(()=>{try{return new URL(href).pathname;}catch{return'';}})():''});};
    document.addEventListener('click',click);
    const timer=window.setInterval(()=>send('SESSION_HEARTBEAT',{path:window.location.pathname,durationSeconds:Math.round((Date.now()-startedAt.current)/1000)}),30000);
    const end=()=>send('SESSION_ENDED',{path:window.location.pathname,durationSeconds:Math.round((Date.now()-startedAt.current)/1000)});
    window.addEventListener('pagehide',end);
    return()=>{document.removeEventListener('click',click);window.clearInterval(timer);window.removeEventListener('pagehide',end);};
  },[consent]);

  const choose=(value:Exclude<Consent,null>)=>{window.localStorage.setItem(CONSENT_KEY,value);if(value==='declined'){window.localStorage.removeItem(ID_KEY);window.sessionStorage.removeItem(SESSION_KEY);}setConsent(value);};
  if(consent!==null)return null;
  return <div role="dialog" aria-label="Préférences de mesure d’audience" style={{position:'fixed',left:16,right:16,bottom:16,zIndex:1500,maxWidth:760,margin:'0 auto',background:'#10151c',border:'1px solid rgba(210,173,79,.55)',borderRadius:16,padding:16,boxShadow:'0 18px 60px rgba(0,0,0,.55)'}}><strong>Mesure d’audience KHE Booth</strong><p style={{margin:'8px 0',fontSize:13,lineHeight:1.5}}>Avec votre accord, KHE analyse de façon pseudonymisée le parcours sur ce site et votre zone approximative (pays, région, commune) afin d’améliorer les offres et le parcours commercial. Aucun GPS précis n’est demandé.</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="marketing-cta" onClick={()=>choose('accepted')}>Accepter la mesure</button><button className="marketing-ghost" onClick={()=>choose('declined')}>Continuer sans mesure détaillée</button></div></div>;
}
