'use client';

import { useEffect, useMemo, useState } from 'react';

type GlobalErrorProps={
  error:Error&{digest?:string};
  reset:()=>void;
};

const RECOVERY_KEY='khe.web.chunk-recovery.v1';

function isStaleModuleError(error:Error):boolean{
  const message=`${error.name} ${error.message}`.toLowerCase();
  return /chunkloaderror|loading chunk|dynamically imported module|module script failed|failed to fetch/.test(message);
}

export default function GlobalError({error,reset}:GlobalErrorProps){
  const[recovering,setRecovering]=useState(false);
  const recoverable=useMemo(()=>isStaleModuleError(error),[error]);

  useEffect(()=>{
    if(!recoverable)return;
    try{
      const signature=error.message||error.name;
      if(window.sessionStorage.getItem(RECOVERY_KEY)===signature)return;
      window.sessionStorage.setItem(RECOVERY_KEY,signature);
      setRecovering(true);
      const url=new URL(window.location.href);
      url.searchParams.set('_khe_reload',Date.now().toString());
      window.location.replace(url.toString());
    }catch{
      // Storage can be unavailable in Safari private/restricted contexts.
    }
  },[error,recoverable]);

  const retry=()=>{
    try{window.sessionStorage.removeItem(RECOVERY_KEY);}catch{}
    if(recoverable){
      const url=new URL(window.location.href);
      url.searchParams.set('_khe_reload',Date.now().toString());
      window.location.replace(url.toString());
      return;
    }
    reset();
  };

  return(
    <html lang="fr">
      <body style={{margin:0,minHeight:'100vh',display:'grid',placeItems:'center',background:'#070a0f',color:'#f8fafc',fontFamily:'Inter,system-ui,sans-serif',padding:'24px'}}>
        <main style={{width:'min(520px,100%)',border:'1px solid #334155',borderRadius:'24px',padding:'28px',background:'#111722',boxSizing:'border-box'}}>
          <p style={{margin:'0 0 10px',color:'#e2b84f',fontWeight:900,letterSpacing:'.12em'}}>KHE BOOTH</p>
          <h1 style={{margin:'0 0 12px',fontSize:'clamp(28px,7vw,44px)'}}>Reconnexion en cours</h1>
          <p style={{margin:'0 0 22px',color:'#aeb8c8',lineHeight:1.55}}>
            {recovering?'Une version récente de KHE Booth est en cours de chargement.':'Le navigateur a interrompu le chargement. Relancez la page pour reprendre sans perdre vos données.'}
          </p>
          <button type="button" onClick={retry} style={{width:'100%',border:0,borderRadius:'16px',padding:'15px 18px',fontSize:'17px',fontWeight:900,background:'#e2b84f',color:'#111',cursor:'pointer'}}>
            Recharger KHE Booth
          </button>
        </main>
      </body>
    </html>
  );
}
