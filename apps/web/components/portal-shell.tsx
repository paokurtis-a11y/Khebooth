'use client';

import Link from 'next/link';
import { usePathname,useRouter } from 'next/navigation';
import { useEffect,useMemo,useState } from 'react';
import { apiRequest,clearAccessToken,getAccessToken,setSessionUser } from '@/lib/api';
import { endOperationsSession } from '@/lib/operations-session';
import { translateWebPhrase,type WebLanguage } from '@/lib/web-i18n';
import { OperationsPresenceControl } from './operations-presence-control';
import { SupportCenterTools } from './support-center-tools';
import { SupportFeedbackPrompt } from './support-feedback-prompt';
import { useWebLanguage } from './use-web-language';
import { WebTermsGate } from './web-terms-gate';

type CurrentUser={id:string;organizationId?:string;email:string;username?:string|null;firstName?:string|null;lastName?:string|null;role:string;avatarUrl?:string|null;permissions?:Record<string,boolean>;termsAccepted?:boolean;tenantKind?:string;managedByOrganizationId?:string|null;securityDetailsAllowed?:boolean};
type NavItem={href:string;label:string};
type NavGroup={id:string;label:string;icon:string;items:NavItem[]};

const NAV_OPEN_KEY='khe.portal.navigation.open.v2';
const ROLE_LABELS:Record<WebLanguage,Record<string,string>>={
  fr:{OWNER:'Propriétaire',ADMIN:'Administrateur',OPERATOR:'Agent'},
  en:{OWNER:'Owner',ADMIN:'Administrator',OPERATOR:'Agent'},
  de:{OWNER:'Inhaber',ADMIN:'Administrator',OPERATOR:'Agent'},
  it:{OWNER:'Proprietario',ADMIN:'Amministratore',OPERATOR:'Agente'},
  es:{OWNER:'Propietario',ADMIN:'Administrador',OPERATOR:'Agente'},
  pt:{OWNER:'Proprietário',ADMIN:'Administrador',OPERATOR:'Agente'},
};

function pathMatches(pathname:string,href:string){return pathname===href||pathname.startsWith(`${href}/`);}
function readOpenGroups(){if(typeof window==='undefined')return[] as string[];try{const parsed=JSON.parse(window.localStorage.getItem(NAV_OPEN_KEY)??'[]');return Array.isArray(parsed)?parsed.filter(value=>typeof value==='string'):[];}catch{return[];}}
function persistOpenGroups(groups:string[]){if(typeof window!=='undefined')window.localStorage.setItem(NAV_OPEN_KEY,JSON.stringify(groups));}

export function PortalShell({children}:Readonly<{children:React.ReactNode}>){
  const pathname=usePathname();
  const router=useRouter();
  const{language}=useWebLanguage();
  const[user,setUser]=useState<CurrentUser|null>(null);
  const[ready,setReady]=useState(false);
  const[openGroups,setOpenGroups]=useState<string[]>([]);
  const t=(source:string)=>translateWebPhrase(source,language);

  useEffect(()=>{setOpenGroups(readOpenGroups());},[]);
  useEffect(()=>{
    if(!getAccessToken()){router.replace('/login');return;}
    apiRequest<CurrentUser>('/auth/me')
      .then(currentUser=>{setUser(currentUser);setSessionUser(currentUser);})
      .catch(()=>{clearAccessToken();router.replace('/login');})
      .finally(()=>setReady(true));
  },[router]);

  const navGroups=useMemo<NavGroup[]>(()=>{
    if(!user)return[];
    const tr=(source:string)=>translateWebPhrase(source,language);
    const allowed=(permission:string)=>user.role==='OWNER'||Boolean(user.permissions?.[permission]);
    const isAgent=['OWNER','ADMIN','OPERATOR'].includes(user.role);
    const isManager=['OWNER','ADMIN'].includes(user.role);
    const groups:NavGroup[]=[];

    const home:NavItem[]=[];
    if(allowed('dashboard.view'))home.push({href:'/dashboard',label:tr('Dashboard')});
    if(user.role==='OPERATOR')home.push({href:'/agent',label:tr('Espace Agent KHE')});
    if(home.length)groups.push({id:'home',label:tr('Accueil'),icon:'⌂',items:home});

    const clients:NavItem[]=[];
    if(allowed('clients.view'))clients.push({href:'/clients',label:tr('Clients')},{href:'/clients/crm',label:tr('CRM & historique des e-mails')});
    if(clients.length)groups.push({id:'clients',label:tr('Clients'),icon:'◎',items:clients});

    const events:NavItem[]=[];
    if(allowed('events.view'))events.push({href:'/events',label:tr('Événements')});
    if(allowed('events.manage'))events.push({href:'/events/new',label:tr('Créer un événement')});
    if(allowed('studio.view'))events.push({href:'/presets',label:tr('Modèles')});
    if(events.length)groups.push({id:'events',label:tr('Événements & Studio'),icon:'✦',items:events});

    const support:NavItem[]=[{href:'/help',label:tr('Aide / Messagerie')}];
    if(allowed('communications.manage'))support.push({href:'/communications',label:tr('Communications clients')});
    groups.push({id:'support',label:tr('Support & communications'),icon:'✉',items:support});

    if(isAgent)groups.push({
      id:'agent',label:tr('Mon activité agent'),icon:'◉',items:[
        {href:'/operations/workforce/me',label:tr('Mon planning')},
        {href:'/operations/workforce/live',label:tr('Shift en direct')},
        {href:'/operations/workforce/brief',label:tr('Mon brief de shift')},
        {href:'/operations/workforce/handover/me',label:tr('Mon relais')},
        {href:'/operations/workforce/rescue/me',label:tr('Mon renfort SLA')},
      ],
    });

    if(isManager)groups.push({
      id:'operations',label:tr('Centre opérations KHE'),icon:'◈',items:[
        {href:'/operations',label:tr('Vue d’ensemble des opérations')},
        {href:'/operations/command-center',label:tr('Centre de commande')},
        {href:'/operations/routing',label:tr('Routage & SLA')},
        {href:'/operations/workforce',label:tr('Effectifs & prévisions')},
        {href:'/operations/workforce/live/team',label:tr('Shift équipe en direct')},
        {href:'/operations/workforce/brief/team',label:tr('Brief d’équipe')},
        {href:'/operations/workforce/handover',label:tr('Relais d’équipe')},
        {href:'/operations/workforce/rescue',label:tr('Renfort SLA de l’équipe')},
        {href:'/operations/workforce/team',label:tr('Équipe & effectifs')},
        {href:'/operations/workforce/optimizer',label:tr('Optimisation du planning')},
      ],
    });

    if(allowed('marketing.view'))groups.push({id:'marketing',label:tr('Marketing & croissance'),icon:'↗',items:[
      {href:'/marketing',label:tr('Marketing & analyses')},
      {href:'/marketing/growth',label:tr('Stripe & campagnes')},
      {href:'/marketing/emailing',label:tr('E-mailing automatisé')},
    ]});

    const admin:NavItem[]=[];
    if(allowed('site.manage'))admin.push({href:'/site-configuration',label:tr('Configuration du site web')});
    if(allowed('team.manage'))admin.push({href:'/team',label:tr('Équipe & autorisations')});
    if(user.securityDetailsAllowed===true)admin.push({href:'/security',label:tr('Sécurité des plateformes')});
    if(admin.length)groups.push({id:'admin',label:tr('Administration'),icon:'◆',items:admin});

    const settings:NavItem[]=[
      {href:'/settings',label:tr('Paramètres généraux')},
      {href:'/profile',label:tr('Profil')},
      {href:'/account/subscription',label:tr('Abonnement & facturation')},
    ];
    if(user.role==='OWNER')settings.splice(1,0,{href:'/settings/social-developer',label:tr('Connexions développeur')});
    if(isManager)settings.splice(user.role==='OWNER'?2:1,0,{href:'/settings/agents',label:tr('Agents KHE')});
    groups.push({id:'settings',label:tr('Paramètres'),icon:'⚙',items:settings});

    groups.push({id:'compliance',label:tr('Aide & conformité'),icon:'§',items:[
      {href:'/guide',label:tr('Guide d’utilisation')},
      {href:'/terms',label:tr('Conditions d’utilisation')},
      {href:'/privacy',label:tr('Confidentialité')},
      {href:'/data-deletion',label:tr('Suppression des données')},
    ]});

    const collator=new Intl.Collator(language,{sensitivity:'base',numeric:true});
    return groups
      .map(group=>({...group,items:[...group.items].sort((a,b)=>collator.compare(a.label,b.label))}))
      .sort((a,b)=>collator.compare(a.label,b.label));
  },[language,user]);

  const activeHref=useMemo(()=>navGroups.flatMap(group=>group.items).filter(item=>pathMatches(pathname,item.href)).sort((a,b)=>b.href.length-a.href.length)[0]?.href,[navGroups,pathname]);
  const activeGroupId=useMemo(()=>navGroups.find(group=>group.items.some(item=>item.href===activeHref))?.id,[activeHref,navGroups]);

  useEffect(()=>{
    if(!activeGroupId)return;
    setOpenGroups(previous=>{
      if(previous.includes(activeGroupId))return previous;
      const next=[...previous,activeGroupId];persistOpenGroups(next);return next;
    });
  },[activeGroupId]);

  const toggleGroup=(id:string)=>setOpenGroups(previous=>{const next=previous.includes(id)?previous.filter(value=>value!==id):[...previous,id];persistOpenGroups(next);return next;});
  const closeAllGroups=()=>{setOpenGroups([]);persistOpenGroups([]);};

  if(!ready)return <main className="login"><div className="muted">{t('Chargement de KHE Booth…')}</div></main>;
  if(user&&user.termsAccepted===false)return <WebTermsGate onAccepted={()=>setUser({...user,termsAccepted:true})}/>;

  const displayName=[user?.firstName,user?.lastName].filter(Boolean).join(' ')||user?.email;
  const roleLabel=user?.role?(ROLE_LABELS[language][user.role]??user.role):'';
  const logout=async()=>{await endOperationsSession();clearAccessToken();router.replace('/login');};

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">KHE <span>Booth</span></div>
      <div className="muted" style={{marginTop:6,fontSize:13}}>Kurtis Hypnotic Events</div>
      {user?.tenantKind==='ENTERPRISE_CLIENT'?<div style={{marginTop:10,padding:'7px 9px',borderRadius:10,border:'1px solid rgba(210,173,79,.35)',color:'#d2ad4f',fontSize:10,fontWeight:900}}>{t('ESPACE ENTREPRISE GÉRÉ PAR KHE')}</div>:null}
      <nav className="portal-nav" aria-label="Navigation KHE Booth">
        <div className="portal-nav-heading"><span>{t('MENU KHE')}</span>{openGroups.length?<button type="button" onClick={closeAllGroups}>{t('Tout fermer')}</button>:null}</div>
        {navGroups.map(group=>{
          const isOpen=openGroups.includes(group.id);const isActive=group.id===activeGroupId;
          return <section className={`portal-nav-group${isOpen?' is-open':''}${isActive?' is-active':''}`} key={group.id}>
            <button type="button" className="portal-nav-trigger" onClick={()=>toggleGroup(group.id)} aria-expanded={isOpen} aria-controls={`nav-${group.id}`}>
              <span className="portal-nav-icon" aria-hidden="true">{group.icon}</span><span className="portal-nav-label">{group.label}</span><span className="portal-nav-chevron" aria-hidden="true">⌄</span>
            </button>
            <div id={`nav-${group.id}`} className="portal-nav-submenu" data-open={isOpen?'true':'false'}>
              <div className="portal-nav-submenu-inner">
                {group.items.map(item=><Link key={item.href} href={item.href} aria-current={activeHref===item.href?'page':undefined}><span aria-hidden="true">→</span><span>{item.label}</span></Link>)}
                {group.id==='agent'?<OperationsPresenceControl role={user?.role} embedded/>:null}
              </div>
            </div>
          </section>;
        })}
      </nav>
      <div className="portal-user-card">
        <div style={{display:'flex',alignItems:'center',gap:9}}>{user?.avatarUrl?<img src={user.avatarUrl} alt="" style={{width:34,height:34,borderRadius:17,objectFit:'cover',border:'1px solid #d2ad4f'}}/>:null}<div><div style={{fontWeight:800,fontSize:13}}>{displayName}</div>{user?.username?<div className="muted" style={{fontSize:11,marginTop:1}}>@{user.username}</div>:null}<div className="muted" style={{fontSize:12,marginTop:2}}>{roleLabel}</div></div></div>
        <button className="button secondary" style={{marginTop:14,width:'100%'}} onClick={()=>void logout()}>{t('Déconnexion')}</button>
      </div>
    </aside>
    <SupportCenterTools/>
    <SupportFeedbackPrompt/>
    <main className="content">{children}</main>
  </div>;
}
