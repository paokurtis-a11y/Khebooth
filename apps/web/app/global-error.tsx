'use client';

import { useEffect, useMemo, useState } from 'react';

type GlobalErrorProps={
  error:Error&{digest?:string};
  reset:()=>void;
};

const RECOVERY_KEY='khe.web.chunk-recovery.v2';

function isStaleModuleError(error:Error):boolean{
  const name=error.name.toLowerCase();
  const message=error.message.toLowerCase();
  if(name==='chunkloaderror')return true;
  return /loading chunk [^ ]+ failed|failed to load chunk|dynamically imported module|importing a module script failed|unable to preload css/.test(message);
}

export default function GlobalError({error,reset}:GlobalErrorProps){
  const[recovering,setRecovering]=useState(false);
  const recoverable=useMemo(()=>isStaleModuleError(error),[error]);

  useEffect(()=>{
    console.error('[khe:web:global-error]',{name:error.name,message:error.message,digest:error.digest,recoverable});
    if(!recoverable)return;
    const signature=`${error.name}:${error.message}`;
    const url=new URL(window.location.href);
    let alreadyAttempted=url.searchParams.has('_khe_reload');
    try{
      if(window.sessionStorage.getItem(RECOVERY_KEY)===signature)alreadyAttempted=true;
      else window.sessionStorage.setItem(RECOVERY_KEY,signature);
    }catch{
      // The URL marker also prevents loops when sessionStorage is unavailable.
    }
    if(alreadyAttempted)return;
    setRecovering(true);
    url.searchParams.set('_khe_reload',Date.now().toString());
    window.location.replace(url.toString());
  },[error,recoverable]);

  const retry=()=>{
    if(!recoverable){
      reset();
      return;
    }
    try{window.sessionStorage.removeItem(RECOVERY_KEY);}catch{}
    const url=new URL(window.location.href);
    url.searchParams.set('_khe_reload',Date.now().toString());
    window.location.replace(url.toString());
  };

  return(
    <html lang="fr">
      <body style={{margin:0,minHeight:'100dvh',display:'grid',placeItems:'center',background:'#070a0f',color:'#f8fafc',fontFamily:'Inter,system-ui,sans-serif',padding:'24px'}}>
        <main style={{width:'min(520px,100%)',border:'1px solid #334155',borderRadius:'24px',padding:'28px',background:'#111722',boxSizing:'border-box'}}>
          <p style={{margin:'0 0 10px',color:'#e2b84f',fontWeight:900,letterSpacing:'.12em'}}>KHE BOOTH</p>
          <h1 style={{margin:'0 0 12px',fontSize:'clamp(28px,7vw,44px)',lineHeight:1.08}}>
            {recoverable?'Mise à jour de KHE Booth':'Une erreur est survenue'}
          </h1>
          <p style={{margin:'0 0 22px',color:'#aeb8c8',lineHeight:1.55}}>
            {recoverable
              ? recovering?'La nouvelle version se charge automatiquement.':'La version de cette page a changé. Relancez-la une seule fois pour continuer.'
              :'Cette page a rencontré un problème temporaire. Réessayez sans fermer votre session.'}
          </p>
          <button type="button" onClick={retry} disabled={recovering} style={{width:'100%',border:0,borderRadius:'16px',padding:'15px 18px',fontSize:'17px',fontWeight:900,background:'#e2b84f',color:'#111',cursor:recovering?'wait':'pointer',opacity:recovering?.72:1}}>
            {recovering?'Chargement…':'Réessayer'}
          </button>
        </main>
      </body>
    </html>
  );
}
