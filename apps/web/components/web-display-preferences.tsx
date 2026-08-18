'use client';

import { useEffect } from 'react';

export type WebTextScale='SMALL'|'NORMAL'|'LARGE'|'XLARGE';
export type WebTextStyle='CLASSIC'|'MODERN'|'ELEGANT'|'COMFORT';
export type WebDisplayPreferences={textScale:WebTextScale;textStyle:WebTextStyle};

export const DEFAULT_WEB_DISPLAY:WebDisplayPreferences={textScale:'NORMAL',textStyle:'MODERN'};
export const WEB_DISPLAY_KEY='khe.web.display.v1';

const scales:Record<WebTextScale,number>={SMALL:.92,NORMAL:1,LARGE:1.12,XLARGE:1.24};
const fonts:Record<WebTextStyle,string>={
  CLASSIC:'Georgia, Times New Roman, serif',
  MODERN:'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  ELEGANT:'Palatino Linotype, Book Antiqua, Palatino, Georgia, serif',
  COMFORT:'Verdana, Geneva, Tahoma, ui-sans-serif, sans-serif',
};

export function normalizeWebDisplay(value:unknown):WebDisplayPreferences{
  if(!value||typeof value!=='object')return DEFAULT_WEB_DISPLAY;
  const raw=value as Partial<WebDisplayPreferences>;
  const textScale:WebTextScale=['SMALL','NORMAL','LARGE','XLARGE'].includes(String(raw.textScale))?raw.textScale as WebTextScale:'NORMAL';
  const textStyle:WebTextStyle=['CLASSIC','MODERN','ELEGANT','COMFORT'].includes(String(raw.textStyle))?raw.textStyle as WebTextStyle:'MODERN';
  return{textScale,textStyle};
}

export function loadWebDisplayPreferences():WebDisplayPreferences{
  if(typeof window==='undefined')return DEFAULT_WEB_DISPLAY;
  try{return normalizeWebDisplay(JSON.parse(window.localStorage.getItem(WEB_DISPLAY_KEY)||'{}'));}catch{return DEFAULT_WEB_DISPLAY;}
}

export function applyWebDisplayPreferences(preferences:WebDisplayPreferences):void{
  if(typeof document==='undefined')return;
  document.documentElement.dataset.kheTextScale=preferences.textScale;
  document.documentElement.dataset.kheTextStyle=preferences.textStyle;
  document.documentElement.style.setProperty('--khe-user-scale',String(scales[preferences.textScale]));
  document.body.style.setProperty('zoom',String(scales[preferences.textScale]));
  document.body.style.fontFamily=fonts[preferences.textStyle];
}

export function saveWebDisplayPreferences(preferences:WebDisplayPreferences):void{
  if(typeof window==='undefined')return;
  window.localStorage.setItem(WEB_DISPLAY_KEY,JSON.stringify(preferences));
  applyWebDisplayPreferences(preferences);
  window.dispatchEvent(new CustomEvent('khe-display-changed',{detail:preferences}));
}

export function WebDisplayPreferenceBootstrap(){
  useEffect(()=>{applyWebDisplayPreferences(loadWebDisplayPreferences());},[]);
  return null;
}
