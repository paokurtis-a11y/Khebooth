'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { apiRequest } from '@/lib/api';

type Language='fr'|'en'|'de'|'it'|'es'|'pt';
type NotificationItem={id:string;kind:string;title:string;body:string;actionUrl?:string|null;publishedAt:string;read:boolean};
type NotificationPayload={preferences:{notificationsEnabled:boolean;productUpdatesEnabled:boolean;supportNotificationsEnabled:boolean};unreadCount:number;items:NotificationItem[]};
type DeliveryPreferences={enabled:boolean;soundEnabled:boolean;sound:string;soundVolume:number;vibrationEnabled:boolean;vibrationMode:string;vibrationIntensity:string};
type Me={role?:string;notificationPreferences?:DeliveryPreferences};
type ConversationSummary={status:'BOT'|'HANDOFF_REQUESTED'|'ASSIGNED'|'RESOLVED'};
type DockPosition={x:number;y:number};

const DEFAULT_DELIVERY:DeliveryPreferences={enabled:true,soundEnabled:true,sound:'khe_chime',soundVolume:70,vibrationEnabled:true,vibrationMode:'double',vibrationIntensity:'medium'};
const AGENT_ROLES=['OWNER','ADMIN','OPERATOR'];
const HELP_POSITION_KEY='khe.support.help-position.v1';
const TEXT:Record<Language,Record<string,string>>={
  fr:{help:'Aide / KHE',move:'Déplacer Aide / KHE',notifications:'Notifications',notificationBody:'Nouveautés, messages et informations KHE Booth',product:'Nouveautés produit',support:'Support',settings:'Son, volume et vibration',empty:'Aucune notification pour le moment.',unread:'Non lu',open:'Ouvrir'},
  en:{help:'Help / KHE',move:'Move Help / KHE',notifications:'Notifications',notificationBody:'KHE Booth updates, messages and information',product:'Product updates',support:'Support',settings:'Sound, volume and vibration',empty:'No notifications yet.',unread:'Unread',open:'Open'},
  de:{help:'Hilfe / KHE',move:'Hilfe / KHE verschieben',notifications:'Benachrichtigungen',notificationBody:'Neuigkeiten, Nachrichten und Informationen zu KHE Booth',product:'Produktneuigkeiten',support:'Support',settings:'Ton, Lautstärke und Vibration',empty:'Noch keine Benachrichtigungen.',unread:'Ungelesen',open:'Öffnen'},
  it:{help:'Aiuto / KHE',move:'Sposta Aiuto / KHE',notifications:'Notifiche',notificationBody:'Novità, messaggi e informazioni KHE Booth',product:'Novità prodotto',support:'Supporto',settings:'Suono, volume e vibrazione',empty:'Nessuna notifica al momento.',unread:'Non letta',open:'Apri'},
  es:{help:'Ayuda / KHE',move:'Mover Ayuda / KHE',notifications:'Notificaciones',notificationBody:'Novedades, mensajes e información de KHE Booth',product:'Novedades del producto',support:'Soporte',settings:'Sonido, volumen y vibración',empty:'No hay notificaciones por el momento.',unread:'No leída',open:'Abrir'},
  pt:{help:'Ajuda / KHE',move:'Mover Ajuda / KHE',notifications:'Notificações',notificationBody:'Novidades, mensagens e informações KHE Booth',product:'Novidades do produto',support:'Suporte',settings:'Som, volume e vibração',empty:'Sem notificações neste momento.',unread:'Não lida',open:'Abrir'}
};

function readLanguage():Language{
  if(typeof window==='undefined')return'fr';
  const value=window.localStorage.getItem('khe.web.language');
  return value&&value in TEXT?value as Language:'fr';
}
function signal(preferences:DeliveryPreferences){
  if(!preferences.enabled)return;
  if(preferences.soundEnabled&&preferences.sound!=='silent'&&typeof window!=='undefined'){
    const AudioWindow=window as typeof window&{webkitAudioContext?:typeof AudioContext};
    const Context=window.AudioContext||AudioWindow.webkitAudioContext;
    if(Context){
      const context=new Context();
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      const frequencies:Record<string,number>={default:640,khe_chime:760,khe_gold:920,khe_pulse:520};
      oscillator.frequency.value=frequencies[preferences.sound]||760;
      oscillator.type=preferences.sound==='khe_pulse'?'square':'sine';
      gain.gain.value=Math.max(0,Math.min(1,preferences.soundVolume/100))*.16;
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start();
      gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.3);
      oscillator.stop(context.currentTime+.32);
      oscillator.addEventListener('ended',()=>void context.close());
    }
  }
  if(preferences.vibrationEnabled&&typeof navigator!=='undefined'&&'vibrate'in navigator){
    const intensity=preferences.vibrationIntensity==='strong'?1.4:preferences.vibrationIntensity==='light'?.7:1;
    const unit=Math.round(90*intensity);
    const patterns:Record<string,number[]>={short:[unit],double:[unit,80,unit],triple:[unit,70,unit,70,unit],long:[unit*3]};
    navigator.vibrate(patterns[preferences.vibrationMode]||[unit]);
  }
}
function clampDock(position:DockPosition,width:number,height:number):DockPosition{
  const margin=8;
  return{
    x:Math.max(margin,Math.min(window.innerWidth-width-margin,position.x)),
    y:Math.max(margin,Math.min(window.innerHeight-height-margin,position.y)),
  };
}

export function SupportCenterTools(){
  const[language,setLanguage]=useState<Language>('fr');
  const[open,setOpen]=useState(false);
  const[data,setData]=useState<NotificationPayload|null>(null);
  const[delivery,setDelivery]=useState<DeliveryPreferences>(DEFAULT_DELIVERY);
  const[role,setRole]=useState('');
  const[supportCount,setSupportCount]=useState(0);
  const[helpPosition,setHelpPosition]=useState<DockPosition|null>(null);
  const previousUnread=useRef<number|null>(null);
  const helpDockRef=useRef<HTMLDivElement>(null);
  const helpPositionRef=useRef<DockPosition|null>(null);
  const dragRef=useRef<{pointerId:number;offsetX:number;offsetY:number}|null>(null);
  const t=TEXT[language];
  const locale=language==='fr'?'fr-CH':language;

  const refreshNotifications=()=>{
    apiRequest<NotificationPayload>('/support/notifications').then((next)=>{
      if(previousUnread.current!==null&&next.unreadCount>previousUnread.current)signal(delivery);
      previousUnread.current=next.unreadCount;
      setData(next);
    }).catch(()=>undefined);
  };
  const refreshSupport=()=>{
    const endpoint=AGENT_ROLES.includes(role)?'/support/inbox':'/support/conversations/me';
    apiRequest<ConversationSummary[]>(endpoint).then((items)=>setSupportCount(items.filter((item)=>item.status!=='RESOLVED'&&(AGENT_ROLES.includes(role)?item.status!=='BOT':true)).length)).catch(()=>undefined);
  };

  useEffect(()=>{
    setLanguage(readLanguage());
    try{
      const stored=JSON.parse(window.localStorage.getItem(HELP_POSITION_KEY)??'null') as DockPosition|null;
      if(stored&&Number.isFinite(stored.x)&&Number.isFinite(stored.y)){
        helpPositionRef.current=stored;
        setHelpPosition(stored);
      }
    }catch{}
    const languageHandler=(event:Event)=>{
      const detail=(event as CustomEvent<string>).detail;
      if(detail&&detail in TEXT)setLanguage(detail as Language);
    };
    const resizeHandler=()=>{
      const dock=helpDockRef.current;
      const current=helpPositionRef.current;
      if(!dock||!current)return;
      const next=clampDock(current,dock.offsetWidth,dock.offsetHeight);
      helpPositionRef.current=next;
      setHelpPosition(next);
      try{window.localStorage.setItem(HELP_POSITION_KEY,JSON.stringify(next));}catch{}
    };
    window.addEventListener('khe-language-changed',languageHandler);
    window.addEventListener('resize',resizeHandler);
    apiRequest<Me>('/auth/me').then((me)=>{
      setDelivery({...DEFAULT_DELIVERY,...me.notificationPreferences});
      setRole(me.role??'');
    }).catch(()=>undefined);
    return()=>{
      window.removeEventListener('khe-language-changed',languageHandler);
      window.removeEventListener('resize',resizeHandler);
    };
  },[]);

  useEffect(()=>{
    refreshNotifications();
    const timer=window.setInterval(refreshNotifications,30000);
    return()=>window.clearInterval(timer);
  },[delivery]);
  useEffect(()=>{
    refreshSupport();
    const timer=window.setInterval(refreshSupport,30000);
    return()=>window.clearInterval(timer);
  },[role]);

  const updatePreference=async(key:keyof NotificationPayload['preferences'],value:boolean)=>{
    await apiRequest('/support/notifications/preferences',{method:'PATCH',body:JSON.stringify({[key]:value})});
    refreshNotifications();
  };
  const markRead=async(item:NotificationItem)=>{
    if(!item.read){
      await apiRequest(`/support/notifications/${item.id}/read`,{method:'POST'});
      refreshNotifications();
    }
  };
  const startDrag=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    const dock=helpDockRef.current;
    if(!dock)return;
    const rect=dock.getBoundingClientRect();
    dragRef.current={pointerId:event.pointerId,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    const drag=dragRef.current;
    const dock=helpDockRef.current;
    if(!drag||drag.pointerId!==event.pointerId||!dock)return;
    const next=clampDock({x:event.clientX-drag.offsetX,y:event.clientY-drag.offsetY},dock.offsetWidth,dock.offsetHeight);
    helpPositionRef.current=next;
    setHelpPosition(next);
  };
  const endDrag=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    if(dragRef.current?.pointerId!==event.pointerId)return;
    dragRef.current=null;
    try{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}catch{}
    if(helpPositionRef.current){
      try{window.localStorage.setItem(HELP_POSITION_KEY,JSON.stringify(helpPositionRef.current));}catch{}
    }
  };

  return <div className="support-tools">
    <div ref={helpDockRef} className={'support-help-dock'+(helpPosition?' is-positioned':'')} style={helpPosition?{left:helpPosition.x,top:helpPosition.y}:undefined}>
      <Link className="button secondary support-help" href="/help">
        <span className="support-help-icon" aria-hidden="true">💬</span>
        <span className="support-help-text">{t.help}</span>
        {supportCount>0?<span style={{minWidth:20,height:20,padding:'0 6px',borderRadius:10,display:'inline-grid',placeItems:'center',background:'#d6af52',color:'#111',fontSize:11,fontWeight:900}}>{supportCount}</span>:null}
      </Link>
      <button type="button" className="support-drag-handle" aria-label={t.move} title={t.move} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>⠿</button>
    </div>
    <div className="support-bell-wrap">
      <button className="button secondary support-bell" aria-label={t.notifications} aria-expanded={open} onClick={()=>setOpen((value)=>!value)}>🔔{(data?.unreadCount??0)>0?<span className="support-unread">{data?.unreadCount}</span>:null}</button>
      {open?<div className="card support-notification-panel">
        <div className="support-panel-head"><div><strong>{t.notifications}</strong><div className="muted" style={{fontSize:12}}>{t.notificationBody}</div></div><button className="button secondary" onClick={()=>setOpen(false)} style={{padding:'6px 9px'}}>×</button></div>
        <div className="support-preferences">
          <label className="team-permission-option"><span>{t.notifications}</span><input type="checkbox" checked={data?.preferences.notificationsEnabled??true} onChange={(event)=>updatePreference('notificationsEnabled',event.target.checked)}/></label>
          <label className="team-permission-option"><span>{t.product}</span><input type="checkbox" checked={data?.preferences.productUpdatesEnabled??true} disabled={!data?.preferences.notificationsEnabled} onChange={(event)=>updatePreference('productUpdatesEnabled',event.target.checked)}/></label>
          <label className="team-permission-option"><span>{t.support}</span><input type="checkbox" checked={data?.preferences.supportNotificationsEnabled??true} disabled={!data?.preferences.notificationsEnabled} onChange={(event)=>updatePreference('supportNotificationsEnabled',event.target.checked)}/></label>
          <Link href="/settings" className="support-settings-link">{t.settings} →</Link>
        </div>
        <div className="support-items">{(data?.items.length??0)===0?<div className="muted" style={{padding:'16px 0'}}>{t.empty}</div>:data?.items.map((item)=><div key={item.id} onClick={()=>markRead(item)} className={`support-item ${item.read?'read':'unread'}`}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><strong style={{fontSize:14}}>{item.title}</strong>{!item.read?<span title={t.unread} style={{color:'#d6af52'}}>●</span>:null}</div><div className="muted" style={{fontSize:13,marginTop:4}}>{item.body}</div><div className="muted" style={{fontSize:11,marginTop:5}}>{new Date(item.publishedAt).toLocaleString(locale)}</div>{item.actionUrl?<Link href={item.actionUrl}>{t.open}</Link>:null}</div>)}</div>
      </div>:null}
    </div>
  </div>;
}
