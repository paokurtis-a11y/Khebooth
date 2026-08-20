'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Feedback={rating:number;comment?:string|null};
type Payload={resolved:boolean;feedback:Feedback|null};

export function SupportFeedbackPrompt(){
  const[conversationId,setConversationId]=useState<string|null>(null);const[open,setOpen]=useState(false);const[rating,setRating]=useState(0);const[comment,setComment]=useState('');const[message,setMessage]=useState('');const[saving,setSaving]=useState(false);
  useEffect(()=>{const params=new URLSearchParams(window.location.search);const id=params.get('conversation');if(params.get('feedback')==='1'&&id){setConversationId(id);setOpen(true);apiRequest<Payload>(`/operations/support-feedback/${id}`).then(data=>{if(data.feedback){setRating(data.feedback.rating);setComment(data.feedback.comment??'');}}).catch(()=>undefined);}},[]);
  async function save(){if(!conversationId||rating<1)return;setSaving(true);setMessage('');try{await apiRequest(`/operations/support-feedback/${conversationId}`,{method:'POST',body:JSON.stringify({rating,comment})});setMessage('Merci. Votre avis a bien été enregistré.');window.setTimeout(()=>setOpen(false),1200);}catch(e){setMessage(e instanceof Error?e.message:'Avis impossible à enregistrer');}finally{setSaving(false);}}
  if(!open||!conversationId)return null;
  return <div role="dialog" aria-modal="true" aria-label="Noter votre assistance KHE" style={{position:'fixed',inset:0,zIndex:1600,background:'rgba(0,0,0,.76)',display:'grid',placeItems:'center',padding:20}}><section className="card" style={{maxWidth:560,width:'100%',border:'1px solid rgba(210,173,79,.55)'}}><div className="eyebrow">KHE • QUALITÉ SUPPORT</div><h2>Comment s’est passée votre assistance ?</h2><p className="muted">Votre problème a été marqué comme résolu. Notez l’agent KHE et partagez un commentaire si vous le souhaitez.</p><div style={{display:'flex',gap:8,fontSize:34,margin:'18px 0'}}>{[1,2,3,4,5].map(value=><button key={value} type="button" aria-label={`${value} étoile${value>1?'s':''}`} onClick={()=>setRating(value)} style={{border:0,background:'transparent',padding:2,cursor:'pointer',color:value<=rating?'#d2ad4f':'#59616d'}}>★</button>)}</div><textarea className="input" rows={4} maxLength={1500} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Votre avis sur la prise en charge…"/>{message?<p className={message.startsWith('Merci')?'success':'error'}>{message}</p>:null}<div style={{display:'flex',gap:9,marginTop:12,flexWrap:'wrap'}}><button className="button" disabled={saving||rating<1} onClick={()=>void save()}>{saving?'Enregistrement…':'Envoyer mon avis'}</button><button className="button secondary" disabled={saving} onClick={()=>setOpen(false)}>Plus tard</button></div></section></div>;
}
