import { API_BASE_URL } from '../config';

export interface SharingTrashItem {
  id: string;
  organizationId: string;
  eventId: string;
  displayName: string | null;
  mimeType: string;
  byteSize: number;
  capturedAt: string | null;
  trashedAt: string;
  trashExpiresAt: string;
}

async function request<T>(path:string,stationToken:string,init?:RequestInit):Promise<T>{
  const response=await fetch(`${API_BASE_URL.replace(/\/$/,'')}${path}`,{
    ...init,
    headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${stationToken}`,...(init?.headers??{})},
  });
  if(!response.ok){let message=`HTTP ${response.status}`;try{const body=await response.json() as{message?:string|string[]};message=Array.isArray(body.message)?body.message.join(', '):body.message||message;}catch{}throw new Error(message);}
  return response.json() as Promise<T>;
}

export function listSharingTrash(stationToken:string){return request<SharingTrashItem[]>('/stations/media-trash',stationToken);}
export function trashSharingMediaMany(stationToken:string,ids:string[]){return request<{count:number;retentionDays:number}>('/stations/media/trash',stationToken,{method:'POST',body:JSON.stringify({ids})});}
export function restoreSharingMedia(stationToken:string,id:string){return request<{id:string;displayName:string|null;restored:boolean}>(`/stations/media/${encodeURIComponent(id)}/restore`,stationToken,{method:'POST'});}
