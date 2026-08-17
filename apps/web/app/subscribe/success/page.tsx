import Link from 'next/link';

export default function SubscriptionSuccessPage(){
  return <main className="marketing-page" style={{minHeight:'100vh'}}><section className="marketing-section"><div className="card" style={{maxWidth:720,margin:'8vh auto',textAlign:'center',padding:32}}><div className="marketing-kicker"><span/> PAIEMENT REÇU</div><h1>Merci. KHE Booth vérifie votre paiement.</h1><p>La confirmation finale arrive directement du prestataire de paiement. Dès qu’elle est validée, votre abonnement passe automatiquement à Actif, votre KHE ID est associé à votre compte et vos informations sont disponibles dans CAPTURE et SHARING.</p><div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap',marginTop:24}}><Link className="marketing-cta" href="/">Retour au site</Link><Link className="marketing-ghost" href="/login">Accéder à KHE Booth</Link></div></div></section></main>;
}
