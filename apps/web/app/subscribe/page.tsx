import Link from 'next/link';
import { headers } from 'next/headers';
import { SubscriptionCheckoutForm } from '@/components/subscription-checkout-form';

export default async function SubscribePage({searchParams}:{searchParams:Promise<{plan?:string;currency?:string}>}){
  const params=await searchParams;const requestHeaders=await headers();const country=requestHeaders.get('x-vercel-ip-country')||'CH';
  return <main className="marketing-page" style={{minHeight:'100vh'}}><header className="marketing-nav"><Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link><Link className="marketing-login" href={`/?currency=${encodeURIComponent((params.currency||'').toUpperCase())}`}>← Retour au site</Link></header><section className="marketing-section"><div className="section-heading centered"><div className="marketing-kicker"><span/> ABONNEMENT KHE BOOTH</div><h1>Activez votre accès en quelques instants.</h1><p>La devise est adaptée à votre pays et peut être modifiée manuellement. Après confirmation du paiement, KHE Booth synchronise automatiquement votre statut et votre KHE ID.</p></div><SubscriptionCheckoutForm initialPlan={params.plan} initialCountry={country} initialCurrency={(params.currency||'').toUpperCase()}/></section></main>;
}
