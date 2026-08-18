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

  private assertSharing(station:AuthenticatedStation){if(station.mode!==StationMode.SHARING)throw new ForbiddenException('La création d’événement client est disponible depuis la régie SHARING.');}

  private async ensureWorkspace(station:AuthenticatedStation,clientId:string){
    await this.prisma.$executeRaw`
      INSERT INTO "ClientWorkspaceState" ("clientId","organizationId","selectedEventId","designReadyAt","updatedAt")
      VALUES (${clientId}::uuid,${station.organizationId}::uuid,${station.eventId}::uuid,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT ("clientId") DO NOTHING
    `;
  }

  async workspace(station:AuthenticatedStation){
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
    return{
      clientId,
      plan:access.plan,
      entitlements:access.entitlements,
      currentEventId:station.eventId,
      selectedEvent,
      designConfig:state?.designConfig??{},
      designReadyAt:state?.designReadyAt??null,
      shouldSwitch:Boolean(selectedEvent&&state?.designReadyAt&&selectedEvent.id!==station.eventId),
      events,
    };
  }

  async createEvent(station:AuthenticatedStation,dto:CreateClientEventDto){
    this.assertSharing(station);const context=await this.context(station);const clientId=context.clientId!;
    const access=await this.entitlements.requireStation(station,'SHARING');
    const name=dto.name.trim();const description=dto.description.trim();const startsAt=new Date(dto.startsAt);const endsAt=new Date(dto.endsAt);
    if(!name||!description)throw new BadRequestException('Nom et description sont obligatoires.');
    if(Number.isNaN(startsAt.getTime())||Number.isNaN(endsAt.getTime()))throw new BadRequestException('Dates invalides.');
    if(endsAt<=startsAt)throw new BadRequestException('La date de fin doit être après la date de début.');
    if(endsAt<=new Date())throw new BadRequestException('La date de fin doit être dans le futur.');
    const event=await this.prisma.event.create({data:{organizationId:station.organizationId,clientId,name,description,startsAt,endsAt,status:EventStatus.DRAFT}});
    await this.prisma.$executeRaw`
      INSERT INTO "ClientWorkspaceState" ("clientId","organizationId","selectedEventId","designConfig","designReadyAt","updatedAt")
      VALUES (${clientId}::uuid,${station.organizationId}::uuid,${event.id}::uuid,'{}'::jsonb,NULL,CURRENT_TIMESTAMP)
      ON CONFLICT ("clientId") DO UPDATE SET "selectedEventId"=EXCLUDED."selectedEventId","designConfig"='{}'::jsonb,"designReadyAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP
    `;
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'CLIENT_EVENT_CREATED_FROM_SHARING',entityType:'Event',entityId:event.id,metadata:{clientId,stationSessionId:station.sessionId,plan:access.plan}}});
    return{event,plan:access.plan,entitlements:access.entitlements,nextStep:access.entitlements.STUDIO_BASIC?'STUDIO':'READY'};
  }

  async markDesignReady(station:AuthenticatedStation,eventId:string,payload:Record<string,unknown>){
    this.assertSharing(station);const context=await this.context(station);const clientId=context.clientId!;
    const target=await this.prisma.event.findFirst({where:{id:eventId,organizationId:station.organizationId,clientId}});
    if(!target)throw new NotFoundException('Événement client introuvable.');
    const access=await this.entitlements.forEvent(station.organizationId,station.eventId);
    if(!access.entitlements.STUDIO_BASIC)throw new ForbiddenException('Votre abonnement ne donne pas accès au Studio créatif.');
    const designConfig=payload.designConfig&&typeof payload.designConfig==='object'&&!Array.isArray(payload.designConfig)?payload.designConfig:{};
    const serialized=JSON.stringify(designConfig);if(serialized.length>100_000)throw new BadRequestException('Le design est trop volumineux.');
    const now=new Date();const nextStatus=target.endsAt&&target.endsAt<=now?EventStatus.COMPLETED:EventStatus.READY;
    await this.prisma.$transaction([
      this.prisma.event.update({where:{id:eventId},data:{status:nextStatus}}),
      this.prisma.$executeRaw`
        INSERT INTO "ClientWorkspaceState" ("clientId","organizationId","selectedEventId","designConfig","designReadyAt","updatedAt")
        VALUES (${clientId}::uuid,${station.organizationId}::uuid,${eventId}::uuid,${serialized}::jsonb,${now},CURRENT_TIMESTAMP)
        ON CONFLICT ("clientId") DO UPDATE SET "selectedEventId"=EXCLUDED."selectedEventId","designConfig"=EXCLUDED."designConfig","designReadyAt"=EXCLUDED."designReadyAt","updatedAt"=CURRENT_TIMESTAMP
      `,
    ]);
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'CLIENT_EVENT_DESIGN_READY',entityType:'Event',entityId:eventId,metadata:{clientId,stationSessionId:station.sessionId}}});
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

    const now=new Date();let next=await this.prisma.stationSession.findFirst({where:{organizationId:station.organizationId,eventId,deviceId:station.deviceId,mode:station.mode,revokedAt:null,expiresAt:{gt:now}},orderBy:{createdAt:'desc'}});
    if(!next){next=await this.prisma.stationSession.create({data:{organizationId:station.organizationId,eventId,deviceId:station.deviceId,activationId:null,mode:station.mode,expiresAt:new Date(Date.now()+STATION_SESSION_TTL_SECONDS*1000)}});}
    await this.prisma.stationSession.updateMany({where:{id:station.sessionId,expiresAt:{gt:new Date(Date.now()+SWITCH_OVERLAP_SECONDS*1000)}},data:{expiresAt:new Date(Date.now()+SWITCH_OVERLAP_SECONDS*1000)}});
    const payload:StationTokenPayload={typ:'station',sessionId:next.id,organizationId:next.organizationId,eventId:next.eventId,deviceId:next.deviceId,mode:next.mode};
    const stationToken=await this.jwt.signAsync(payload,{subject:next.id,expiresIn:STATION_SESSION_TTL_SECONDS});
    const manifest=await this.events.manifest(station.organizationId,eventId);
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'STATION_EVENT_AUTO_SWITCHED',entityType:'StationSession',entityId:next.id,metadata:{fromEventId:station.eventId,toEventId:eventId,mode:station.mode,deviceId:station.deviceId}}});
    return{stationToken,session:{id:next.id,organizationId:next.organizationId,eventId:next.eventId,deviceId:next.deviceId,mode:next.mode,expiresAt:next.expiresAt},manifest,designConfig:state.designConfig};
  }
}
