'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EventReadyMonitor } from '@/components/event-ready-monitor';
import { PortalShell } from '@/components/portal-shell';

export default function EventReadyPage(){
  const params=useParams<{id:string}>();
  return <PortalShell>
    <div className="header" style={{marginBottom:18}}>
      <div><Link href={`/events/${params.id}`} className="muted">← Événement</Link><h1 style={{marginTop:10}}>Event Ready</h1><p>Préparation, supervision des stations et assistance prioritaire.</p></div>
      <Link href="/help" className="button secondary">Messagerie KHE</Link>
    </div>
    <EventReadyMonitor eventId={params.id}/>
  </PortalShell>;
}
