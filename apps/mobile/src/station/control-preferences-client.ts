import type { StationApi } from '../api/station-api';
import { stationAuthenticatedRequest } from './station-authenticated-request';

export type CaptureKind='PHOTO'|'VIDEO';
export type CaptureAspectRatio='9:16'|'1:1';
export type CaptureCountdownSeconds=0|3|5|10;
export interface StationControlPreferences{captureKind:CaptureKind;aspectRatio:CaptureAspectRatio;countdownSeconds:CaptureCountdownSeconds;updatedAt:string|Date;}
export type StationControlPreferencesPatch=Partial<Pick<StationControlPreferences,'captureKind'|'aspectRatio'|'countdownSeconds'>>;

export const DEFAULT_STATION_CONTROL_PREFERENCES: StationControlPreferences = {
  captureKind: 'VIDEO',
  aspectRatio: '9:16',
  countdownSeconds: 5,
  updatedAt: new Date(0).toISOString(),
};

export function getStationControlPreferences(api:StationApi,token:string){return stationAuthenticatedRequest<StationControlPreferences>(api,token,'/stations/control/preferences');}
export async function getStationControlPreferencesOrDefault(api:StationApi,token:string,fallback:StationControlPreferences=DEFAULT_STATION_CONTROL_PREFERENCES){
  try{return await getStationControlPreferences(api,token);}catch{return fallback;}
}
export function updateStationControlPreferencesFromSharing(api:StationApi,token:string,patch:StationControlPreferencesPatch){return stationAuthenticatedRequest<StationControlPreferences>(api,token,'/stations/control/preferences',{method:'PATCH',body:JSON.stringify(patch)});}
export function updateStationControlPreferencesFromCapture(api:StationApi,token:string,patch:StationControlPreferencesPatch){return stationAuthenticatedRequest<StationControlPreferences>(api,token,'/stations/control/preferences/status',{method:'PATCH',body:JSON.stringify(patch)});}
