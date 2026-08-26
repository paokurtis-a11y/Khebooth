'use client';

import {useRouter,useSearchParams} from 'next/navigation';
import {MARKETING_LANGUAGES,type MarketingLanguage} from '@/lib/marketing-i18n';

const STORAGE_KEY='khe.marketing.language.v1';
const COOKIE_KEY='khe_marketing_language';

export function MarketingLanguageSelector({language,compact=false,label='Langue'}:{language:MarketingLanguage;compact?:boolean;label?:string}){
  const router=useRouter();
  const params=useSearchParams();
  const selectLanguage=(value:string)=>{
    const next=value as MarketingLanguage;
    try{window.localStorage.setItem(STORAGE_KEY,next);}catch{}
    document.cookie=`${COOKIE_KEY}=${encodeURIComponent(next)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    const query=new URLSearchParams(params.toString());
    query.set('lang',next);
    router.replace(`?${query.toString()}`,{scroll:false});
    router.refresh();
  };
  return <label className="language-selector">
    <span>{label}</span>
    <select aria-label={label} value={language} onChange={(event)=>selectLanguage(event.target.value)}>
      {MARKETING_LANGUAGES.map((item)=><option key={item.code} value={item.code}>{item.flag} {compact?item.short:item.label}</option>)}
    </select>
  </label>;
}
