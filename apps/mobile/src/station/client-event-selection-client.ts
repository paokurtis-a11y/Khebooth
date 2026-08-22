import type { ClientWorkspaceContract, StationExperienceApi } from '../api/station-api';
import { stationAuthenticatedRequest } from './station-authenticated-request';

export function selectClientEvent(api:StationExperienceApi,stationToken:string,eventId:string):Promise<ClientWorkspaceContract>{
  return stationAuthenticatedRequest<ClientWorkspaceContract>(api,stationToken,`/stations/client-events/${encodeURIComponent(eventId)}/select`,{method:'POST'});
}
