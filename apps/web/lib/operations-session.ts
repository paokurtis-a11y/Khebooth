'use client';

import { apiRequest } from './api';

const SESSION_KEY='khe.operations.session';
const LOCATION_KEY='khe.operations.location-sharing';

export function getOperationsSessionKey(){
  if(typeof window==='undefined')return'';
  let value=window.sessionStorage.getItem(SESSION_KEY);
  if(!value){value=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;window.sessionStorage.setItem(SESSION_KEY,value);}
  return value;
}

export function getApproximateLocationSharing(){
  if(typeof window==='undefined')return false;
  return window.localStorage.getItem(LOCATION_KEY)==='true';
}

export function setApproximateLocationSharing(enabled:boolean){
  if(typeof window==='undefined')return;
  window.localStorage.setItem(LOCATION_KEY,String(enabled));
}

export async function endOperationsSession(){
  const sessionKey=getOperationsSessionKey();
  if(!sessionKey)return;
  try{await apiRequest('/operations/session/end',{method:'POST',body:JSON.stringify({sessionKey})});}catch{/* Presence expires automatically if the network is unavailable. */}
}
