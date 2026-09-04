import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus, StationMode } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import type { AuthenticatedStation, StationTokenPayload } from './station-auth.types';
import type { CreateClientEventDto } from './dto/create-client-event.dto';

const STATION_SESSION_TTL_SECONDS = 24 * 60 * 60;
const SWITCH_OVERLAP_SECONDS = 5 * 60;

type ClientContextRow={clientId:string|null;subscriptionPlan:string|null;subscriptionStatus:string|null;paymentStatus:string|null};
type WorkspaceRow={clientId:string;organizationId:string;selectedEventId:string|null;designConfig:unknown;designReadyAt:Date|null;updatedAt:Date};
type EventRow={id:string;name:string;description:string|null;startsAt:Date;endsAt:Date|null;status:string;clientId:string|null;createdAt:Date;updatedAt:Date};
type EventDesignRow={eventId:string;designConfig:unknown;designReadyAt:Date|null;updatedAt:Date};
type AccessSnapshot={entitlements:Record<string,boolean>};

@Injectable()
export class ClientEventWorkspaceService{
  constructor(private readonly prisma:PrismaService,private readonly jwt:JwtService,private readonly events:EventsService,private readonly entitlements:EntitlementsService){}

  private async context(station:AuthenticatedStation):Promise<ClientContextRow>{
    const rows=await this.prisma.$queryRaw<ClientContextRow[]>`
      SELECT e."clientId" AS "clientId",c."subscriptionPlan",c."subscriptionStatus",c."paymentStatus"
      FROM "Event" e LEFT JOIN "Client" c ON c.id=e."clientId"
      WHERE e.id=${station.eventId}::uuid AND e."organizationId"=${station.organizationId}::uuid LIMIT 1
    `;
    if(!rows[0]?.clientId)throw new ForbiddenException('Cette station n’est pas liée à un client KHE.');
    return rows[0];
  }

  private assertSharing(station:AuthenticatedStation){if(station.mode!==StationMode.SHARING)throw new ForbiddenException('Cette action est disponible depuis la régie SHARING.');}

  private enforceBranding(value:unknown,access:AccessSnapshot):Record<string,unknown>{
    const design=value&&typeof value==='object'&&!Array.isArray(value)?{...(value as Record<string,unknown>)}:{};
    if(!access.entitlements.REMOVE_KHE_BRANDING)design.showKheBranding=true;
    else if(typeof design.showKheBranding!=='boolean')design.showKheBranding=true;
    return design;
  }

  private async ensureWorkspace(station:AuthenticatedStation,clientId:string){
    await this.prisma.$executeRaw`
      INSERT INTO "ClientWorkspaceState" ("clientId","organizationId","selectedEventId","designReadyAt","updatedAt")
      VALUES (${clientId}::uuid,${station.organizationId}::uuid,${station.eventId}::uuid,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT ("clientId") DO NOTHING
    `;
  }

  private async eventDesign(organizationId:string,eventId:string):Promise<EventDesignRow|null>{
    const rows=await this.prisma.$queryRaw<EventDesignRow[]>`
      SELECT "eventId","designConfig","designReadyAt","updatedAt" FROM "EventDesignConfiguration"
      WHERE "organizationId"=${organizationId}::uuid AND "eventId"=${eventId}::uuid LIMIT 1
    `;
    return rows[0]??null;
  }

  async design(station:AuthenticatedStation,eventId:string){
    const context=await this.context(station);const clientId=context.clientId!;
    const target=await this.prisma.event.findFirst({where:{id:eventId,organizationId:station.organizationId,clientId},select:{id:true}});
    if(!target)throw new NotFoundException('Événement client introuvable.');
    const [design,access]=await Promise.all([this.eventDesign(station.organizationId,eventId),this.entitlements.forEvent(station.organizationId,eventId)]);
    return{eventId,designConfig:this.enforceBranding(design?.designConfig??{},access),designReadyAt:design?.designReadyAt??null,updatedAt:design?.updatedAt??null};
  }

  private async upsertEventDesign(organizationId:string,clientId:string,eventId:string,designConfig:Record<string,unknown>,readyAt:Date|null){
    const serialized=JSON.stringify(designConfig);
    await this.prisma.$executeRaw`
      INSERT INTO "EventDesignConfiguration" ("organizationId","clientId","eventId","designConfig","designReadyAt","updatedAt")
      VALUES (${organizationId}::uuid,${clientId}::uuid,${eventId}::uuid,${serialized}::jsonb,${readyAt},CURRENT_TIMESTAMP)
      ON CONFLICT ("eventId") DO UPDATE SET "designConfig"=EXCLUDED."designConfig","designReadyAt"=EXCLUDED."designReadyAt","updatedAt"=CURRENT_TIMESTAMP
    `;
  }

  async workspace(station:AuthenticatedStation){
    await this.events.completeEndedEvents(station.organizationId);
    const context=await this.context(station);const clientId=context.clientId!;await this.ensureWorkspace(station,clientId);
    const rows=await this.prisma.$queryRaw<WorkspaceRow[]>`
      SELECT "clientId","organizationId","selectedEventId","designConfig","designReadyAt","updatedAt"
      FROM "ClientWorkspaceState" WHERE "clientId"=${clientId}::uuid AND "organizationId"=${station.organizationId}::uuid LIMIT 1
    `;
    const state=rows[0];
    const selected=state?.selectedEventId?await this.prisma.$queryRaw<EventRow[]>`
      SELECT id,name,description,"startsAt","endsAt",status::text AS status,"clientId","createdAt","updatedAt"
      FROM "Event" WHERE id=${state.selectedEventId}::uuid AND "organizationId"=${station.organizationId}::uuid AND "clientId"=${clientId}::uuid LIMIT 1
    `:[];
    const events=await this.prisma.$queryRaw<EventRow[]>`
      SELECT id,name,description,"startsAt","endsAt",status::text AS status,"clientId","createdAt","updatedAt"
      FROM "Event" WHERE "organizationId"=${station.organizationId}::uuid AND "clientId"=${clientId}::uuid AND status<>'ARCHIVED'::"EventStatus"
      ORDER BY "startsAt" DESC LIMIT 100
    `;
    const access=await this.entitlements.forEvent(station.organizationId,station.eventId);
    const selectedEvent=selected[0]??null;
    const design=selectedEvent?await this.eventDesign(station.organizationId,selectedEvent.id):null;
    const rawDesign=design?.designConfig??state?.designConfig??{};
    const readyAt=design?.designReadyAt??state?.designReadyAt??null;
    return{
      clientId,
      plan:access.plan,
      entitlements:access.entitlements,
      currentEventId:station.eventId,
      selectedEvent,
      designConfig:this.enforceBranding(rawDesign,access),
      designReadyAt:readyAt,
      shouldSwitch:Boolean(selectedEvent&&readyAt&&selectedEvent.id!==station.eventId),
      events,
    };
  }

  async createEvent(station:AuthenticatedStation,dto:CreateClientEventDto){
    this.assertSharing(station);const context=await this.context(station);const clientId=context.clientId!;
    const access=await this.entitlements.requireStation(station,'SHARING');
    const name=dto.name.trim();const description=dto.description.trim();const startsAt=new Date(dto.startsAt);const endsAt=new Date(dto.endsAt);
    if(!name||!description)throw new BadRequestException('Nom et description sont obligatoires.');
    if(Number.isNaN(startsAt.getTime())||Number.isNaN(endsAt.getTime()))throw new BadRequestException('Le début et la fin sont obligatoires et doivent être des dates valides.');
    if(endsAt<=startsAt)throw new BadRequestException('La date de fin doit être après le début.');
    if(endsAt<=new Date())throw new BadRequestException('La date de fin doit être dans le futur.');

    const studioAllowed=Boolean(access.entitlements.STUDIO_BASIC);
    const readyAt=studioAllowed?null:new Date();
    const initialStatus=studioAllowed?EventStatus.DRAFT:EventStatus.READY;
    const event=await this.prisma.event.create({data:{organizationId:station.organizationId,clientId,name,description,startsAt,endsAt,status:initialStatus}});
    const defaultDesign=this.enforceBranding({},access);
    if(!studioAllowed)await this.upsertEventDesign(station.organizationId,clientId,event.id,defaultDesign,readyAt);
    const serialized=JSON.stringify(defaultDesign);
    await this.prisma.$executeRaw`
      INSERT INTO "ClientWorkspaceState" ("clientId","organizationId","selectedEventId","designConfig","designReadyAt","updatedAt")
      VALUES (${clientId}::uuid,${station.organizationId}::uuid,${event.id}::uuid,${serialized}::jsonb,${readyAt},CURRENT_TIMESTAMP)
      ON CONFLICT ("clientId") DO UPDATE SET "selectedEventId"=EXCLUDED."selectedEventId","designConfig"=EXCLUDED."designConfig","designReadyAt"=EXCLUDED."designReadyAt","updatedAt"=CURRENT_TIMESTAMP
    `;
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'CLIENT_EVENT_CREATED_FROM_SHARING',entityType:'Event',entityId:event.id,metadata:{clientId,stationSessionId:station.sessionId,plan:access.plan,nextStep:studioAllowed?'STUDIO':'READY'}}});
    return{event:{...event,status:initialStatus},plan:access.plan,entitlements:access.entitlements,nextStep:studioAllowed?'STUDIO':'READY'};
  }

  async markDesignReady(station:AuthenticatedStation,eventId:string,payload:Record<string,unknown>){
    const context=await this.context(station);const clientId=context.clientId!;
    const target=await this.prisma.event.findFirst({where:{id:eventId,organizationId:station.organizationId,clientId}});
    if(!target)throw new NotFoundException('Événement client introuvable.');
    const access=await this.entitlements.forEvent(station.organizationId,eventId);
    if(!access.entitlements.STUDIO_BASIC)throw new ForbiddenException('Votre abonnement ne donne pas accès au Studio créatif.');
    const rawDesign=payload.designConfig&&typeof payload.designConfig==='object'&&!Array.isArray(payload.designConfig)?payload.designConfig:{};
    const designConfig=this.enforceBranding(rawDesign,access);
    const serialized=JSON.stringify(designConfig);if(serialized.length>100_000)throw new BadRequestException('Le design est trop volumineux.');
    const now=new Date();const nextStatus=target.endsAt&&target.endsAt<=now?EventStatus.COMPLETED:EventStatus.READY;
    await this.prisma.$transaction([
      this.prisma.event.update({where:{id:eventId},data:{status:nextStatus}}),
      this.prisma.$executeRaw`
        INSERT INTO "EventDesignConfiguration" ("organizationId","clientId","eventId","designConfig","designReadyAt","updatedAt")
        VALUES (${station.organizationId}::uuid,${clientId}::uuid,${eventId}::uuid,${serialized}::jsonb,${now},CURRENT_TIMESTAMP)
        ON CONFLICT ("eventId") DO UPDATE SET "designConfig"=EXCLUDED."designConfig","designReadyAt"=EXCLUDED."designReadyAt","updatedAt"=CURRENT_TIMESTAMP
      `,
      this.prisma.$executeRaw`
        INSERT INTO "ClientWorkspaceState" ("clientId","organizationId","selectedEventId","designConfig","designReadyAt","updatedAt")
        VALUES (${clientId}::uuid,${station.organizationId}::uuid,${eventId}::uuid,${serialized}::jsonb,${now},CURRENT_TIMESTAMP)
        ON CONFLICT ("clientId") DO UPDATE SET "selectedEventId"=EXCLUDED."selectedEventId","designConfig"=EXCLUDED."designConfig","designReadyAt"=EXCLUDED."designReadyAt","updatedAt"=CURRENT_TIMESTAMP
      `,
    ]);
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'CLIENT_EVENT_DESIGN_READY',entityType:'Event',entityId:eventId,metadata:{clientId,stationSessionId:station.sessionId,mode:station.mode,showKheBranding:designConfig.showKheBranding!==false}}});
    return this.workspace(station);
  }

  async selectEvent(station:AuthenticatedStation,eventId:string){
    this.assertSharing(station);const context=await this.context(station);const clientId=context.clientId!;await this.ensureWorkspace(station,clientId);
    const target=await this.prisma.event.findFirst({where:{id:eventId,organizationId:station.organizationId,clientId}});
    if(!target)throw new NotFoundException('Événement client introuvable.');
    if(target.status===EventStatus.ARCHIVED||target.status===EventStatus.COMPLETED||(target.endsAt&&target.endsAt<=new Date()))throw new BadRequestException('Cet événement est terminé ou archivé.');
    let design=await this.eventDesign(station.organizationId,eventId);
    if(!design){
      if(target.status===EventStatus.DRAFT)throw new ForbiddenException('Terminez et enregistrez le design avant d’ouvrir cet événement.');
      const access=await this.entitlements.forEvent(station.organizationId,eventId);
      const fallback=this.enforceBranding({},access);const readyAt=new Date();
      await this.upsertEventDesign(station.organizationId,clientId,eventId,fallback,readyAt);
      design={eventId,designConfig:fallback,designReadyAt:readyAt,updatedAt:readyAt};
    }
    if(!design.designReadyAt)throw new ForbiddenException('Cet événement n’est pas encore prêt pour les stations.');
    const access=await this.entitlements.forEvent(station.organizationId,eventId);
    const safeDesign=this.enforceBranding(design.designConfig,access);const serialized=JSON.stringify(safeDesign);
    await this.prisma.$executeRaw`
      UPDATE "ClientWorkspaceState" SET "selectedEventId"=${eventId}::uuid,"designConfig"=${serialized}::jsonb,"designReadyAt"=${design.designReadyAt},"updatedAt"=CURRENT_TIMESTAMP
      WHERE "clientId"=${clientId}::uuid AND "organizationId"=${station.organizationId}::uuid
    `;
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'CLIENT_EVENT_SELECTED_FROM_SHARING',entityType:'Event',entityId:eventId,metadata:{clientId,stationSessionId:station.sessionId}}});
    return this.workspace(station);
  }

  async switchEvent(station:AuthenticatedStation,eventId:string){
    const context=await this.context(station);const clientId=context.clientId!;await this.ensureWorkspace(station,clientId);
    const states=await this.prisma.$queryRaw<WorkspaceRow[]>`
      SELECT "clientId","organizationId","selectedEventId","designConfig","designReadyAt","updatedAt" FROM "ClientWorkspaceState"
      WHERE "clientId"=${clientId}::uuid AND "organizationId"=${station.organizationId}::uuid LIMIT 1
    `;
    const state=states[0];
    if(!state||state.selectedEventId!==eventId||!state.designReadyAt)throw new ForbiddenException('Cet événement n’est pas encore prêt pour les stations.');
    const target=await this.prisma.event.findFirst({where:{id:eventId,organizationId:station.organizationId,clientId}});
    if(!target)throw new NotFoundException('Événement client introuvable.');
    if(target.endsAt&&target.endsAt<=new Date())throw new BadRequestException('Cet événement est déjà terminé.');
    const design=await this.eventDesign(station.organizationId,eventId);
    const access=await this.entitlements.forEvent(station.organizationId,eventId);
    const designConfig=this.enforceBranding(design?.designConfig??state.designConfig,access);
    const now=new Date();let next=await this.prisma.stationSession.findFirst({where:{organizationId:station.organizationId,eventId,deviceId:station.deviceId,mode:station.mode,revokedAt:null,expiresAt:{gt:now}},orderBy:{createdAt:'desc'}});
    if(!next){next=await this.prisma.stationSession.create({data:{organizationId:station.organizationId,eventId,deviceId:station.deviceId,activationId:null,mode:station.mode,expiresAt:new Date(Date.now()+STATION_SESSION_TTL_SECONDS*1000)}});}
    await this.prisma.stationSession.updateMany({where:{id:station.sessionId,expiresAt:{gt:new Date(Date.now()+SWITCH_OVERLAP_SECONDS*1000)}},data:{expiresAt:new Date(Date.now()+SWITCH_OVERLAP_SECONDS*1000)}});
    const payload:StationTokenPayload={typ:'station',sessionId:next.id,organizationId:next.organizationId,eventId:next.eventId,deviceId:next.deviceId,mode:next.mode};
    const stationToken=await this.jwt.signAsync(payload,{subject:next.id,expiresIn:STATION_SESSION_TTL_SECONDS});
    const manifest=await this.events.manifest(station.organizationId,eventId);
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'STATION_EVENT_AUTO_SWITCHED',entityType:'StationSession',entityId:next.id,metadata:{fromEventId:station.eventId,toEventId:eventId,mode:station.mode,deviceId:station.deviceId}}});
    return{stationToken,session:{id:next.id,organizationId:next.organizationId,eventId:next.eventId,deviceId:next.deviceId,mode:next.mode,expiresAt:next.expiresAt},manifest,designConfig};
  }
}
