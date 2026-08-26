'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMarketingCopy, type MarketingLanguage } from '@/lib/marketing-i18n';

type Media=Record<string,string>;
type Clip={id:number;title:string;subtitle:string;badge:string;url?:string;poster?:string;accent:string};
const ACCENTS=['#d6af52','#8ad9f5','#c72d43','#79d6a3'];
function shuffled<T>(input:T[]):T[]{const copy=[...input];for(let i=copy.length-1;i>0;i-=1){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}

export function PromoStoryReel({media,language}:{media?:Media;language:MarketingLanguage}){
  const t=getMarketingCopy(language).reel;
  const clips=useMemo(()=>t.clips.map((copy,index)=>({id:index+1,title:media?.[`promo${index+1}Title`]||copy.title,subtitle:media?.[`promo${index+1}Subtitle`]||copy.subtitle,badge:copy.badge,url:media?.[`promo${index+1}Url`]||undefined,poster:media?.[`promo${index+1}PosterUrl`]||undefined,accent:ACCENTS[index]})),[media,t]);
  const[order,setOrder]=useState<number[]>([0,1,2,3]);
  const[index,setIndex]=useState(0);
  useEffect(()=>{setOrder(shuffled([0,1,2,3]));},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setIndex((value)=>(value+1)%4),7200);return()=>window.clearInterval(timer);},[]);
  const clip=clips[order[index]??0];
  return <section className="promo-story-section" aria-label={t.aria}>
    <div className="promo-story-copy"><div className="marketing-kicker"><span/> {t.kicker}</div><h2>{t.title}</h2><p>{t.intro}</p><div className="promo-story-dots">{order.map((clipIndex,dotIndex)=><button key={clipIndex} aria-label={`${t.sequence} ${dotIndex+1}`} className={dotIndex===index?'active':''} onClick={()=>setIndex(dotIndex)}>{dotIndex+1}</button>)}</div></div>
    <div className="promo-story-frame">{clip.url?<video key={clip.url} className="promo-story-video" src={clip.url} poster={clip.poster} autoPlay muted loop playsInline controls={false}/>:<BuiltInClip clip={clip} copy={t}/>}<div className="promo-story-overlay"><span>{clip.badge}</span><h3>{clip.title}</h3><p>{clip.subtitle}</p></div></div>
  </section>;
}

function BuiltInClip({clip,copy}:{clip:Clip;copy:ReturnType<typeof getMarketingCopy>['reel']}){
  return <div className={`promo-motion promo-motion-${clip.id}`} style={{'--clip-accent':clip.accent} as React.CSSProperties}>
    <div className="promo-grid-lines"/><div className="promo-orb promo-orb-a"/><div className="promo-orb promo-orb-b"/>
    {clip.id===1?<><div className="promo-tablet promo-tablet-left"><span>CAPTURE</span><div className="promo-camera-ring"><i/></div><small>REC • 00:12</small></div><div className="promo-link-beam"><b>✦</b></div><div className="promo-tablet promo-tablet-right"><span>SHARING</span><div className="promo-gallery-grid"><i/><i/><i/><i/></div><small>QR • CLOUD</small></div></>:null}
    {clip.id===2?<><div className="promo-poster-card"><span>KHE STUDIO</span><strong>SANDRINE<br/>& HEINZ</strong><small>{copy.typography}</small></div><div className="promo-tool-stack"><i>✦</i><i>T</i><i>◫</i><i>♫</i></div></>:null}
    {clip.id===3?<><div className="promo-phone"><div className="promo-qr">▦</div><strong>{copy.souvenir}</strong><small>{copy.shareReady}</small></div><div className="promo-share-rays"><i/><i/><i/><i/><i/></div></>:null}
    {clip.id===4?<><div className="promo-dashboard"><div className="promo-chart"><i/><i/><i/><i/></div><div className="promo-metrics"><span>{copy.clients} <b>+18%</b></span><span>{copy.shares} <b>1.2K</b></span><span>SYNC <b>100%</b></span></div></div></>:null}
  </div>;
}
