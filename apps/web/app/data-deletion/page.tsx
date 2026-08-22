import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Suppression des données — KHE Booth',
  description: 'Instructions publiques pour demander la suppression des données KHE Booth.',
};

const shell={minHeight:'100vh',background:'#090b0f',color:'#f5f7fa',padding:'48px 20px',fontFamily:'Arial,Helvetica,sans-serif'} as const;
const card={maxWidth:900,margin:'0 auto',background:'#11151b',border:'1px solid #29313d',borderRadius:18,padding:'32px',boxShadow:'0 18px 60px rgba(0,0,0,.28)'} as const;

export default function DataDeletionPage(){
  return <main style={shell}><article style={card}>
    <div style={{color:'#d8b85b',fontWeight:800,letterSpacing:2,fontSize:12}}>KHE BOOTH · DONNÉES</div>
    <h1 style={{fontSize:'clamp(28px,5vw,44px)',margin:'10px 0 4px'}}>Suppression de vos données</h1>
    <p style={{color:'#9da8b5',marginTop:0}}>Instructions publiques pour les utilisateurs KHE Booth et les connexions Meta.</p>

    <section style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:20}}><h2 style={{fontSize:18,color:'#f0d47d'}}>1. Déconnecter Facebook ou Instagram</h2><p style={{lineHeight:1.7,color:'#c7cfd9'}}>Si vous souhaitez uniquement supprimer l’accès de KHE Booth à un compte social, utilisez la fonction de déconnexion du fournisseur dans KHE Booth ou révoquez l’application KHE Booth depuis les paramètres de votre compte Facebook ou Instagram. Les jetons de connexion associés sont alors invalidés ou supprimés côté KHE.</p></section>

    <section style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:20}}><h2 style={{fontSize:18,color:'#f0d47d'}}>2. Demander la suppression de données KHE Booth</h2><p style={{lineHeight:1.7,color:'#c7cfd9'}}>Envoyez votre demande depuis l’adresse e-mail liée à votre compte KHE Booth à <a href="mailto:khebooth@gmail.com?subject=Demande%20de%20suppression%20de%20donn%C3%A9es%20KHE%20Booth" style={{color:'#f0d47d'}}>khebooth@gmail.com</a> avec l’objet « Demande de suppression de données KHE Booth ». Indiquez l’adresse e-mail du compte concerné et, si applicable, le nom de l’organisation ou de l’événement. Ne transmettez jamais de mot de passe ni de jeton d’accès.</p></section>

    <section style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:20}}><h2 style={{fontSize:18,color:'#f0d47d'}}>3. Vérification et traitement</h2><p style={{lineHeight:1.7,color:'#c7cfd9'}}>KHE Booth peut demander une vérification raisonnable afin d’éviter la suppression frauduleuse de données appartenant à un autre utilisateur ou à une autre organisation. Après validation, les données concernées sont supprimées ou anonymisées dans les délais légaux applicables, sous réserve des données devant être conservées pour des obligations légales, comptables, de sécurité ou de prévention des abus.</p></section>

    <section style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:20}}><h2 style={{fontSize:18,color:'#f0d47d'}}>4. Données des plateformes tierces</h2><p style={{lineHeight:1.7,color:'#c7cfd9'}}>La suppression dans KHE Booth n’efface pas automatiquement les contenus déjà publiés sur Facebook, Instagram ou une autre plateforme. Ces contenus doivent également être supprimés depuis la plateforme concernée lorsqu’ils y sont encore présents.</p></section>

    <section style={{borderTop:'1px solid #29313d',paddingTop:20,marginTop:24}}><p style={{marginBottom:0}}><a href="/privacy" style={{color:'#f0d47d'}}>Politique de confidentialité</a> · <a href="/terms" style={{color:'#f0d47d'}}>Conditions d’utilisation</a></p></section>
  </article></main>;
}
