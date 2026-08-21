import Link from 'next/link';
import { PortalShell } from '@/components/portal-shell';

const LOGIN_URL='https://khebooth.vercel.app/login';
const AGENT_URL='https://khebooth.vercel.app/agent';

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

const AGENT_FLOW=[
  ['1','Invitation du manager','OWNER/ADMIN ouvre Équipe & autorisations, saisit l’e-mail professionnel, choisit le rôle OPERATOR pour un agent support standard et définit les permissions nécessaires.'],
  ['2','Activation du compte','L’agent ouvre le lien d’invitation unique reçu par e-mail (ou copié par le manager si l’envoi e-mail n’est pas configuré). Le lien expire après 7 jours. Il renseigne prénom, nom, téléphone facultatif et un mot de passe de 10 caractères minimum.'],
  ['3','Connexion permanente',`Après activation, l’agent n’utilise plus le lien d’invitation. Il se connecte avec son e-mail ou son nom d’utilisateur et son mot de passe sur ${LOGIN_URL}.`],
  ['4','Arrivée dans l’Espace Agent','Un utilisateur OPERATOR est dirigé automatiquement vers /agent après connexion. Cette page regroupe planning, Live Shift, messagerie, Shift Brief, SLA Rescue et passage de relais.'],
  ['5','Confirmer sa disponibilité','À chaque nouvelle session, le panneau Agent KHE demande si l’agent souhaite recevoir des assignations. Disponible autorise le routing ; Occupé, Pause ou Indisponible empêchent les nouvelles auto-assignations.'],
  ['6','Consulter et confirmer le planning','Dans Mon planning, l’agent confirme ou refuse un shift et peut déclarer une indisponibilité. Un refus ou un conflit ne réaffecte jamais automatiquement le shift : le manager décide du remplacement.'],
  ['7','Démarrer le Live Shift','Au début du service, l’agent ouvre Live Shift et démarre son shift. Il peut ensuite Pause, Reprendre et Terminer. Le cycle Live synchronise sa disponibilité opérationnelle.'],
  ['8','Traiter la messagerie support','Dans Aide / Messagerie, l’agent voit la file support, ouvre les conversations, répond aux utilisateurs, suit l’historique, crée des tâches équipe et marque les dossiers résolus selon ses droits.'],
  ['9','Préparer la fin de service','Avant la fin du shift, Shift Brief présente les conversations ouvertes, les SLA proches/dépassés, les notes manquantes et les relèves possibles. L’agent ajoute uniquement des notes opérationnelles utiles.'],
  ['10','SLA Rescue et relais','L’agent peut voir les risques SLA qui le concernent, mais HOLD, préparation/application de relève et escalade restent des décisions OWNER/ADMIN. Après la fin du shift, le Handover reprend les notes du Brief ; le manager valide les transferts.'],
];

const AGENT_LINKS=[
  ['/agent','Espace Agent'],
  ['/operations/workforce/me','Mon planning'],
  ['/operations/workforce/live','Live Shift'],
  ['/help','Aide / Messagerie'],
  ['/operations/workforce/brief','Shift Brief'],
  ['/operations/workforce/rescue/me','SLA Rescue'],
  ['/operations/workforce/handover/me','Passage de relais'],
] as const;

const MANAGER_TOOLS=[
  ['Équipe & autorisations','Créer l’invitation, choisir OPERATOR/ADMIN/SHARE_HOST, définir les permissions et désactiver/réactiver un membre.','/team'],
  ['Paramètres → Agents KHE','Activer un agent dans le routing, gérer compétences, langues, horaires, capacités et toutes les politiques agents.','/settings/agents'],
  ['Command Center','Superviser en lecture centralisée les agents Live, charge, SLA, Rescue, Brief, Handover et couverture.','/operations/command-center'],
  ['Workforce','Planifier les shifts, prévoir les besoins et gérer les alertes de sous-effectif.','/operations/workforce'],
  ['Live équipe','Superviser les shifts en cours, pauses, non-démarrages et politique Live Shift.','/operations/workforce/live/team'],
  ['Brief équipe','Voir les fins de shift à préparer, notes manquantes, SLA urgents et couverture.','/operations/workforce/brief/team'],
  ['SLA Rescue équipe','Décider de conserver, préparer une relève, escalader ou transférer un dossier après revalidation.','/operations/workforce/rescue'],
  ['Handover équipe','Recalculer les candidats, appliquer ou ignorer explicitement les passages de relais.','/operations/workforce/handover'],
] as const;

export default function GuidePage(){return <PortalShell>
  <div className="page-header"><div><div className="eyebrow">MODE D’EMPLOI</div><h1>Guide KHE Booth</h1><p className="muted">Parcours plateforme, stations et fonctionnement complet des Agents KHE.</p></div></div>
  <div className="grid two">{STEPS.map(([number,title,body])=><article className="card" key={number} style={{display:'flex',gap:14,alignItems:'flex-start'}}><div style={{width:38,height:38,borderRadius:19,background:'#111',color:'#d2ad4f',display:'grid',placeItems:'center',fontWeight:900,flex:'0 0 auto'}}>{number}</div><div><h3 style={{margin:'2px 0 6px'}}>{title}</h3><p className="muted" style={{margin:0,lineHeight:1.6}}>{body}</p></div></article>)}</div>

  <section id="agents-khe" className="card" style={{marginTop:22,border:'1px solid rgba(210,173,79,.42)'}}>
    <div className="eyebrow">GUIDE COMPLET • AGENTS KHE</div><h2>Connexion et espace de travail agent</h2>
    <div className="grid two" style={{alignItems:'start'}}><div><p><strong>Lien de connexion permanent :</strong><br/><a href={LOGIN_URL} target="_blank" rel="noreferrer" style={{color:'#d2ad4f',fontWeight:900}}>{LOGIN_URL}</a></p><p><strong>Lien direct Espace Agent :</strong><br/><a href={AGENT_URL} target="_blank" rel="noreferrer" style={{color:'#d2ad4f',fontWeight:900}}>{AGENT_URL}</a></p></div><div><p><strong>Identifiant :</strong> e-mail ou nom d’utilisateur unique.</p><p><strong>Rôle conseillé :</strong> OPERATOR pour un agent support/opérations. OWNER et ADMIN peuvent aussi utiliser les fonctions agent. SHARE_HOST n’entre pas dans le routing support.</p></div></div>
    <p className="muted" style={{fontSize:12,marginBottom:0}}>Le lien d’invitation n’est pas le lien de connexion permanent : il sert une seule fois à créer le compte et expire après 7 jours. Après activation, l’agent utilise toujours /login ou /agent.</p>
  </section>

  <section className="card" style={{marginTop:16}}><div className="eyebrow">DE L’INVITATION AU PASSAGE DE RELAIS</div><h2>Parcours complet d’un agent</h2><div className="grid two">{AGENT_FLOW.map(([number,title,body])=><article key={number} style={{padding:'12px 0',borderBottom:'1px solid #27303a',display:'flex',gap:12}}><strong style={{color:'#d2ad4f',fontSize:18}}>{number}</strong><div><strong>{title}</strong><div className="muted" style={{fontSize:12,lineHeight:1.55,marginTop:4}}>{body}</div></div></article>)}</div></section>

  <div className="grid two" style={{alignItems:'start',marginTop:16}}>
    <section className="card"><div className="eyebrow">STATUT & ROUTING</div><h2>Quand un agent reçoit du travail</h2><p>KHE combine l’état du compte, le profil de routing, la présence web, le choix de disponibilité, la charge, les compétences, la langue, les horaires et la capacité. Si l’option stricte Live Shift est activée par OWNER, un shift Live ACTIVE devient aussi obligatoire.</p><p><strong>Disponible</strong> : peut recevoir des assignations. <strong>Occupé / Pause / Indisponible</strong> : aucune nouvelle auto-assignation.</p><p className="muted" style={{fontSize:11}}>Le manager peut retirer un agent du routing ou modifier sa capacité, mais il ne force pas une fausse disponibilité temps réel à sa place.</p></section>
    <section className="card"><div className="eyebrow">CONFIDENTIALITÉ & ÉQUITÉ</div><h2>Ce que KHE n’utilise pas</h2><p>Le routing et les propositions de relève ne doivent pas utiliser les refus passés de shifts, les diagnostics médicaux, la situation familiale, des notes personnelles sensibles ou des caractéristiques protégées.</p><p>Les notes Brief/Handover servent uniquement à la continuité opérationnelle. N’y inscrivez pas d’informations médicales ou privées inutiles.</p></section>
  </div>

  <section className="card" style={{marginTop:16}}><div className="eyebrow">OUTILS DE L’AGENT</div><h2>Raccourcis espace de travail</h2><div style={{display:'flex',gap:9,flexWrap:'wrap'}}>{AGENT_LINKS.map(([href,label])=><Link key={href} className="button secondary" href={href}>{label}</Link>)}</div></section>

  <section className="card" style={{marginTop:16}}><div className="eyebrow">OWNER / ADMIN</div><h2>Où contrôler les agents</h2><div className="grid two">{MANAGER_TOOLS.map(([title,body,href])=><Link href={href} key={href} style={{display:'block',padding:'12px 0',borderBottom:'1px solid #27303a',color:'inherit',textDecoration:'none'}}><strong>{title}</strong><div className="muted" style={{fontSize:12,lineHeight:1.5,marginTop:4}}>{body}</div></Link>)}</div></section>

  <section className="card" style={{marginTop:16}}><div className="eyebrow">DÉPANNAGE AGENT</div><h2>Problèmes fréquents</h2><p><strong>Je ne reçois aucun dossier :</strong> vérifier que le compte est actif, que le profil est inclus dans le routing, puis choisir « Disponible » dans le panneau Agent KHE. Si le routing strict est activé, démarrer aussi le Live Shift.</p><p><strong>Je ne peux plus utiliser le lien d’invitation :</strong> il est expiré, révoqué ou déjà accepté. OWNER/ADMIN doit créer une nouvelle invitation si le compte n’existe pas encore.</p><p><strong>J’ai oublié mon mot de passe :</strong> utiliser « Mot de passe oublié ? » sur la page de connexion.</p><p><strong>Je refuse un shift :</strong> KHE signale l’information au manager mais ne remplace ni ne sanctionne automatiquement l’agent.</p><p><strong>Je termine mon shift avec des conversations ouvertes :</strong> compléter le Shift Brief ; le Handover est préparé puis validé par le manager.</p></section>

  <section className="card" style={{marginTop:16}}><h2>Accès rapides généraux</h2><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><Link className="button secondary" href="/profile">Profil</Link><Link className="button secondary" href="/clients">Clients</Link><Link className="button secondary" href="/events">Événements</Link><Link className="button secondary" href="/site-configuration">Configuration du site</Link><Link className="button secondary" href="/settings">Paramètres</Link></div></section>
</PortalShell>;}
