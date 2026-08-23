import { Injectable, NotFoundException } from '@nestjs/common';
import { MediaSyncState, StationMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ONLINE_WINDOW_MS = 30_000;
const STALE_WINDOW_MS = 3 * 60_000;
const TELEMETRY_STALE_MS = 10 * 60_000;
const GIB = 1024 * 1024 * 1024;

export type CheckLevel = 'PASS' | 'WARN' | 'BLOCK' | 'INFO';
export interface ReadinessCheck { id: string; level: CheckLevel; detail: string; }
export interface Telemetry {
  batteryPercent?: number|null; charging?: boolean|null; lowPowerMode?: boolean|null;
  freeDiskBytes?: number|null; totalDiskBytes?: number|null; networkType?: string|null;
  networkConnected?: boolean|null; internetReachable?: boolean|null; printerConfirmed?: boolean|null;
  printerTestedAt?: string|null; reportedAt?: string|null;
}

@Injectable()
export class EventReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(organizationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({ where: { id: eventId, organizationId }, include: { preset: true } });
    if (!event) throw new NotFoundException('Event not found');

    const now = new Date();
    const [sessions, remote, queued, uploading, failed, synced] = await Promise.all([
      this.prisma.stationSession.findMany({where:{organizationId,eventId,revokedAt:null,expiresAt:{gt:now}},include:{device:{select:{id:true,name:true,platform:true,lastSeenAt:true}}},orderBy:{createdAt:'desc'}}),
      this.prisma.stationRemoteControl.findUnique({ where: { eventId } }),
      this.prisma.mediaAsset.count({ where: { organizationId, eventId, syncState: MediaSyncState.QUEUED } }),
      this.prisma.mediaAsset.count({ where: { organizationId, eventId, syncState: MediaSyncState.UPLOADING } }),
      this.prisma.mediaAsset.count({ where: { organizationId, eventId, syncState: MediaSyncState.FAILED } }),
      this.prisma.mediaAsset.count({ where: { organizationId, eventId, syncState: MediaSyncState.SYNCED } }),
    ]);
    const sessionIds=sessions.map(session=>session.id);
    const reportRows=sessionIds.length?await this.prisma.auditLog.findMany({where:{organizationId,action:'STATION_READINESS_REPORT',entityType:'StationSession',entityId:{in:sessionIds}},orderBy:{createdAt:'desc'},take:Math.max(20,sessionIds.length*8)}):[];
    const reportBySession=new Map<string,{metadata:Telemetry;createdAt:Date}>();
    for(const report of reportRows){if(report.entityId&&!reportBySession.has(report.entityId))reportBySession.set(report.entityId,{metadata:(report.metadata??{}) as Telemetry,createdAt:report.createdAt});}

    const stationItems = sessions.map((session) => {
      const ageMs = Math.max(0, now.getTime() - session.lastSeenAt.getTime());
      const report=reportBySession.get(session.id);const telemetry=report?.metadata??null;const telemetryAgeMs=report?Math.max(0,now.getTime()-report.createdAt.getTime()):null;
      return {id:session.id,mode:session.mode,deviceId:session.deviceId,deviceName:session.device.name,platform:session.device.platform,lastSeenAt:session.lastSeenAt,ageSeconds:Math.round(ageMs/1000),online:ageMs<=ONLINE_WINDOW_MS,stale:ageMs>STALE_WINDOW_MS,expiresAt:session.expiresAt,telemetry:telemetry&&telemetryAgeMs!==null&&telemetryAgeMs<=TELEMETRY_STALE_MS?telemetry:null,telemetryReportedAt:report?.createdAt??null};
    });

    const capture = stationItems.find((station) => station.mode === StationMode.CAPTURE) ?? null;
    const sharing = stationItems.find((station) => station.mode === StationMode.SHARING) ?? null;
    const pending = queued + uploading + failed;
    const checks: ReadinessCheck[] = [];
    checks.push({id:'studio',level:event.preset?'PASS':'WARN',detail:event.preset?`Preset ${event.preset.name} associé.`:'Aucun preset Studio associé à cet événement.'});
    checks.push(this.stationCheck('capture', capture));checks.push(this.stationCheck('sharing', sharing));
    checks.push({id:'sync',level:failed>0?'BLOCK':pending>0?'WARN':'PASS',detail:failed>0?`${failed} média(s) en échec de synchronisation.`:pending>0?`${pending} média(s) encore en transfert ou en attente.`:`${synced} média(s) synchronisé(s), aucun transfert en attente.`});
    const sharingStatus=remote?.sharingConnectionStatus??'DISCONNECTED';
    checks.push({id:'station-link',level:sharingStatus==='ACCEPTED'?'PASS':capture&&sharing?'WARN':'INFO',detail:sharingStatus==='ACCEPTED'?'Liaison CAPTURE ↔ SHARING acceptée.':capture&&sharing?`Les deux stations existent mais la liaison est ${sharingStatus.toLowerCase()}.`:'La liaison sera vérifiable lorsque les deux stations seront présentes.'});

    const freshTelemetry=stationItems.filter(station=>station.telemetry).map(station=>({mode:station.mode,telemetry:station.telemetry as Telemetry}));
    checks.push(this.batteryCheck(freshTelemetry));checks.push(this.storageCheck(freshTelemetry));checks.push(this.networkCheck(freshTelemetry));checks.push(this.printerCheck(freshTelemetry));
    for (const id of ['camera','microphone','test-photo','test-video','guest-qr']) checks.push({id,level:'INFO',detail:'À confirmer depuis KHE Event Ready sur la tablette concernée.'});

    const alerts:Array<{level:'warning'|'critical';code:string;message:string}>=[];
    for(const station of stationItems){if(station.stale)alerts.push({level:'critical',code:`STATION_${station.mode}_STALE`,message:`${station.mode} ne communique plus depuis plus de 3 minutes.`});else if(!station.online)alerts.push({level:'warning',code:`STATION_${station.mode}_QUIET`,message:`${station.mode} n’a pas communiqué depuis ${station.ageSeconds} secondes.`});const telemetry=station.telemetry;if(telemetry){if(typeof telemetry.batteryPercent==='number'&&telemetry.batteryPercent<20&&telemetry.charging!==true)alerts.push({level:'critical',code:`BATTERY_${station.mode}_LOW`,message:`${station.mode} : batterie ${telemetry.batteryPercent}% — branchez la tablette.`});else if(typeof telemetry.batteryPercent==='number'&&telemetry.batteryPercent<40&&telemetry.charging!==true)alerts.push({level:'warning',code:`BATTERY_${station.mode}_WARN`,message:`${station.mode} : batterie ${telemetry.batteryPercent}%.`});if(typeof telemetry.freeDiskBytes==='number'&&telemetry.freeDiskBytes<2*GIB)alerts.push({level:'critical',code:`STORAGE_${station.mode}_LOW`,message:`${station.mode} : moins de 2 Go de stockage libre.`});if(telemetry.networkConnected===false||telemetry.internetReachable===false)alerts.push({level:'warning',code:`NETWORK_${station.mode}_OFFLINE`,message:`${station.mode} : réseau ou Internet indisponible, capture offline conservée.`});}}
    if(failed>0)alerts.push({level:'critical',code:'SYNC_FAILED',message:`${failed} média(s) sont en échec de synchronisation.`});else if(pending>0)alerts.push({level:'warning',code:'SYNC_PENDING',message:`${pending} média(s) attendent encore la synchronisation.`});
    const state=checks.some(check=>check.level==='BLOCK')?'BLOCKED':checks.some(check=>check.level==='WARN')?'ATTENTION':'READY';
    return{generatedAt:now,event:{id:event.id,name:event.name,status:event.status,startsAt:event.startsAt,endsAt:event.endsAt},state,stations:stationItems,media:{queued,uploading,failed,synced,pending},remote:remote?{runtimeState:remote.runtimeState,captureSeenAt:remote.captureSeenAt,sharingConnectionStatus:remote.sharingConnectionStatus}:null,checks,alerts,recommendedAction:this.recommendedAction(checks,capture,sharing)};
  }

  private stationCheck(id:'capture'|'sharing',station:{online:boolean;stale:boolean;ageSeconds:number}|null):ReadinessCheck{const label=id.toUpperCase();if(!station)return{id,level:'BLOCK',detail:`Aucune station ${label} active pour cet événement.`};if(station.stale)return{id,level:'BLOCK',detail:`${label} n’a pas communiqué depuis plus de 3 minutes.`};if(!station.online)return{id,level:'WARN',detail:`${label} n’a pas communiqué depuis ${station.ageSeconds} secondes.`};return{id,level:'PASS',detail:`${label} communique avec KHE Cloud.`};}
  private batteryCheck(items:Array<{mode:string;telemetry:Telemetry}>):ReadinessCheck{const values=items.filter(item=>typeof item.telemetry.batteryPercent==='number');if(!values.length)return{id:'battery',level:'INFO',detail:'Ouvrez Event Ready sur les tablettes pour transmettre le niveau de batterie.'};let level:CheckLevel='PASS';for(const item of values){const p=item.telemetry.batteryPercent as number;if(item.telemetry.charging!==true&&p<20)level='BLOCK';else if(level!=='BLOCK'&&item.telemetry.charging!==true&&p<40)level='WARN';else if(level==='PASS'&&item.telemetry.lowPowerMode)level='WARN';}return{id:'battery',level,detail:values.map(item=>`${item.mode} ${item.telemetry.batteryPercent}%${item.telemetry.charging?' • branchée':''}`).join(' · ')};}
  private storageCheck(items:Array<{mode:string;telemetry:Telemetry}>):ReadinessCheck{const values=items.filter(item=>typeof item.telemetry.freeDiskBytes==='number');if(!values.length)return{id:'storage',level:'INFO',detail:'Ouvrez Event Ready sur les tablettes pour transmettre le stockage libre.'};let level:CheckLevel='PASS';for(const item of values){const free=item.telemetry.freeDiskBytes as number;if(free<2*GIB)level='BLOCK';else if(level!=='BLOCK'&&free<5*GIB)level='WARN';}return{id:'storage',level,detail:values.map(item=>`${item.mode} ${((item.telemetry.freeDiskBytes as number)/GIB).toFixed(1)} Go libres`).join(' · ')};}
  private networkCheck(items:Array<{mode:string;telemetry:Telemetry}>):ReadinessCheck{const values=items.filter(item=>item.telemetry.networkConnected!==undefined);if(!values.length)return{id:'network',level:'INFO',detail:'Ouvrez Event Ready sur les tablettes pour transmettre l’état réseau.'};const bad=values.filter(item=>item.telemetry.networkConnected===false||item.telemetry.internetReachable===false);return{id:'network',level:bad.length?'WARN':'PASS',detail:values.map(item=>`${item.mode} ${item.telemetry.networkType??'NETWORK'} ${item.telemetry.internetReachable===false?'• sans Internet':item.telemetry.networkConnected===false?'• hors réseau':'• connecté'}`).join(' · ')};}
  private printerCheck(items:Array<{mode:string;telemetry:Telemetry}>):ReadinessCheck{const confirmed=items.find(item=>item.telemetry.printerConfirmed===true);return confirmed?{id:'printer',level:'PASS',detail:`Test d’impression confirmé depuis ${confirmed.mode}.`}:{id:'printer',level:'INFO',detail:'Imprimante facultative : confirmez un test papier depuis Event Ready si elle est utilisée.'};}
  private recommendedAction(checks:ReadinessCheck[],capture:unknown,sharing:unknown){if(!capture)return'CONNECT_CAPTURE';if(!sharing)return'CONNECT_SHARING';if(checks.some(check=>check.id==='sync'&&check.level==='BLOCK'))return'RESCUE_SYNC';if(checks.some(check=>check.level==='BLOCK'||check.level==='WARN'))return'REVIEW_WARNINGS';return'RUN_TABLET_EVENT_READY';}
}
