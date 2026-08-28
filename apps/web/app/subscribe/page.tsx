import Link from 'next/link';
import { headers } from 'next/headers';
import { HistoryBackLink } from '@/components/history-back-link';
import { MarketingLanguageSelector } from '@/components/marketing-language-selector';
import { SubscriptionCheckoutForm } from '@/components/subscription-checkout-form';
import { resolveMarketingLanguage } from '@/lib/marketing-i18n';

function cookie(raw:string|null,name:string){const found=(raw||'').split(';').map((part)=>part.trim()).find((part)=>part.startsWith(`${name}=`));return found?decodeURIComponent(found.slice(name.length+1)):null;}

const BACK_LABEL={fr:'Retour à la page précédente',en:'Back to previous page',de:'Zurück zur vorherigen Seite',it:'Torna alla pagina precedente',es:'Volver a la página anterior',pt:'Voltar à página anterior'} as const;

export default async function SubscribePage({searchParams}:{searchParams:Promise<{plan?:string;currency?:string;lang?:string}>}){
  const params=await searchParams;const requestHeaders=await headers();const country=requestHeaders.get('x-vercel-ip-country')||'CH';const language=resolveMarketingLanguage({requested:params.lang,saved:cookie(requestHeaders.get('cookie'),'khe_marketing_language'),country});
  return <main className="marketing-page checkout-page"><header className="marketing-nav checkout-nav"><Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link><div className="marketing-nav-actions"><MarketingLanguageSelector compact language={language}/><HistoryBackLink label={BACK_LABEL[language]}/></div></header><section className="checkout-page-shell"><SubscriptionCheckoutForm initialPlan={params.plan} initialCountry={country} initialCurrency={(params.currency||'').toUpperCase()} language={language}/></section></main>;
}
