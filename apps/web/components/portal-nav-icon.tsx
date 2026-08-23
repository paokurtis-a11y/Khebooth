export type PortalNavIconKey='home'|'clients'|'events'|'support'|'agent'|'operations'|'marketing'|'admin'|'settings'|'compliance';

export function PortalNavIcon({name}:{name:PortalNavIconKey}){
  const p={width:21,height:21,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  switch(name){
    case 'home': return <svg {...p}><path d="M3.5 10.5 12 3.8l8.5 6.7"/><path d="M5.5 9.2V20h13V9.2"/><path d="M9.5 20v-6h5v6"/></svg>;
    case 'clients': return <svg {...p}><circle cx="9" cy="8" r="3"/><path d="M3.8 19c.7-3.5 2.5-5.4 5.2-5.4s4.5 1.9 5.2 5.4"/><circle cx="17.2" cy="9" r="2.2"/><path d="M15.5 14.5c2.8-.3 4.5 1.2 5 4.1"/></svg>;
    case 'events': return <svg {...p}><rect x="3" y="5.5" width="18" height="15" rx="3"/><path d="M7 3.5v4M17 3.5v4M3 10h18"/><path d="m12 13 .7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z"/></svg>;
    case 'support': return <svg {...p}><path d="M5 17.5a8 8 0 1 1 14 0"/><path d="M4.5 13.5v3.3c0 1 .8 1.7 1.8 1.7H8v-6H6.3c-1 0-1.8.7-1.8 1.7M19.5 13.5v3.3c0 1-.8 1.7-1.8 1.7H16v-6h1.7c1 0 1.8.7 1.8 1.7"/><path d="M16 18.5c-.4 1.3-1.6 2-3.5 2"/></svg>;
    case 'agent': return <svg {...p}><circle cx="12" cy="8" r="3.3"/><path d="M5.2 20c.7-4.1 3-6.3 6.8-6.3s6.1 2.2 6.8 6.3"/><path d="m17.5 5.5 1 1 2-2"/></svg>;
    case 'operations': return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/></svg>;
    case 'marketing': return <svg {...p}><path d="M4 19V9M10 19V5M16 19v-7M3 19h18"/><path d="m4 7 5-4 5 4 6-5"/></svg>;
    case 'admin': return <svg {...p}><rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M8 4V2.8M16 4V2.8M7 9h10M7 13h4M7 16.5h7"/></svg>;
    case 'settings': return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.7-1.7l.9-1.9-2.1-2.1-1.9.9a7 7 0 0 0-1.7-.7l-.7-2h-3l-.7 2a7 7 0 0 0-1.7.7l-1.9-.9-2.1 2.1.9 1.9a7 7 0 0 0-.7 1.7l-2 .7v3l2 .7a7 7 0 0 0 .7 1.7l-.9 1.9 2.1 2.1 1.9-.9a7 7 0 0 0 1.7.7l.7 2h3l.7-2a7 7 0 0 0 1.7-.7l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .7-1.7z"/></svg>;
    case 'compliance': return <svg {...p}><path d="M12 3 5.5 5.6v5.6c0 4.2 2.5 7.3 6.5 9.8 4-2.5 6.5-5.6 6.5-9.8V5.6z"/><path d="m9 12 2 2 4-4"/></svg>;
  }
}
