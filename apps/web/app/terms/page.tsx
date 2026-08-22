import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { legalProfileForCountry } from '@/lib/legal-policies';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Conditions d’utilisation — KHE Booth',
  description: 'Conditions générales d’utilisation publiques de KHE Booth.',
};

const sections = [
  ['1. Objet','KHE Booth est une plateforme et une application de capture, création, synchronisation, gestion, impression et partage de contenus photo et vidéo pour des événements.'],
  ['2. Compte et sécurité','Chaque utilisateur doit protéger ses identifiants, utiliser uniquement les droits qui lui sont attribués et signaler sans délai tout accès non autorisé. Les rôles et permissions sont gérés par l’organisation.'],
  ['3. Captation et droit à l’image','L’organisateur et les utilisateurs sont responsables d’obtenir les autorisations nécessaires avant de photographier, filmer, imprimer ou partager des contenus et doivent respecter les règles locales applicables.'],
  ['4. Données et confidentialité','Les utilisateurs doivent traiter les données personnelles conformément aux lois applicables dans leur juridiction. Les règles locales impératives restent applicables lorsqu’elles ne peuvent pas être écartées contractuellement.'],
  ['5. Cloud, appareils et services tiers','Certaines fonctions dépendent d’Internet, de Vercel, de services de paiement, de stockage, d’e-mail, d’Android, iOS ou du navigateur. Leur disponibilité peut varier selon le pays, l’appareil et le fournisseur.'],
  ['6. Abonnements et paiements','Les fonctionnalités disponibles dépendent du niveau d’abonnement. Les abonnements récurrents sont renouvelés selon les conditions présentées au paiement jusqu’à résiliation par le client. Les moyens de paiement disponibles peuvent varier selon le pays.'],
  ['7. Contenus interdits','Il est interdit d’utiliser KHE Booth pour des contenus ou activités illicites, abusifs, trompeurs, portant atteinte aux droits de tiers ou à la sécurité des personnes et des systèmes.'],
  ['8. Disponibilité et mises à jour','KHE Booth peut être mis à jour, maintenu ou temporairement indisponible. Les utilisateurs peuvent recevoir des informations de maintenance, de sécurité et de mise à jour via la plateforme, l’application ou l’e-mail.'],
  ['9. Notifications','Les notifications peuvent être réglées en silencieux, avec son ou vibration selon les capacités du navigateur, du système et de l’appareil. Les réglages système de l’appareil restent prioritaires.'],
  ['10. Acceptation et évolution','L’utilisation de la plateforme nécessite l’acceptation de la révision en vigueur. Une nouvelle acceptation peut être demandée lorsque les conditions changent de manière significative.'],
] as const;

const shell={minHeight:'100vh',background:'#090b0f',color:'#f5f7fa',padding:'48px 20px',fontFamily:'Arial,Helvetica,sans-serif'} as const;
const card={maxWidth:900,margin:'0 auto',background:'#11151b',border:'1px solid #29313d',borderRadius:18,padding:'32px',boxShadow:'0 18px 60px rgba(0,0,0,.28)'} as const;

export default async function TermsPage(){
  const requestHeaders=await headers();
  const profile=legalProfileForCountry(requestHeaders.get('x-vercel-ip-country')||requestHeaders.get('cf-ipcountry'));
  return <main style={shell}><article style={card}>
    <div style={{color:'#d8b85b',fontWeight:800,letterSpacing:2,fontSize:12}}>KHE BOOTH · LÉGAL</div>
    <h1 style={{fontSize:'clamp(28px,5vw,44px)',margin:'10px 0 4px'}}>Conditions générales d’utilisation</h1>
    <p style={{color:'#9da8b5',marginTop:0}}>Version locale : {profile.label} · Révision {profile.revision} · Revue le {profile.lastReviewed}</p>
    <aside style={{margin:'20px 0',padding:16,border:'1px solid #5c4d23',borderRadius:12,background:'#17140d'}}><strong style={{color:'#f0d47d'}}>Cadre local détecté</strong><p style={{color:'#c7cfd9',lineHeight:1.6,margin:'8px 0 0'}}>Cette version est automatiquement sélectionnée à partir du pays de connexion lorsque cette information est disponible. Cadres pris en compte : {profile.frameworks.join(' · ')}. La localisation réseau ne remplace pas la détermination juridique du pays de résidence ou d’établissement.</p></aside>
    {sections.map(([title,body])=><section key={title} style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:20}}><h2 style={{fontSize:18,color:'#f0d47d',margin:'0 0 8px'}}>{title}</h2><p style={{lineHeight:1.7,color:'#c7cfd9',margin:0}}>{body}</p></section>)}
    <section style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:20}}><h2 style={{fontSize:18,color:'#f0d47d',margin:'0 0 8px'}}>Dispositions locales — {profile.label}</h2>{profile.termsAddendum.map((body)=><p key={body} style={{lineHeight:1.7,color:'#c7cfd9'}}>{body}</p>)}</section>
    <section style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:24}}><h2 style={{fontSize:18,color:'#f0d47d'}}>Contact</h2><p style={{lineHeight:1.7,color:'#c7cfd9'}}>Pour toute question relative à ces conditions : <a href="mailto:khebooth@gmail.com" style={{color:'#f0d47d'}}>khebooth@gmail.com</a>.</p><p style={{marginBottom:0}}><a href="/privacy" style={{color:'#f0d47d'}}>Politique de confidentialité</a> · <a href="/data-deletion" style={{color:'#f0d47d'}}>Suppression des données</a></p></section>
  </article></main>;
}
