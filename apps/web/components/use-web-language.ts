'use client';

import { useCallback,useEffect,useState } from 'react';
import { WEB_LANGUAGE_EVENT,WEB_LANGUAGE_LOCALES,isWebLanguage,readWebLanguage,setWebLanguage,type WebLanguage } from '@/lib/web-i18n';

export function useWebLanguage(){
  const[language,setLanguageState]=useState<WebLanguage>('fr');
  useEffect(()=>{
    setLanguageState(readWebLanguage());
    const onLanguage=(event:Event)=>{
      const detail=(event as CustomEvent<unknown>).detail;
      if(isWebLanguage(detail))setLanguageState(detail);
      else setLanguageState(readWebLanguage());
    };
    const onStorage=(event:StorageEvent)=>{
      if(event.key==='khe.web.language')setLanguageState(isWebLanguage(event.newValue)?event.newValue:'fr');
    };
    window.addEventListener(WEB_LANGUAGE_EVENT,onLanguage);
    window.addEventListener('storage',onStorage);
    return()=>{window.removeEventListener(WEB_LANGUAGE_EVENT,onLanguage);window.removeEventListener('storage',onStorage);};
  },[]);
  const setLanguage=useCallback((next:WebLanguage)=>{setWebLanguage(next);setLanguageState(next);},[]);
  return{language,setLanguage,locale:WEB_LANGUAGE_LOCALES[language]};
}
