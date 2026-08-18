'use client';

import { useEffect, useMemo, useState } from 'react';

type Media=Record<string,string>;
type Clip={id:number;title:string;subtitle:string;badge:string;url?:string;poster?:string;accent:string};

const DEFAULTS:Clip[]=[
  {id:1,title:'Un événement. Deux stations. Zéro friction.',subtitle:'CAPTURE filme. SHARING distribue. KHE garde les deux expériences synchronisées.',badge:'CAPTURE ↔ SHARING',accent:'#d6af52'},
  {id:2,title:'Votre univers visuel prend vie.',subtitle:'Cadres, textes, couleurs et identité événementielle sont préparés dans Studio puis appliqués à la capture.',badge:'STUDIO CRÉATIF',accent:'#8ad9f5'},
  {id:3,title:'Le souvenir arrive dans les mains de l’invité.',subtitle:'QR sécurisé, galerie cloud et partage rapide : moins d’attente, plus d’émotion.',badge:'PARTAGE INVITÉ',accent:'#c72d43'},
  {id:4,title:'Pilotez l’événement comme une régie.',subtitle:'Suivi des clients, abonnements, statistiques et opérations réunis dans KHE Booth.',badge:'PILOTAGE KHE',accent:'#79d6a3'},
];

function shuffled<T>(input:T[]):T[]{const copy=[...input];for(let i=copy.length-1;i>0;i-=1){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}

export function PromoStoryReel({media}:{media?:Media}){
  const clips=useMemo(()=>DEFAULTS.map((clip)=>({...clip,title:media?.[`promo${clip.id}Title`]||clip.title,subtitle:media?.[`promo${clip.id}Subtitle`]||clip.subtitle,url:media?.[`promo${clip.id}Url`]||undefined,poster:media?.[`promo${clip.id}PosterUrl`]||undefined})),[media]);
  const[order,setOrder]=useState<number[]>([0,1,2,3]);const[index,setIndex]=useState(0);
  useEffect(()=>{setOrder(shuffled([0,1,2,3]));},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setIndex((value)=>(value+1)%4),7200);return()=>window.clearInterval(timer);},[]);
  const clip=clips[order[index]??0];
  return <section className="promo-story-section" aria-label="Démonstrations KHE Booth">
    <div className="promo-story-copy"><div className="marketing-kicker"><span/> KHE BOOTH EN ACTION</div><h2>Voyez l’expérience avant de la télécharger.</h2><p>Quatre séquences promotionnelles tournent automatiquement dans un ordre différent à chaque visite. Vous pouvez remplacer chaque séquence par votre propre vidéo et votre propre affiche depuis Configuration du site web.</p><div className="promo-story-dots">{order.map((clipIndex,dotIndex)=><button key={clipIndex} aria-label={`Voir la séquence ${dotIndex+1}`} className={dotIndex===index?'active':''} onClick={()=>setIndex(dotIndex)}>{dotIndex+1}</button>)}</div></div>
    <div className="promo-story-frame">
      {clip.url?<video key={clip.url} className="promo-story-video" src={clip.url} poster={clip.poster} autoPlay muted loop playsInline controls={false}/>:<BuiltInClip clip={clip}/>} 
      <div className="promo-story-overlay"><span>{clip.badge}</span><h3>{clip.title}</h3><p>{clip.subtitle}</p></div>
    </div>
  </section>;
}

function BuiltInClip({clip}:{clip:Clip}){
  return <div className={`promo-motion promo-motion-${clip.id}`} style={{'--clip-accent':clip.accent} as React.CSSProperties}>
    <div className="promo-grid-lines"/>
    <div className="promo-orb promo-orb-a"/><div className="promo-orb promo-orb-b"/>
    {clip.id===1?<><div className="promo-tablet promo-tablet-left"><span>CAPTURE</span><div className="promo-camera-ring"><i/></div><small>REC • 00:12</small></div><div className="promo-link-beam"><b>✦</b></div><div className="promo-tablet promo-tablet-right"><span>SHARING</span><div className="promo-gallery-grid"><i/><i/><i/><i/></div><small>QR • CLOUD</small></div></>:null}
    {clip.id===2?<><div className="promo-poster-card"><span>KHE STUDIO</span><strong>SANDRINE<br/>& HEINZ</strong><small>Cadres • typographies • couleurs</small></div><div className="promo-tool-stack"><i>✦</i><i>T</i><i>◫</i><i>♫</i></div></>:null}
    {clip.id===3?<><div className="promo-phone"><div className="promo-qr">▦</div><strong>Votre souvenir</strong><small>Prêt à partager</small></div><div className="promo-share-rays"><i/><i/><i/><i/><i/></div></>:null}
    {clip.id===4?<><div className="promo-dashboard"><div className="promo-chart"><i/><i/><i/><i/></div><div className="promo-metrics"><span>CLIENTS <b>+18%</b></span><span>PARTAGES <b>1.2K</b></span><span>SYNC <b>100%</b></span></div></div></>:null}
  </div>;
}
