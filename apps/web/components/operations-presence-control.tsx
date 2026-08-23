'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';
import { apiRequest,getSessionUser } from '@/lib/api';
import { getApproximateLocationSharing,getOperationsSessionKey,setApproximateLocationSharing } from '@/lib/operations-session';
import { translateWebPhrase,type WebLanguage } from '@/lib/web-i18n';
import { useWebLanguage } from './use-web-language';

type Presence={isAgent:boolean;online:boolean;availability:string;acceptingAssignments:boolean;requiresAvailabilityConfirmation:boolean;lastHeartbeatAt?:string|null;availableSince?:string|null;locationSharingEnabled?:boolean};
type WorkforceCompact={nextShift?:{id:string;startsAt:string;endsAt:string;confirmationStatus:string}|null;unreadNotices:number};
type LiveCompact={shift?:{id:string;startsAt:string;endsAt:string;liveStatus:string;confirmationStatus:string}|null;policy?:{requireActiveShiftForRouting:boolean}};
type BriefCompact={brief?:{id:string;status:string;shiftEndsAt:string;openConversationCount:number;urgentSlaCount:number;missingNoteCount:number}|null};
type RescueCompact={open:number;prepared:number;overdue:number;urgent:number};
type Copy={ongoing:string;until:string;nextShift:string;pending:string;accepted:string;declined:string;dialogDescription:string;shareDescription:string;openConversations:string;urgentSla:string;missingNotes:string;decisions:string;preparedHandovers:string;overdue:string};

const COPY:Record<WebLanguage,Copy>={
  fr:{ongoing:'En cours / imminent',until:'jusqu’à',nextShift:'Prochain shift',pending:'à confirmer',accepted:'confirmé',declined:'refusé',dialogDescription:'Choisissez votre préférence initiale. KHE mémorisera ce choix et vous pourrez modifier votre statut à tout moment depuis Mon activité agent.',shareDescription:'Pays, région et commune estimés à partir de la connexion. Aucun suivi GPS précis en continu.',openConversations:'conversation(s) ouverte(s)',urgentSla:'SLA urgent(s)',missingNotes:'note(s) manquante(s)',decisions:'décision(s)',preparedHandovers:'relais préparé(s)',overdue:'dépassé(s)'},
  en:{ongoing:'Now / imminent',until:'until',nextShift:'Next shift',pending:'to confirm',accepted:'confirmed',declined:'declined',dialogDescription:'Choose your initial preference. KHE will remember it, and you can change your status at any time from My agent activity.',shareDescription:'Country, region and town estimated from the connection. No continuous precise GPS tracking.',openConversations:'open conversation(s)',urgentSla:'urgent SLA(s)',missingNotes:'missing note(s)',decisions:'decision(s)',preparedHandovers:'prepared handover(s)',overdue:'overdue'},
  de:{ongoing:'Läuft / unmittelbar',until:'bis',nextShift:'Nächste Schicht',pending:'zu bestätigen',accepted:'bestätigt',declined:'abgelehnt',dialogDescription:'Wählen Sie Ihre anfängliche Präferenz. KHE speichert sie; Sie können Ihren Status jederzeit unter Meine Agentenaktivität ändern.',shareDescription:'Land, Region und Ort werden anhand der Verbindung geschätzt. Kein kontinuierliches präzises GPS-Tracking.',openConversations:'offene Unterhaltung(en)',urgentSla:'dringende SLA(s)',missingNotes:'fehlende Notiz(en)',decisions:'Entscheidung(en)',preparedHandovers:'vorbereitete Übergabe(n)',overdue:'überfällig'},
  it:{ongoing:'In corso / imminente',until:'fino alle',nextShift:'Prossimo turno',pending:'da confermare',accepted:'confermato',declined:'rifiutato',dialogDescription:'Scegli la preferenza iniziale. KHE la memorizzerà e potrai modificare lo stato in qualsiasi momento da La mia attività agente.',shareDescription:'Paese, regione e comune stimati dalla connessione. Nessun tracciamento GPS preciso continuo.',openConversations:'conversazione/i aperta/e',urgentSla:'SLA urgente/i',missingNotes:'nota/e mancante/i',decisions:'decisione/i',preparedHandovers:'passaggio/i preparato/i',overdue:'scaduto/i'},
  es:{ongoing:'En curso / inminente',until:'hasta',nextShift:'Próximo turno',pending:'por confirmar',accepted:'confirmado',declined:'rechazado',dialogDescription:'Elige tu preferencia inicial. KHE la recordará y podrás cambiar tu estado en cualquier momento desde Mi actividad de agente.',shareDescription:'País, región y municipio estimados a partir de la conexión. Sin seguimiento GPS preciso y continuo.',openConversations:'conversación(es) abierta(s)',urgentSla:'SLA urgente(s)',missingNotes:'nota(s) pendiente(s)',decisions:'decisión(es)',preparedHandovers:'relevo(s) preparado(s)',overdue:'vencido(s)'},
  pt:{ongoing:'Em curso / iminente',until:'até',nextShift:'Próximo turno',pending:'por confirmar',accepted:'confirmado',declined:'recusado',dialogDescription:'Escolha a preferência inicial. A KHE irá guardá-la e poderá alterar o estado a qualquer momento em Minha atividade de agente.',shareDescription:'País, região e município estimados a partir da ligação. Sem acompanhamento GPS preciso e contínuo.',openConversations:'conversa(s) aberta(s)',urgentSla:'SLA urgente(s)',missingNotes:'nota(s) em falta',decisions:'decisão(ões)',preparedHandovers:'passagem(ns) preparada(s)',overdue:'em atraso'},
};

const AVAILABILITY_PROMPT_KEY='khe.agent.availability-confirmed.v1';
function shiftCountdown(value:string|undefined|null,language:WebLanguage){if(!value)return'';const minutes=Math.round((new Date(value).getTime()-Date.now())/60000);if(minutes<=0)return COPY[language].ongoing;const formatter=new Intl.RelativeTimeFormat(language,{numeric:'always',style:'short'});if(minutes<60)return formatter.format(minutes,'minute');const hours=Math.round(minutes/60);if(hours<24)return formatter.format(hours,'hour');return formatter.format(Math.round(hours/24),'day');}
function availabilityPromptKey(){const userId=getSessionUser()?.id;return userId?`${AVAILABILITY_PROMPT_KEY}.${userId}`:AVAILABILITY_PROMPT_KEY;}
function readAvailabilityPromptAcknowledged(){if(typeof window==='undefined')return false;return window.localStorage.getItem(availabilityPromptKey())==='1';}
function rememberAvailabilityPromptAcknowledged(){if(typeof window==='undefined')return;window.localStorage.setItem(availabilityPromptKey(),'1');}

export function OperationsPresenceControl({role,embedded=false}:{role?:string;embedded?:boolean}){
  const pathname=usePathname();
  const{language,locale}=useWebLanguage();
  const t=(source:string)=>translateWebPhrase(source,language);
  const copy=COPY[language];
  const isAgent=['OWNER','ADMIN','OPERATOR'].includes(role??'');const isManager=['OWNER','ADMIN'].includes(role??'');
  const[presence,setPresence]=useState<Presence|null>(null);const[workforce,setWorkforce]=useState<WorkforceCompact|null>(null);const[live,setLive]=useState<LiveCompact|null>(null);const[brief,setBrief]=useState<BriefCompact|null>(null);const[rescue,setRescue]=useState<RescueCompact|null>(null);const[shareLocation,setShareLocation]=useState(false);const[promptAcknowledged,setPromptAcknowledged]=useState(false);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[expanded,setExpanded]=useState(false);
  const actionCount=useRef(0);const lastPath=useRef<string|null>(null);const lastWorkforcePulse=useRef(0);

  useEffect(()=>{setShareLocation(getApproximateLocationSharing());setPromptAcknowledged(readAvailabilityPromptAcknowledged());},[]);
  useEffect(()=>{const handler=()=>{actionCount.current=Math.min(50,actionCount.current+1);};document.addEventListener('click',handler,{passive:true});return()=>document.removeEventListener('click',handler);},[]);
  const refreshCompact=()=>{if(!isAgent)return;void Promise.all([apiRequest<WorkforceCompact>('/operations/workforce/agent/compact'),apiRequest<LiveCompact>('/operations/workforce/live/compact'),apiRequest<BriefCompact>('/operations/workforce/brief/compact'),apiRequest<RescueCompact>('/operations/workforce/rescue/compact')]).then(([w,l,b,r])=>{setWorkforce(w);setLive(l);setBrief(b);setRescue(r);}).catch(()=>undefined);};
  const pulseOperations=()=>{if(!isAgent)return;void apiRequest('/operations/routing/pulse',{method:'POST'}).catch(()=>undefined);const now=Date.now();if(now-lastWorkforcePulse.current>=300000){lastWorkforcePulse.current=now;void apiRequest('/operations/workforce/pulse',{method:'POST'}).catch(()=>undefined);void apiRequest('/operations/workforce/agent/pulse',{method:'POST'}).catch(()=>undefined);void apiRequest('/operations/workforce/live/pulse',{method:'POST'}).finally(refreshCompact).catch(()=>undefined);}};
  const heartbeat=async(pageView=0)=>{if(!isAgent)return;const sessionKey=getOperationsSessionKey();if(!sessionKey)return;const actions=actionCount.current;actionCount.current=0;try{const next=await apiRequest<Presence>('/operations/presence/heartbeat',{method:'POST',body:JSON.stringify({sessionKey,surface:'WEB_PORTAL',shareApproximateLocation:shareLocation,pageViews:pageView,actions})});setPresence(next);setError('');pulseOperations();}catch(e){actionCount.current=Math.min(50,actionCount.current+actions);setError(e instanceof Error?e.message:t('Présence indisponible'));}};
  useEffect(()=>{if(!isAgent)return;const pageView=lastPath.current===pathname?0:1;lastPath.current=pathname;void heartbeat(pageView);const timer=window.setInterval(()=>void heartbeat(0),30000);return()=>window.clearInterval(timer);},[pathname,shareLocation,isAgent]);
  const setAvailability=async(availability:string)=>{setBusy(true);setError('');try{const next=await apiRequest<Presence>('/operations/presence/availability',{method:'POST',body:JSON.stringify({sessionKey:getOperationsSessionKey(),availability,shareApproximateLocation:shareLocation})});setPresence(next);rememberAvailabilityPromptAcknowledged();setPromptAcknowledged(true);lastWorkforcePulse.current=0;pulseOperations();}catch(e){setError(e instanceof Error?e.message:t('Impossible de modifier le statut'));}finally{setBusy(false);}};
  const changeLocation=(enabled:boolean)=>{setShareLocation(enabled);setApproximateLocationSharing(enabled);};
  if(!presence||!isAgent)return null;

  const statusLabel=presence.availability==='AVAILABLE'?t('Disponible'):presence.availability==='BUSY'?t('Occupé'):presence.availability==='AWAY'?t('En pause'):t('Indisponible');
  const panelId='khe-agent-presence-panel';
  const shellStyle=embedded?undefined:{position:'fixed' as const,right:18,bottom:18,zIndex:900,minWidth:245,maxWidth:370,boxShadow:'0 16px 44px rgba(0,0,0,.35)'};

  return <>
    {presence.requiresAvailabilityConfirmation&&!promptAcknowledged?<div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,.72)',display:'grid',placeItems:'center',padding:20}}><section className="card" style={{maxWidth:560,width:'100%',border:'1px solid rgba(210,173,79,.55)',boxShadow:'0 30px 90px rgba(0,0,0,.55)'}}><div className="eyebrow">{t('KHE • DISPONIBILITÉ AGENT')}</div><h2 style={{marginTop:8}}>{t('Souhaitez-vous recevoir des affectations ?')}</h2><p>{copy.dialogDescription}</p><label style={{display:'flex',gap:10,alignItems:'flex-start',padding:'12px 0'}}><input type="checkbox" checked={shareLocation} onChange={e=>changeLocation(e.target.checked)}/><span><strong>{t('Partager ma zone approximative')}</strong><br/><span className="muted" style={{fontSize:12}}>{copy.shareDescription}</span></span></label>{error?<p className="error">{error}</p>:null}<div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="button" disabled={busy} onClick={()=>void setAvailability('AVAILABLE')}>{busy?t('Activation…'):t('Me rendre disponible')}</button><button className="button secondary" disabled={busy} onClick={()=>void setAvailability('UNAVAILABLE')}>{t('Rester indisponible')}</button></div></section></div>:null}

    <section className={`operations-presence-card${embedded?' is-embedded':''}`} style={shellStyle}>
      <button type="button" className="operations-presence-toggle" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded} aria-controls={panelId} aria-label={expanded?t('Masquer le panneau Agent KHE'):t('Afficher le panneau Agent KHE')}>
        <span><strong>{t('Agent KHE')}</strong><small>{statusLabel}</small></span>
        <span className={`operations-presence-online${presence.online?' is-online':''}`}>● {presence.online?t('Connecté'):t('Déconnecté')}</span>
        <span className="operations-presence-chevron" aria-hidden="true">{expanded?'⌃':'⌄'}</span>
      </button>
      {expanded?<div id={panelId} className="operations-presence-body">
        <select aria-label={t('Disponibilité Agent KHE')} disabled={busy} value={presence.availability||'UNAVAILABLE'} onChange={e=>void setAvailability(e.target.value)}>
          <option value="AVAILABLE">{t('Disponible — recevoir les tâches')}</option><option value="BUSY">{t('Occupé')}</option><option value="AWAY">{t('En pause')}</option><option value="UNAVAILABLE">{t('Indisponible')}</option>
        </select>
        <div className="muted operations-presence-summary">{statusLabel}{presence.acceptingAssignments?` · ${t('Routage intelligent actif')}`:` · ${t('Aucune affectation automatique')}`}</div>
        {live?.shift&&['ACTIVE','PAUSED'].includes(live.shift.liveStatus)?<div className="operations-presence-signal success-signal"><strong>{live.shift.liveStatus==='ACTIVE'?`🟢 ${t('Shift en service')}`:`⏸ ${t('Shift en pause')}`}</strong><div className="muted">{copy.until} {new Date(live.shift.endsAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}</div></div>:workforce?.nextShift?<div className="operations-presence-signal"><strong>⏰ {copy.nextShift} {shiftCountdown(workforce.nextShift.startsAt,language)}</strong><div className="muted">{new Date(workforce.nextShift.startsAt).toLocaleString(locale,{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})} · {workforce.nextShift.confirmationStatus==='PENDING'?copy.pending:workforce.nextShift.confirmationStatus==='ACCEPTED'?copy.accepted:copy.declined}</div></div>:null}
        {brief?.brief?<div className="operations-presence-signal info-signal"><strong>📋 {t('Brief de fin de shift prêt')}</strong><div className="muted">{brief.brief.openConversationCount} {copy.openConversations} · {brief.brief.urgentSlaCount} {copy.urgentSla} · {brief.brief.missingNoteCount} {copy.missingNotes}</div></div>:null}
        {rescue&&(rescue.open||rescue.prepared||rescue.overdue)?<div className="operations-presence-signal danger-signal"><strong>🛟 {t('SLA Rescue actif')}</strong><div className="muted">{rescue.open} {copy.decisions} · {rescue.prepared} {copy.preparedHandovers} · {rescue.overdue} {copy.overdue}</div></div>:null}
        {error?<p className="error operations-presence-error">{error}</p>:null}
        <div className="operations-presence-links">
          <Link href="/operations/workforce/live">{t('Shift en direct')} →</Link><Link href="/operations/workforce/brief">Brief →</Link><Link href="/operations/workforce/rescue/me">SLA Rescue →</Link><Link href="/operations/workforce/handover/me">{t('Mon relais')} →</Link><Link href="/operations/workforce/me">{t('Mon planning')}{workforce?.unreadNotices?` (${workforce.unreadNotices})`:''} →</Link>
          {isManager?<><Link href="/operations/workforce/live/team">{t('Équipe en direct')} →</Link><Link href="/operations/workforce/brief/team">{t('Brief d’équipe')} →</Link><Link href="/operations/workforce/rescue">{t('Renfort d’équipe')} →</Link><Link href="/operations/workforce/handover">{t('Relais d’équipe')} →</Link><Link href="/operations/workforce/team">{t('Équipe & effectifs')} →</Link><Link href="/operations/routing">{t('Routage')} →</Link><Link href="/operations/workforce/optimizer">{t('Optimiser')} →</Link></>:null}
        </div>
      </div>:null}
    </section>
  </>;
}
