'use client';

import { useMemo, useState } from 'react';

type Point={id:string;email:string;firstName?:string|null;lastName?:string|null;online:boolean;available:boolean;availability?:string|null;countryCode?:string|null;regionCode?:string|null;municipality?:string|null;latitude?:number|null;longitude?:number|null};

export function OperationsGlobe({agents}:{agents:Point[]}){
  const[rotation,setRotation]=useState(0);const size=440,c=size/2,r=184;
  const points=useMemo(()=>agents.filter(a=>Number.isFinite(Number(a.latitude))&&Number.isFinite(Number(a.longitude))).map(a=>{
    const phi=Number(a.latitude)*Math.PI/180;const lambda=(Number(a.longitude)-rotation)*Math.PI/180;const visibility=Math.cos(phi)*Math.cos(lambda);
    return{agent:a,visible:visibility>=0,x:c+r*Math.cos(phi)*Math.sin(lambda),y:c-r*Math.sin(phi)};
  }),[agents,rotation]);
  const hidden=agents.filter(a=>!Number.isFinite(Number(a.latitude))||!Number.isFinite(Number(a.longitude)));
  return <div>
    <div style={{display:'grid',placeItems:'center',overflow:'hidden'}}><svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{maxWidth:520}} role="img" aria-label="Globe des agents KHE">
      <defs><radialGradient id="khe-globe"><stop offset="0" stopColor="#1d2936"/><stop offset="1" stopColor="#080b10"/></radialGradient><clipPath id="globe-clip"><circle cx={c} cy={c} r={r}/></clipPath></defs>
      <circle cx={c} cy={c} r={r} fill="url(#khe-globe)" stroke="rgba(210,173,79,.65)" strokeWidth="2"/>
      <g clipPath="url(#globe-clip)" fill="none" stroke="rgba(146,166,188,.18)" strokeWidth="1">
        <ellipse cx={c} cy={c} rx={r*.72} ry={r}/><ellipse cx={c} cy={c} rx={r*.34} ry={r}/><line x1={c-r} y1={c} x2={c+r} y2={c}/>
        <ellipse cx={c} cy={c-r*.5} rx={r*.86} ry={r*.25}/><ellipse cx={c} cy={c+r*.5} rx={r*.86} ry={r*.25}/>
      </g>
      {points.filter(p=>p.visible).map(({agent,x,y})=><g key={agent.id} transform={`translate(${x} ${y})`}><circle r={agent.available?8:agent.online?6:5} fill={agent.available?'#5bd68a':agent.online?'#d2ad4f':'#7b8490'} stroke="#fff" strokeWidth="1.4"><title>{[agent.firstName,agent.lastName].filter(Boolean).join(' ')||agent.email} · {[agent.municipality,agent.regionCode,agent.countryCode].filter(Boolean).join(' · ')} · {agent.available?'Disponible':agent.online?'Connecté':'Déconnecté'}</title></circle>{agent.available?<circle r="13" fill="none" stroke="rgba(91,214,138,.45)"/>:null}</g>)}
    </svg></div>
    <label style={{display:'block',maxWidth:520,margin:'0 auto'}}><span className="muted" style={{fontSize:11}}>Rotation du globe</span><input type="range" min={-180} max={180} value={rotation} onChange={e=>setRotation(Number(e.target.value))} style={{width:'100%'}}/></label>
    <div className="muted" style={{fontSize:11,marginTop:8,textAlign:'center'}}>● vert = disponible · ● or = connecté · gris = hors ligne. La position est une estimation de zone, pas un suivi GPS précis.</div>
    {hidden.length?<div className="muted" style={{fontSize:11,marginTop:8,textAlign:'center'}}>{hidden.length} agent(s) sans partage de zone : ils restent visibles dans la liste mais pas positionnés sur le globe.</div>:null}
  </div>;
}
