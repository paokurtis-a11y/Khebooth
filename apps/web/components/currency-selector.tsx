'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { getMarketingCopy, type MarketingLanguage } from '@/lib/marketing-i18n';

type Props={currency:string;supportedCurrencies:string[];language:MarketingLanguage;compact?:boolean};
const CURRENCIES:Record<string,{flag:string;country:Record<MarketingLanguage,string>}>={
  CHF:{flag:'🇨🇭',country:{fr:'Suisse',en:'Switzerland',de:'Schweiz',it:'Svizzera',es:'Suiza',pt:'Suíça'}},
  EUR:{flag:'🇪🇺',country:{fr:'Zone euro',en:'Euro area',de:'Eurozone',it:'Zona euro',es:'Zona euro',pt:'Zona euro'}},
  GBP:{flag:'🇬🇧',country:{fr:'Royaume-Uni',en:'United Kingdom',de:'Vereinigtes Königreich',it:'Regno Unito',es:'Reino Unido',pt:'Reino Unido'}},
  USD:{flag:'🇺🇸',country:{fr:'États-Unis',en:'United States',de:'Vereinigte Staaten',it:'Stati Uniti',es:'Estados Unidos',pt:'Estados Unidos'}},
  CAD:{flag:'🇨🇦',country:{fr:'Canada',en:'Canada',de:'Kanada',it:'Canada',es:'Canadá',pt:'Canadá'}},
  AUD:{flag:'🇦🇺',country:{fr:'Australie',en:'Australia',de:'Australien',it:'Australia',es:'Australia',pt:'Austrália'}},
};

export function CurrencySelector({currency,supportedCurrencies,language,compact=false}:Props){
  const router=useRouter();
  const params=useSearchParams();
  const t=getMarketingCopy(language);
  const label=compact?t.selectors.currency:t.selectors.currencyLong;
  return <label className="currency-selector" style={{fontSize:compact?12:14}}>
    <span>{label}</span>
    <select aria-label={t.selectors.currencyLong} value={currency} onChange={(event)=>{
      const next=new URLSearchParams(params.toString());
      next.set('currency',event.target.value);
      router.replace(`?${next.toString()}`,{scroll:false});
    }}>
      {supportedCurrencies.map((item)=>{
        const data=CURRENCIES[item];
        return <option key={item} value={item}>{data?`${data.flag} ${item} · ${data.country[language]}`:item}</option>;
      })}
    </select>
  </label>;
}
