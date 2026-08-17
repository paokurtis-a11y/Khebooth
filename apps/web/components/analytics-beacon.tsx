'use client';

import { useEffect } from 'react';
const API_BASE=(process.env.NEXT_PUBLIC_API_URL||'https://khebooth-api.vercel.app/api').replace(/\/$/,'');

function id(){const key='khe.analytics.id';let value=window.localStorage.getItem(key);if(!value){value=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;window.localStorage.setItem(key,value);}return value;}

export function AnalyticsBeacon(){
  useEffect(()=>{const body=JSON.stringify({eventType:'PAGE_VIEW',anonymousId:id(),metadata:{path:window.location.pathname,referrer:document.referrer?new URL(document.referrer).hostname:null}});void fetch(`${API_BASE}/marketing/public/track`,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>undefined);},[]);
  return null;
}
