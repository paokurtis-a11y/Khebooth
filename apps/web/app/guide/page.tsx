import Link from 'next/link';
import { PortalShell } from '@/components/portal-shell';

const STEPS=[
  ['1','Configurer votre profil','Ajoutez votre identité, votre téléphone, votre photo et vérifiez votre rôle KHE Booth.'],
  ['2','Créer ou sélectionner un client','Renseignez Nom, Prénom et E-mail. Le niveau d’abonnement et l’état du paiement apparaissent dans la fiche.'],
  ['3','Créer un événement','Associez le client, les dates, le lieu et le preset. À la date de fin, KHE Booth passe automatiquement l’événement en Terminé.'],
  ['4','Préparer le Studio créatif','Créez le design, vérifiez le rendu, ajoutez effets et musique puis enregistrez.'],
  ['5','Activer les stations','Générez le code KHE de l’événement et activez CAPTURE puis SHARING sur les appareils concernés.'],
  ['6','Capturer et synchroniser','CAPTURE conserve les médias localement puis les synchronise vers le Cloud selon les droits de l’abonnement.'],
  ['7','Partager','SHARING récupère les médias synchronisés et peut créer un QR invité sécurisé si l’abonnement le permet.'],
  ['8','Suivre l’activité','Utilisez Dashboard, Marketing & Analytics, communications et rapports pour suivre les clients et les performances.'],
  ['9','Administrer le site','Dans Configuration du site web, modifiez contenu, tarifs, devises, régions et visualisez le rendu en direct.'],
  ['10','Gérer l’équipe','Invitez des membres, assignez un rôle et personnalisez les autorisations action par action.'],
];

export default function GuidePage(){return <PortalShell><div className="page-header"><div><div className="eyebrow">MODE D’EMPLOI</div><h1>Guide KHE Booth</h1><p className="muted">Le parcours conseillé pour utiliser la plateforme et les stations sans oublier une étape.</p></div></div><div className="grid two">{STEPS.map(([number,title,body])=><article className="card" key={number} style={{display:'flex',gap:14,alignItems:'flex-start'}}><div style={{width:38,height:38,borderRadius:19,background:'#111',color:'#d2ad4f',display:'grid',placeItems:'center',fontWeight:900,flex:'0 0 auto'}}>{number}</div><div><h3 style={{margin:'2px 0 6px'}}>{title}</h3><p className="muted" style={{margin:0,lineHeight:1.6}}>{body}</p></div></article>)}</div><section className="card" style={{marginTop:16}}><h2>Accès rapides</h2><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Link className="button secondary" href="/profile">Profil</Link><Link className="button secondary" href="/clients">Clients</Link><Link className="button secondary" href="/events">Événements</Link><Link className="button secondary" href="/site-configuration">Configuration du site</Link><Link className="button secondary" href="/settings">Paramètres</Link></div></section></PortalShell>;}
