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
}

@Injectable()
export class StationReadinessReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(station: AuthenticatedStation, input: StationReadinessReportInput) {
    const numberOrNull=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):null;
    const batteryPercent=input.batteryPercent==null?null:numberOrNull(input.batteryPercent,0,100);
    const freeDiskBytes=numberOrNull(input.freeDiskBytes,0,Number.MAX_SAFE_INTEGER);
    const totalDiskBytes=numberOrNull(input.totalDiskBytes,0,Number.MAX_SAFE_INTEGER);
    if(freeDiskBytes!==null&&totalDiskBytes!==null&&freeDiskBytes>totalDiskBytes)throw new BadRequestException('Invalid disk telemetry');
    const reportedAt=new Date();
    const metadata={
      mode:station.mode,
      eventId:station.eventId,
      deviceId:station.deviceId,
      batteryPercent,
      charging:typeof input.charging==='boolean'?input.charging:null,
      lowPowerMode:typeof input.lowPowerMode==='boolean'?input.lowPowerMode:null,
      freeDiskBytes,
      totalDiskBytes,
      networkType:typeof input.networkType==='string'?input.networkType.slice(0,40):null,
      networkConnected:typeof input.networkConnected==='boolean'?input.networkConnected:null,
      internetReachable:typeof input.internetReachable==='boolean'?input.internetReachable:null,
      printerConfirmed:typeof input.printerConfirmed==='boolean'?input.printerConfirmed:null,
      printerTestedAt:typeof input.printerTestedAt==='string'?input.printerTestedAt.slice(0,40):null,
      reportedAt:reportedAt.toISOString(),
    };
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'STATION_READINESS_REPORT',entityType:'StationSession',entityId:station.sessionId,metadata}});
    return{accepted:true,reportedAt};
  }
}
