'use client';

import { useEffect } from 'react';

const MODE_KEY='khe.portal.mode';
const MODES=new Set(['SIMPLE','PRO','ADMIN']);

export function PortalExperienceBootstrap(){
  useEffect(()=>{
    const apply=(value?:string|null)=>{const mode=value&&MODES.has(value)?value:'PRO';document.body.dataset.kheNavigationMode=mode;};
    apply(window.localStorage.getItem(MODE_KEY));
    const handler=(event:Event)=>apply((event as CustomEvent<string>).detail);
    window.addEventListener('khe-navigation-mode-changed',handler);
    return()=>window.removeEventListener('khe-navigation-mode-changed',handler);
  },[]);
  return null;
}
