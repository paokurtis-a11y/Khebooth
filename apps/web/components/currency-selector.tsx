'use client';

import { useRouter, useSearchParams } from 'next/navigation';

type Props={currency:string;supportedCurrencies:string[];compact?:boolean};
const LABELS:Record<string,string>={CHF:'🇨🇭 CHF · Suisse',EUR:'🇪🇺 EUR · Zone euro',GBP:'🇬🇧 GBP · Royaume-Uni',USD:'🇺🇸 USD · États-Unis',CAD:'🇨🇦 CAD · Canada',AUD:'🇦🇺 AUD · Australie'};

export function CurrencySelector({currency,supportedCurrencies,compact=false}:Props){
  const router=useRouter();const params=useSearchParams();
  return <label className="currency-selector" style={{fontSize:compact?12:14}}><span>{compact?'Devise':'Devise / pays'}</span>
    <select aria-label="Devise et pays" value={currency} onChange={(e)=>{const next=new URLSearchParams(params.toString());next.set('currency',e.target.value);router.replace(`?${next.toString()}`,{scroll:false});}} style={{minWidth:compact?130:190}}>
      {supportedCurrencies.map((item)=><option key={item} value={item}>{LABELS[item]||item}</option>)}
    </select>
  </label>;
}
