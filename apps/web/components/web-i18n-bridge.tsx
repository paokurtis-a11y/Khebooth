'use client';

import { useEffect } from 'react';
import { translateWebPhrase,type WebLanguage } from '@/lib/web-i18n';
import { useWebLanguage } from './use-web-language';

const LEGACY_ALIASES:Record<string,string>={
  'CRM & historique e-mails':'CRM & historique des e-mails',
  'Presets':'Modèles',
  'Vue opérations':'Vue d’ensemble des opérations',
  'Routing & SLA':'Routage & SLA',
  'Workforce & prévisions':'Effectifs & prévisions',
  'Marketing & Analytics':'Marketing & analyses',
  'E-mailing automatique':'E-mailing automatisé',
  'Mode d’emploi':'Guide d’utilisation',
  'Live Shift':'Shift en direct',
  'Mon SLA Rescue':'Mon renfort SLA',
  'Command Center':'Centre de commande',
  'Live Shift équipe':'Shift équipe en direct',
  'Brief équipe':'Brief d’équipe',
  'Relais équipe':'Relais d’équipe',
  'SLA Rescue équipe':'Renfort SLA de l’équipe',
  'Équipe Workforce':'Équipe & effectifs',
  'Optimisation planning':'Optimisation du planning',
  'Live équipe':'Équipe en direct',
  'Rescue équipe':'Renfort d’équipe',
  'Routing':'Routage',
  'Aucune auto-assignation':'Aucune affectation automatique',
  'Pause':'En pause',
  'La langue est appliquée immédiatement aux zones traduites de KHE Booth.':'La langue choisie s’applique à toute l’interface KHE Booth.',
};

const SKIP_TAGS=new Set(['SCRIPT','STYLE','CODE','PRE','KBD','SAMP']);
const textState=new WeakMap<Text,{source:string;last:string}>();
const attributeState=new WeakMap<Element,Map<string,{source:string;last:string}>>();

function translateValue(value:string,language:WebLanguage){
  const leading=value.match(/^\s*/)?.[0]??'';
  const trailing=value.match(/\s*$/)?.[0]??'';
  const trimmed=value.trim().replace(/\s+/g,' ');
  if(!trimmed)return value;
  const canonical=LEGACY_ALIASES[trimmed]??trimmed;
  const translated=translateWebPhrase(canonical,language);
  if(translated===canonical&&canonical===trimmed)return value;
  return `${leading}${translated}${trailing}`;
}

function shouldSkip(element:Element|null){
  if(!element)return false;
  if(SKIP_TAGS.has(element.tagName))return true;
  if(element.closest('[data-khe-i18n-ignore="true"]'))return true;
  if(element instanceof HTMLElement&&element.isContentEditable)return true;
  return false;
}

function translateTextNode(node:Text,language:WebLanguage){
  if(shouldSkip(node.parentElement))return;
  const current=node.data;
  const previous=textState.get(node);
  const source=previous&&current===previous.last?previous.source:current;
  const next=translateValue(source,language);
  textState.set(node,{source,last:next});
  if(current!==next)node.data=next;
}

function translateAttribute(element:Element,name:string,language:WebLanguage){
  if(shouldSkip(element))return;
  const current=element.getAttribute(name);
  if(!current)return;
  let map=attributeState.get(element);
  if(!map){map=new Map();attributeState.set(element,map);}
  const previous=map.get(name);
  const source=previous&&current===previous.last?previous.source:current;
  const next=translateValue(source,language);
  map.set(name,{source,last:next});
  if(current!==next)element.setAttribute(name,next);
}

function translateTree(root:Node,language:WebLanguage){
  if(root.nodeType===Node.TEXT_NODE){translateTextNode(root as Text,language);return;}
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  if(root instanceof Element){
    if(shouldSkip(root))return;
    for(const name of ['placeholder','title','aria-label'])translateAttribute(root,name,language);
  }
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  let node=walker.nextNode();
  while(node){
    if(node.nodeType===Node.TEXT_NODE)translateTextNode(node as Text,language);
    else if(node instanceof Element){
      if(!shouldSkip(node))for(const name of ['placeholder','title','aria-label'])translateAttribute(node,name,language);
    }
    node=walker.nextNode();
  }
}

export function WebI18nBridge(){
  const{language}=useWebLanguage();
  useEffect(()=>{
    document.documentElement.lang=language;
    let frame=0;
    const apply=()=>{frame=0;if(document.body)translateTree(document.body,language);};
    const schedule=()=>{if(frame)return;frame=window.requestAnimationFrame(apply);};
    apply();
    const observer=new MutationObserver(schedule);
    if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
    return()=>{observer.disconnect();if(frame)window.cancelAnimationFrame(frame);};
  },[language]);
  return null;
}
