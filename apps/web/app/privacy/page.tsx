import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { legalProfileForLocation } from '@/lib/legal-policies';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — KHE Booth',
  description: 'Politique de confidentialité publique de KHE Booth.',
};

const sections = [
  ['1. Données traitées','KHE Booth peut traiter les données de compte nécessaires à l’accès au service, les paramètres d’organisation, les journaux techniques et de sécurité, les messages de support ainsi que les photos, vidéos et métadonnées importées ou créées dans le cadre d’un événement.'],
  ['2. Connexions aux réseaux sociaux','Lorsque vous connectez Facebook, Instagram ou un autre fournisseur pris en charge, KHE Booth reçoit uniquement les identifiants, autorisations et jetons nécessaires aux fonctions que vous activez. Les mots de passe de vos comptes sociaux ne sont jamais demandés ni stockés par KHE Booth. Les jetons de connexion sont conservés côté serveur sous forme chiffrée.'],
  ['3. Finalités','Les données sont utilisées pour fournir les fonctions de capture, gestion, synchronisation, impression et partage, authentifier les utilisateurs, administrer les droits, sécuriser le service, assurer le support et exécuter les publications ou actions expressément demandées par l’utilisateur.'],
  ['4. Partage avec des tiers','KHE Booth peut transmettre les données strictement nécessaires à ses prestataires techniques et aux plateformes sociales choisies par l’utilisateur pour exécuter une fonctionnalité. KHE Booth ne vend pas les données personnelles à des annonceurs.'],
  ['5. Conservation et sécurité','Les données sont conservées pendant la durée nécessaire aux finalités du service, aux obligations légales et à la sécurité. Des mesures techniques et organisationnelles sont appliquées, notamment des contrôles d’accès, des journaux d’audit et le chiffrement des secrets de connexion.'],
  ['6. Contenus d’événement et droit à l’image','L’organisateur de l’événement et les utilisateurs sont responsables de disposer des autorisations nécessaires pour la captation, l’utilisation et le partage des images et vidéos des participants.'],
  ['7. Vos droits','Selon la législation applicable, vous pouvez demander l’accès, la rectification ou la suppression de vos données, ou vous opposer à certains traitements. Les demandes sont traitées après vérification raisonnable de l’identité du demandeur et dans les délais légaux applicables.'],
  ['8. Révocation des connexions sociales','Vous pouvez déconnecter un fournisseur social depuis KHE Booth. Vous pouvez également révoquer les autorisations directement depuis les paramètres Facebook, Instagram ou du fournisseur concerné.'],
  ['9. Modifications','Cette politique peut être mise à jour lorsque KHE Booth évolue ou lorsque les exigences légales et techniques changent. La version publiée sur cette page est la version applicable.'],
] as const;

const shell={minHeight:'100vh',background:'#090b0f',color:'#f5f7fa',padding:'48px 20px',fontFamily:'Arial,Helvetica,sans-serif'} as const;
const card={maxWidth:900,margin:'0 auto',background:'#11151b',border:'1px solid #29313d',borderRadius:18,padding:'32px',boxShadow:'0 18px 60px rgba(0,0,0,.28)'} as const;

export default async function PrivacyPage(){
  const requestHeaders=await headers();
  const profile=legalProfileForLocation(requestHeaders.get('x-vercel-ip-country')||requestHeaders.get('cf-ipcountry'),requestHeaders.get('x-vercel-ip-country-region'));
  return <main style={shell}><article style={card}>
    <div style={{color:'#d8b85b',fontWeight:800,letterSpacing:2,fontSize:12}}>KHE BOOTH · CONFIDENTIALITÉ</div>
    <h1 style={{fontSize:'clamp(28px,5vw,44px)',margin:'10px 0 4px'}}>Politique de confidentialité</h1>
    <p style={{color:'#9da8b5',marginTop:0}}>Juridiction détectée : {profile.jurisdictionLabel} · Révision {profile.revision} · Revue le {profile.lastReviewed}</p>
    <aside style={{margin:'20px 0',padding:16,border:'1px solid #5c4d23',borderRadius:12,background:'#17140d'}}><strong style={{color:'#f0d47d'}}>Version adaptée à l’ouverture</strong><p style={{color:'#c7cfd9',lineHeight:1.6,margin:'8px 0 0'}}>À chaque ouverture, KHE Booth sélectionne automatiquement le profil de confidentialité à partir du pays et, lorsque disponible, de la région ou de l’État de connexion. Cadres pris en compte : {profile.frameworks.join(' · ')}. Les règles impératives liées à la résidence ou à l’établissement restent prioritaires.</p></aside>
    {sections.map(([title,body])=><section key={title} style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:20}}><h2 style={{fontSize:18,color:'#f0d47d',margin:'0 0 8px'}}>{title}</h2><p style={{lineHeight:1.7,color:'#c7cfd9',margin:0}}>{body}</p></section>)}
    <section style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:20}}><h2 style={{fontSize:18,color:'#f0d47d',margin:'0 0 8px'}}>Dispositions locales — {profile.jurisdictionLabel}</h2>{profile.privacyAddendum.map((body)=><p key={body} style={{lineHeight:1.7,color:'#c7cfd9'}}>{body}</p>)}</section>
    <section style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:24}}><h2 style={{fontSize:18,color:'#f0d47d'}}>Contact confidentialité</h2><p style={{lineHeight:1.7,color:'#c7cfd9'}}>Pour une question ou une demande relative à vos données : <a href="mailto:khebooth@gmail.com" style={{color:'#f0d47d'}}>khebooth@gmail.com</a>.</p><p style={{marginBottom:0}}><a href="/terms" style={{color:'#f0d47d'}}>Conditions d’utilisation</a> · <a href="/data-deletion" style={{color:'#f0d47d'}}>Instructions de suppression</a></p></section>
  </article></main>;
}
