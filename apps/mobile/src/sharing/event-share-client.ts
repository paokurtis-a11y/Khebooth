import type { StationExperienceApi } from '../api/station-api';
import { stationAuthenticatedRequest } from '../station/station-authenticated-request';

export interface EventShareContract{id:string;eventId:string;eventName:string;shareUrl:string;createdAt:string|Date;reused:boolean;}
export function createEventShare(api:StationExperienceApi,token:string){return stationAuthenticatedRequest<EventShareContract>(api,token,'/stations/event-share',{method:'POST'});}
export function revokeEventShare(api:StationExperienceApi,token:string,id:string){return stationAuthenticatedRequest<{id:string;revoked:boolean}>(api,token,`/stations/event-share/${encodeURIComponent(id)}/revoke`,{method:'POST'});}
