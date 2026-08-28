'use client';

import { useRouter } from 'next/navigation';

export function HistoryBackLink({label,fallback='/'}:{label:string;fallback?:string}){
  const router=useRouter();
  return <button className="commercial-back" type="button" onClick={()=>{
    if(window.history.length>1)router.back();
    else router.push(fallback);
  }} aria-label={label}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/><path d="M8 12h12"/></svg>
    <span>{label}</span>
  </button>;
}
