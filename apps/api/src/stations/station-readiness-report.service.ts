import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedStation } from './station-auth.types';
import { PrismaService } from '../prisma/prisma.service';

export interface StationReadinessReportInput {
  batteryPercent?: number|null;
  charging?: boolean;
  lowPowerMode?: boolean;
  freeDiskBytes?: number;
  totalDiskBytes?: number;
  networkType?: string|null;
  networkConnected?: boolean|null;
  internetReachable?: boolean|null;
  printerConfirmed?: boolean|null;
  printerTestedAt?: string|null;
  cameraPermission?: 'GRANTED'|'DENIED'|'BLOCKED'|null;
  microphonePermission?: 'GRANTED'|'DENIED'|'BLOCKED'|null;
  photoTestPassed?: boolean|null;
  photoTestedAt?: string|null;
  videoTestPassed?: boolean|null;
  videoTestedAt?: string|null;
  guestQrConfirmed?: boolean|null;
  guestQrTestedAt?: string|null;
}

type ReadinessMetadata=Record<string,unknown>;

@Injectable()
export class StationReadinessReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(station: AuthenticatedStation, input: StationReadinessReportInput) {
    const numberOrNull=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):null;
    const enumOrNull=(value:unknown,values:readonly string[])=>typeof value==='string'&&values.includes(value)?value:null;
    const dateOrNull=(value:unknown)=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value))?value:null;
    const previous=await this.prisma.auditLog.findFirst({where:{organizationId:station.organizationId,action:'STATION_READINESS_REPORT',entityType:'StationSession',entityId:station.sessionId},orderBy:{createdAt:'desc'},select:{metadata:true}});
    const prior=(previous?.metadata??{}) as ReadinessMetadata;
    const preserve=(key:string,value:unknown)=>value===undefined?prior[key]??null:value;
    const batteryPercent=input.batteryPercent===undefined?preserve('batteryPercent',undefined):input.batteryPercent===null?null:numberOrNull(input.batteryPercent,0,100);
    const freeDiskBytes=input.freeDiskBytes===undefined?preserve('freeDiskBytes',undefined):numberOrNull(input.freeDiskBytes,0,Number.MAX_SAFE_INTEGER);
    const totalDiskBytes=input.totalDiskBytes===undefined?preserve('totalDiskBytes',undefined):numberOrNull(input.totalDiskBytes,0,Number.MAX_SAFE_INTEGER);
    if(typeof freeDiskBytes==='number'&&typeof totalDiskBytes==='number'&&freeDiskBytes>totalDiskBytes)throw new BadRequestException('Invalid disk telemetry');
    const reportedAt=new Date();
    const metadata={
      mode:station.mode,
      eventId:station.eventId,
      deviceId:station.deviceId,
      batteryPercent,
      charging:input.charging===undefined?preserve('charging',undefined):input.charging,
      lowPowerMode:input.lowPowerMode===undefined?preserve('lowPowerMode',undefined):input.lowPowerMode,
      freeDiskBytes,
      totalDiskBytes,
      networkType:input.networkType===undefined?preserve('networkType',undefined):typeof input.networkType==='string'?input.networkType.slice(0,40):null,
      networkConnected:input.networkConnected===undefined?preserve('networkConnected',undefined):input.networkConnected,
      internetReachable:input.internetReachable===undefined?preserve('internetReachable',undefined):input.internetReachable,
      printerConfirmed:input.printerConfirmed===undefined?preserve('printerConfirmed',undefined):input.printerConfirmed,
      printerTestedAt:input.printerTestedAt===undefined?preserve('printerTestedAt',undefined):dateOrNull(input.printerTestedAt),
      cameraPermission:input.cameraPermission===undefined?preserve('cameraPermission',undefined):enumOrNull(input.cameraPermission,['GRANTED','DENIED','BLOCKED']),
      microphonePermission:input.microphonePermission===undefined?preserve('microphonePermission',undefined):enumOrNull(input.microphonePermission,['GRANTED','DENIED','BLOCKED']),
      photoTestPassed:input.photoTestPassed===undefined?preserve('photoTestPassed',undefined):input.photoTestPassed,
      photoTestedAt:input.photoTestedAt===undefined?preserve('photoTestedAt',undefined):dateOrNull(input.photoTestedAt),
      videoTestPassed:input.videoTestPassed===undefined?preserve('videoTestPassed',undefined):input.videoTestPassed,
      videoTestedAt:input.videoTestedAt===undefined?preserve('videoTestedAt',undefined):dateOrNull(input.videoTestedAt),
      guestQrConfirmed:input.guestQrConfirmed===undefined?preserve('guestQrConfirmed',undefined):input.guestQrConfirmed,
      guestQrTestedAt:input.guestQrTestedAt===undefined?preserve('guestQrTestedAt',undefined):dateOrNull(input.guestQrTestedAt),
      reportedAt:reportedAt.toISOString(),
    };
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'STATION_READINESS_REPORT',entityType:'StationSession',entityId:station.sessionId,metadata}});
    return{accepted:true,reportedAt};
  }
}
