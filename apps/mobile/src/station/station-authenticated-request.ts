import * as SecureStore from 'expo-secure-store';
import type { StationApi } from '../api/station-api';
import { API_BASE_URL } from '../config';

const STATION_TOKEN_KEY='khe.station.token.v1';

async function currentToken(fallback:string):Promise<string>{return (await SecureStore.getItemAsync(STATION_TOKEN_KEY))||fallback;}

async function execute<T>(token:string,path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(`${API_BASE_URL.replace(/\/$/,'')}${path}`,{
    ...init,
    headers:{Accept:'application/json','Content-Type':'application/json',...(init?.headers??{}),Authorization:`Bearer ${token}`},
  });
  if(!response.ok){
    let message=`HTTP ${response.status}`;
    try{const payload=await response.json() as {message?:string|string[]};message=Array.isArray(payload.message)?payload.message.join(', '):payload.message||message;}catch{}
    const error=new Error(message) as Error&{status?:number};error.status=response.status;throw error;
  }
  if(response.status===204)return undefined as T;
  return await response.json() as T;
}

/** Authenticated station request that follows token renewal/switches kept in SecureStore. */
export async function stationAuthenticatedRequest<T>(api:StationApi,stationToken:string,path:string,init?:RequestInit):Promise<T>{
  let token=await currentToken(stationToken);
  try{return await execute<T>(token,path,init);}catch(error){
    if((error as {status?:number}).status!==401)throw error;
    // HttpStationApi performs the supported station-token renewal path and persists the replacement token.
    await api.manifest(stationToken);
    token=await currentToken(stationToken);
    return execute<T>(token,path,init);
  }
}
