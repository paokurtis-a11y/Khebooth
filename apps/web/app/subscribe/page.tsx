import Link from 'next/link';
import { SubscriptionCheckoutForm } from '@/components/subscription-checkout-form';

export default async function SubscribePage({searchParams}:{searchParams:Promise<{plan?:string}>}){
  const params=await searchParams;
  return <main className="marketing-page" style={{minHeight:'100vh'}}><header className="marketing-nav"><Link className="marketing-brand" href="/">KHE <span>BOOTH</span></Link><Link className="marketing-login" href="/">← Retour au site</Link></header><section className="marketing-section"><div className="section-heading centered"><div className="marketing-kicker"><span/> ABONNEMENT KHE BOOTH</div><h1>Activez votre accès en quelques instants.</h1><p>Choisissez votre formule et votre moyen de paiement. Après confirmation du paiement, KHE Booth synchronise automatiquement votre statut et votre KHE ID.</p></div><SubscriptionCheckoutForm initialPlan={params.plan}/></section></main>;
}
