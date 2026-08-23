'use client';

import { useEffect } from 'react';

const MODE_KEY='khe.portal.mode';
const MODES=new Set(['SIMPLE','PRO','ADMIN']);
const SIMPLE_GROUPS=new Set(['home','events','support','settings','compliance']);
const PRO_GROUPS=new Set(['home','clients','events','support','agent','marketing','settings','compliance']);
const LABELS={
  fr:{experience:'Expérience',security:'Sécurité du compte'},
  en:{experience:'Experience',security:'Account security'},
  de:{experience:'Erlebnis',security:'Kontosicherheit'},
  it:{experience:'Esperienza',security:'Sicurezza account'},
  es:{experience:'Experiencia',security:'Seguridad de la cuenta'},
  pt:{experience:'Experiência',security:'Segurança da conta'},
} as const;
type Language=keyof typeof LABELS;

function language():Language{
  const value=window.localStorage.getItem('khe.web.language');
  return value&&value in LABELS?value as Language:'fr';
}

function groupId(section:Element){
  const control=section.querySelector<HTMLButtonElement>('.portal-nav-trigger[aria-controls^="nav-"]')?.getAttribute('aria-controls');
  return control?.startsWith('nav-')?control.slice(4):null;
}

function ensureSettingsLinks(){
  const settingsTrigger=document.querySelector<HTMLButtonElement>('.portal-nav-trigger[aria-controls="nav-settings"]');
  const section=settingsTrigger?.closest('.portal-nav-group');
  const inner=section?.querySelector<HTMLElement>('.portal-nav-submenu-inner');
  if(!inner)return;
  const labels=LABELS[language()];
  const links:[string,string][]=[['/settings/experience',labels.experience],['/settings/security',labels.security]];
  for(const[href,label]of links){
    let anchor=inner.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
    if(!anchor){
      anchor=document.createElement('a');
      anchor.href=href;
      anchor.dataset.kheExperienceLink='true';
      const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='→';
      const text=document.createElement('span');text.textContent=label;
      anchor.append(arrow,text);
      inner.append(anchor);
    }else{
      const text=anchor.querySelectorAll('span')[1];if(text)text.textContent=label;
    }
  }
}

function applyMode(value?:string|null){
  const mode=value&&MODES.has(value)?value:'PRO';
  document.body.dataset.kheNavigationMode=mode;
  const allowed=mode==='SIMPLE'?SIMPLE_GROUPS:mode==='PRO'?PRO_GROUPS:null;
  document.querySelectorAll<HTMLElement>('.portal-nav-group').forEach(section=>{
    const id=groupId(section);
    section.hidden=Boolean(id&&allowed&&!allowed.has(id));
  });
  ensureSettingsLinks();
}

export function PortalExperienceBootstrap(){
  useEffect(()=>{
    let frame=0;
    const schedule=(value?:string|null)=>{
      window.cancelAnimationFrame(frame);
      frame=window.requestAnimationFrame(()=>applyMode(value??window.localStorage.getItem(MODE_KEY)));
    };
    schedule();
    const modeHandler=(event:Event)=>schedule((event as CustomEvent<string>).detail);
    const languageHandler=()=>schedule();
    window.addEventListener('khe-navigation-mode-changed',modeHandler);
    window.addEventListener('khe-language-changed',languageHandler);
    const observer=new MutationObserver(()=>schedule());
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>{
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('khe-navigation-mode-changed',modeHandler);
      window.removeEventListener('khe-language-changed',languageHandler);
    };
  },[]);
  return null;
}
