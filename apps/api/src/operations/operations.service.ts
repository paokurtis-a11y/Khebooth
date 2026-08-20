import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export type GeoContext = {
  countryCode?: string | null;
  regionCode?: string | null;
  municipality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
};

type PresenceRow = {
  userId:string; activeSessionKey:string|null; availability:string; acceptingAssignments:boolean;
  lastHeartbeatAt:Date|null; availableSince:Date|null; countryCode:string|null; regionCode:string|null;
  municipality:string|null; latitude:number|null; longitude:number|null; timezone:string|null; locationSharingEnabled:boolean;
};

type StrategyConfig = {
  organizationId:string; enabled:boolean; analysisWindowDays:number; highIntentScore:number;
  regularClientMinSessions:number; regularClientMinActiveDays:number; regularClientMinMinutes:number;
  geoSegmentationEnabled:boolean; anonymousAnalyticsEnabled:boolean; personalizedNurtureEnabled:boolean;
  autoPromotionEnabled:boolean; ownerApprovalForPaidCampaigns:boolean; strategyNotes:string|null; updatedAt:Date;
};

const AGENT_ROLES = new Set(['OWNER','ADMIN','OPERATOR']);

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAgent(user:AuthenticatedUser){return AGENT_ROLES.has(String(user.role));}
  private sessionKey(value:unknown){const key=String(value??'').trim().slice(0,160);if(key.length<8)throw new BadRequestException('Session invalide');return key;}
  private safeSurface(value:unknown){const surface=String(value??'WEB_PORTAL').toUpperCase();return ['WEB_PORTAL','MOBILE_APP','ADMIN'].includes(surface)?surface:'WEB_PORTAL';}
  private geoValue(share:boolean,value:string|number|null|undefined){return share?value??null:null;}

  async heartbeat(user:AuthenticatedUser, body:Record<string,unknown>, geo:GeoContext, userAgent?:string|null){
    const sessionKey=this.sessionKey(body.sessionKey);const surface=this.safeSurface(body.surface);const share=body.shareApproximateLocation===true;
    const pageViews=Math.min(20,Math.max(0,Math.trunc(Number(body.pageViews??0))));const actions=Math.min(50,Math.max(0,Math.trunc(Number(body.actions??0))));
    const clientRows=await this.prisma.$queryRaw<Array<{managedClientId:string|null}>>`SELECT "managedClientId" FROM "User" WHERE id=${user.id}::uuid LIMIT 1`;
    const clientId=clientRows[0]?.managedClientId??null;
    await this.prisma.$executeRaw`
      INSERT INTO "UserActivitySession" (id,"organizationId","userId","clientId","sessionKey",surface,"startedAt","lastSeenAt","pageViews",actions,"countryCode","regionCode",municipality,latitude,longitude,timezone,"locationSharingEnabled","userAgent")
      VALUES (gen_random_uuid(),${user.organizationId}::uuid,${user.id}::uuid,${clientId}::uuid,${sessionKey},${surface},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,${pageViews},${actions},
        ${this.geoValue(share,geo.countryCode)},${this.geoValue(share,geo.regionCode)},${this.geoValue(share,geo.municipality)},${this.geoValue(share,geo.latitude)},${this.geoValue(share,geo.longitude)},${this.geoValue(share,geo.timezone)},${share},${String(userAgent??'').slice(0,500)||null})
      ON CONFLICT ("userId","sessionKey") DO UPDATE SET "lastSeenAt"=CURRENT_TIMESTAMP,"pageViews"="UserActivitySession"."pageViews"+EXCLUDED."pageViews",actions="UserActivitySession".actions+EXCLUDED.actions,
        "countryCode"=CASE WHEN EXCLUDED."locationSharingEnabled" THEN EXCLUDED."countryCode" ELSE "UserActivitySession"."countryCode" END,
        "regionCode"=CASE WHEN EXCLUDED."locationSharingEnabled" THEN EXCLUDED."regionCode" ELSE "UserActivitySession"."regionCode" END,
        municipality=CASE WHEN EXCLUDED."locationSharingEnabled" THEN EXCLUDED.municipality ELSE "UserActivitySession".municipality END,
        latitude=CASE WHEN EXCLUDED."locationSharingEnabled" THEN EXCLUDED.latitude ELSE "UserActivitySession".latitude END,
        longitude=CASE WHEN EXCLUDED."locationSharingEnabled" THEN EXCLUDED.longitude ELSE "UserActivitySession".longitude END,
        timezone=CASE WHEN EXCLUDED."locationSharingEnabled" THEN EXCLUDED.timezone ELSE "UserActivitySession".timezone END,
        "locationSharingEnabled"="UserActivitySession"."locationSharingEnabled" OR EXCLUDED."locationSharingEnabled"
    `;
    if(this.isAgent(user)){
      const current=await this.prisma.$queryRaw<PresenceRow[]>`SELECT * FROM "AgentPresence" WHERE "userId"=${user.id}::uuid LIMIT 1`;
      const newSession=!current[0]||current[0].activeSessionKey!==sessionKey;
      await this.prisma.$executeRaw`
        INSERT INTO "AgentPresence" ("userId","organizationId","activeSessionKey",availability,"acceptingAssignments","lastHeartbeatAt","countryCode","regionCode",municipality,latitude,longitude,timezone,"locationSharingEnabled","locationUpdatedAt")
        VALUES (${user.id}::uuid,${user.organizationId}::uuid,${sessionKey},'UNAVAILABLE',FALSE,CURRENT_TIMESTAMP,
          ${this.geoValue(share,geo.countryCode)},${this.geoValue(share,geo.regionCode)},${this.geoValue(share,geo.municipality)},${this.geoValue(share,geo.latitude)},${this.geoValue(share,geo.longitude)},${this.geoValue(share,geo.timezone)},${share},${share?new Date():null})
        ON CONFLICT ("userId") DO UPDATE SET "activeSessionKey"=${sessionKey},"lastHeartbeatAt"=CURRENT_TIMESTAMP,
          availability=CASE WHEN "AgentPresence"."activeSessionKey" IS DISTINCT FROM ${sessionKey} THEN 'UNAVAILABLE' ELSE "AgentPresence".availability END,
          "acceptingAssignments"=CASE WHEN "AgentPresence"."activeSessionKey" IS DISTINCT FROM ${sessionKey} THEN FALSE ELSE "AgentPresence"."acceptingAssignments" END,
          "availableSince"=CASE WHEN "AgentPresence"."activeSessionKey" IS DISTINCT FROM ${sessionKey} THEN NULL ELSE "AgentPresence"."availableSince" END,
          "countryCode"=CASE WHEN ${share} THEN ${geo.countryCode??null} ELSE "AgentPresence"."countryCode" END,
          "regionCode"=CASE WHEN ${share} THEN ${geo.regionCode??null} ELSE "AgentPresence"."regionCode" END,
          municipality=CASE WHEN ${share} THEN ${geo.municipality??null} ELSE "AgentPresence".municipality END,
          latitude=CASE WHEN ${share} THEN ${geo.latitude??null} ELSE "AgentPresence".latitude END,
          longitude=CASE WHEN ${share} THEN ${geo.longitude??null} ELSE "AgentPresence".longitude END,
          timezone=CASE WHEN ${share} THEN ${geo.timezone??null} ELSE "AgentPresence".timezone END,
          "locationSharingEnabled"="AgentPresence"."locationSharingEnabled" OR ${share},"locationUpdatedAt"=CASE WHEN ${share} THEN CURRENT_TIMESTAMP ELSE "AgentPresence"."locationUpdatedAt" END,"updatedAt"=CURRENT_TIMESTAMP
      `;
      if(newSession)await this.prisma.$executeRaw`
        INSERT INTO "AgentAvailabilityEvent" (id,"organizationId","userId","sessionKey",availability,"acceptingAssignments",source,"countryCode","regionCode",municipality)
        VALUES (gen_random_uuid(),${user.organizationId}::uuid,${user.id}::uuid,${sessionKey},'UNAVAILABLE',FALSE,'LOGIN_SESSION',${this.geoValue(share,geo.countryCode)},${this.geoValue(share,geo.regionCode)},${this.geoValue(share,geo.municipality)})
      `;
    }
    return this.presenceMe(user);
  }

  async setAvailability(user:AuthenticatedUser,body:Record<string,unknown>,geo:GeoContext){
    if(!this.isAgent(user))throw new ForbiddenException('Disponibilité réservée aux agents KHE');
    const sessionKey=this.sessionKey(body.sessionKey);const requested=String(body.availability??(body.available===true?'AVAILABLE':'UNAVAILABLE')).toUpperCase();
    if(!['AVAILABLE','BUSY','AWAY','UNAVAILABLE'].includes(requested))throw new BadRequestException('Statut de disponibilité invalide');
    const accepting=requested==='AVAILABLE';const share=body.shareApproximateLocation===true;
    await this.prisma.$executeRaw`
      INSERT INTO "AgentPresence" ("userId","organizationId","activeSessionKey",availability,"acceptingAssignments","lastHeartbeatAt","availableSince","countryCode","regionCode",municipality,latitude,longitude,timezone,"locationSharingEnabled","locationUpdatedAt")
      VALUES (${user.id}::uuid,${user.organizationId}::uuid,${sessionKey},${requested},${accepting},CURRENT_TIMESTAMP,${accepting?new Date():null},
        ${this.geoValue(share,geo.countryCode)},${this.geoValue(share,geo.regionCode)},${this.geoValue(share,geo.municipality)},${this.geoValue(share,geo.latitude)},${this.geoValue(share,geo.longitude)},${this.geoValue(share,geo.timezone)},${share},${share?new Date():null})
      ON CONFLICT ("userId") DO UPDATE SET "activeSessionKey"=${sessionKey},availability=${requested},"acceptingAssignments"=${accepting},"lastHeartbeatAt"=CURRENT_TIMESTAMP,
        "availableSince"=CASE WHEN ${accepting} THEN COALESCE("AgentPresence"."availableSince",CURRENT_TIMESTAMP) ELSE NULL END,
        "countryCode"=CASE WHEN ${share} THEN ${geo.countryCode??null} ELSE "AgentPresence"."countryCode" END,
        "regionCode"=CASE WHEN ${share} THEN ${geo.regionCode??null} ELSE "AgentPresence"."regionCode" END,
        municipality=CASE WHEN ${share} THEN ${geo.municipality??null} ELSE "AgentPresence".municipality END,
        latitude=CASE WHEN ${share} THEN ${geo.latitude??null} ELSE "AgentPresence".latitude END,
        longitude=CASE WHEN ${share} THEN ${geo.longitude??null} ELSE "AgentPresence".longitude END,
        timezone=CASE WHEN ${share} THEN ${geo.timezone??null} ELSE "AgentPresence".timezone END,
        "locationSharingEnabled"="AgentPresence"."locationSharingEnabled" OR ${share},"locationUpdatedAt"=CASE WHEN ${share} THEN CURRENT_TIMESTAMP ELSE "AgentPresence"."locationUpdatedAt" END,"updatedAt"=CURRENT_TIMESTAMP
    `;
    await this.prisma.$executeRaw`
      INSERT INTO "AgentAvailabilityEvent" (id,"organizationId","userId","sessionKey",availability,"acceptingAssignments",source,"countryCode","regionCode",municipality)
      VALUES (gen_random_uuid(),${user.organizationId}::uuid,${user.id}::uuid,${sessionKey},${requested},${accepting},'AGENT_ACTION',${this.geoValue(share,geo.countryCode)},${this.geoValue(share,geo.regionCode)},${this.geoValue(share,geo.municipality)})
    `;
    return this.presenceMe(user);
  }

  async presenceMe(user:AuthenticatedUser){
    if(!this.isAgent(user))return{isAgent:false,online:true,availability:'NOT_APPLICABLE',acceptingAssignments:false,requiresAvailabilityConfirmation:false};
    const rows=await this.prisma.$queryRaw<PresenceRow[]>`SELECT * FROM "AgentPresence" WHERE "userId"=${user.id}::uuid LIMIT 1`;
    const row=rows[0];const online=Boolean(row?.lastHeartbeatAt&&Date.now()-new Date(row.lastHeartbeatAt).getTime()<90000);
    return {isAgent:true,online,availability:row?.availability??'UNAVAILABLE',acceptingAssignments:Boolean(row?.acceptingAssignments&&online),requiresAvailabilityConfirmation:!row?.acceptingAssignments||row?.availability!=='AVAILABLE',lastHeartbeatAt:row?.lastHeartbeatAt??null,availableSince:row?.availableSince??null,locationSharingEnabled:row?.locationSharingEnabled??false,location:{countryCode:row?.countryCode??null,regionCode:row?.regionCode??null,municipality:row?.municipality??null,latitude:row?.latitude??null,longitude:row?.longitude??null,timezone:row?.timezone??null}};
  }

  async endSession(user:AuthenticatedUser,body:Record<string,unknown>){
    const sessionKey=this.sessionKey(body.sessionKey);
    await this.prisma.$executeRaw`UPDATE "UserActivitySession" SET "endedAt"=CURRENT_TIMESTAMP,"lastSeenAt"=CURRENT_TIMESTAMP WHERE "userId"=${user.id}::uuid AND "sessionKey"=${sessionKey} AND "endedAt" IS NULL`;
    if(this.isAgent(user)){
      await this.prisma.$executeRaw`UPDATE "AgentPresence" SET availability='UNAVAILABLE',"acceptingAssignments"=FALSE,"availableSince"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${user.id}::uuid AND "activeSessionKey"=${sessionKey}`;
      await this.prisma.$executeRaw`INSERT INTO "AgentAvailabilityEvent" (id,"organizationId","userId","sessionKey",availability,"acceptingAssignments",source) VALUES (gen_random_uuid(),${user.organizationId}::uuid,${user.id}::uuid,${sessionKey},'UNAVAILABLE',FALSE,'LOGOUT')`;
    }
    return{ended:true};
  }

  async listAgents(user:AuthenticatedUser){
    const rows=await this.prisma.$queryRaw<any[]>`
      SELECT u.id,u.email,u."firstName",u."lastName",u.role::text AS role,u."isActive",
        p.availability,p."acceptingAssignments",p."lastHeartbeatAt",p."availableSince",p."countryCode",p."regionCode",p.municipality,p.latitude,p.longitude,p.timezone,p."locationSharingEnabled",
        COALESCE(s.sessions,0)::int AS "connectionCount",COALESCE(s.seconds,0)::bigint AS "totalConnectedSeconds",s."lastLoginAt",
        COALESCE(c.assigned,0)::int AS "conversationAssignments",COALESCE(c.resolved,0)::int AS "resolvedProblems",
        COALESCE(t.assigned,0)::int AS "taskAssignments",COALESCE(t.completed,0)::int AS "completedTasks",
        COALESCE(a.failed,0)::int AS "failedAssignments",COALESCE(f.reviews,0)::int AS "reviewCount",f.rating AS "averageRating"
      FROM "User" u
      LEFT JOIN "AgentPresence" p ON p."userId"=u.id
      LEFT JOIN LATERAL (SELECT count(*) sessions,COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE("endedAt","lastSeenAt")-"startedAt"))),0) seconds,max("startedAt") "lastLoginAt" FROM "UserActivitySession" WHERE "userId"=u.id) s ON TRUE
      LEFT JOIN LATERAL (SELECT count(*) FILTER(WHERE "assignedToUserId"=u.id) assigned,count(*) FILTER(WHERE "assignedToUserId"=u.id AND status='RESOLVED') resolved FROM "SupportConversation" WHERE "organizationId"=u."organizationId") c ON TRUE
      LEFT JOIN LATERAL (SELECT count(*) FILTER(WHERE "assignedToUserId"=u.id) assigned,count(*) FILTER(WHERE "assignedToUserId"=u.id AND status='DONE') completed FROM "SupportTask" WHERE "organizationId"=u."organizationId") t ON TRUE
      LEFT JOIN LATERAL (SELECT count(*) FILTER(WHERE "agentUserId"=u.id AND status='FAILED') failed FROM "SupportAssignmentAttempt" WHERE "organizationId"=u."organizationId") a ON TRUE
      LEFT JOIN LATERAL (SELECT count(*) reviews,round(avg(rating)::numeric,2)::float8 rating FROM "SupportFeedback" WHERE "agentUserId"=u.id) f ON TRUE
      WHERE u."organizationId"=${user.organizationId}::uuid AND u."isActive"=TRUE AND u.role IN ('OWNER','ADMIN','OPERATOR')
      ORDER BY COALESCE(p."acceptingAssignments",FALSE) DESC,p."lastHeartbeatAt" DESC NULLS LAST,u.email ASC
    `;
    return rows.map(row=>({...row,online:Boolean(row.lastHeartbeatAt&&Date.now()-new Date(row.lastHeartbeatAt).getTime()<90000),available:Boolean(row.acceptingAssignments&&row.availability==='AVAILABLE'&&row.lastHeartbeatAt&&Date.now()-new Date(row.lastHeartbeatAt).getTime()<90000),totalConnectedSeconds:Number(row.totalConnectedSeconds||0),averageRating:row.averageRating===null?null:Number(row.averageRating)}));
  }

  async agentHistory(user:AuthenticatedUser,agentId:string){
    const exists=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "User" WHERE id=${agentId}::uuid AND "organizationId"=${user.organizationId}::uuid AND role IN ('OWNER','ADMIN','OPERATOR') LIMIT 1`;
    if(!exists[0])throw new NotFoundException('Agent introuvable');
    const [sessions,availability,assignments,feedback]=await Promise.all([
      this.prisma.$queryRaw<any[]>`SELECT id,"sessionKey",surface,"startedAt","lastSeenAt","endedAt","pageViews",actions,"countryCode","regionCode",municipality,timezone FROM "UserActivitySession" WHERE "userId"=${agentId}::uuid ORDER BY "startedAt" DESC LIMIT 100`,
      this.prisma.$queryRaw<any[]>`SELECT id,availability,"acceptingAssignments",source,"countryCode","regionCode",municipality,"createdAt" FROM "AgentAvailabilityEvent" WHERE "userId"=${agentId}::uuid ORDER BY "createdAt" DESC LIMIT 150`,
      this.prisma.$queryRaw<any[]>`SELECT id,"conversationId","taskId","assignmentType",status,reason,score,"createdAt","completedAt" FROM "SupportAssignmentAttempt" WHERE "agentUserId"=${agentId}::uuid ORDER BY "createdAt" DESC LIMIT 150`,
      this.prisma.$queryRaw<any[]>`SELECT id,"conversationId",rating,comment,"createdAt" FROM "SupportFeedback" WHERE "agentUserId"=${agentId}::uuid ORDER BY "createdAt" DESC LIMIT 100`,
    ]);
    return{sessions,availability,assignments,feedback};
  }

  async getStrategy(organizationId:string):Promise<StrategyConfig>{
    await this.prisma.$executeRaw`INSERT INTO "GrowthStrategyConfig" ("organizationId") VALUES (${organizationId}::uuid) ON CONFLICT ("organizationId") DO NOTHING`;
    const rows=await this.prisma.$queryRaw<StrategyConfig[]>`SELECT * FROM "GrowthStrategyConfig" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;
    return rows[0];
  }

  async updateStrategy(organizationId:string,body:Record<string,unknown>){
    await this.getStrategy(organizationId);
    const days=Math.min(365,Math.max(7,Math.trunc(Number(body.analysisWindowDays??30))));const intent=Math.min(100,Math.max(1,Math.trunc(Number(body.highIntentScore??60))));
    const sessions=Math.min(100,Math.max(1,Math.trunc(Number(body.regularClientMinSessions??5))));const activeDays=Math.min(100,Math.max(1,Math.trunc(Number(body.regularClientMinActiveDays??3))));const minutes=Math.min(100000,Math.max(1,Math.trunc(Number(body.regularClientMinMinutes??60))));
    await this.prisma.$executeRaw`
      UPDATE "GrowthStrategyConfig" SET enabled=${body.enabled!==false},"analysisWindowDays"=${days},"highIntentScore"=${intent},"regularClientMinSessions"=${sessions},"regularClientMinActiveDays"=${activeDays},"regularClientMinMinutes"=${minutes},
        "geoSegmentationEnabled"=${body.geoSegmentationEnabled!==false},"anonymousAnalyticsEnabled"=${body.anonymousAnalyticsEnabled!==false},"personalizedNurtureEnabled"=${body.personalizedNurtureEnabled!==false},"autoPromotionEnabled"=${body.autoPromotionEnabled===true},
        "ownerApprovalForPaidCampaigns"=${body.ownerApprovalForPaidCampaigns!==false},"strategyNotes"=${body.strategyNotes===undefined?null:String(body.strategyNotes).slice(0,3000)},"updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=${organizationId}::uuid
    `;
    return this.getStrategy(organizationId);
  }

  async clientsOverview(user:AuthenticatedUser){
    const config=await this.getStrategy(user.organizationId);
    const rows=await this.prisma.$queryRaw<any[]>`
      SELECT c.id,c.name,c.email,c.phone,c."companyName",c."createdAt",c."archivedAt",
        COALESCE(us.sessions,0)::int "connectionCount",COALESCE(us.days,0)::int "activeDays",COALESCE(us.seconds,0)::bigint "totalConnectedSeconds",us."lastSeenAt",us."lastCountryCode",us."lastRegionCode",us."lastMunicipality",
        COALESCE(ev.events,0)::int "eventCount",COALESCE(st.sessions,0)::int "stationSessionCount",COALESCE(ma.actions,0)::int "trackedActions"
      FROM "Client" c
      LEFT JOIN LATERAL (
        SELECT count(*) sessions,count(DISTINCT "startedAt"::date) days,COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE("endedAt","lastSeenAt")-"startedAt"))),0) seconds,max("lastSeenAt") "lastSeenAt",
          (array_agg("countryCode" ORDER BY "lastSeenAt" DESC) FILTER(WHERE "countryCode" IS NOT NULL))[1] "lastCountryCode",
          (array_agg("regionCode" ORDER BY "lastSeenAt" DESC) FILTER(WHERE "regionCode" IS NOT NULL))[1] "lastRegionCode",
          (array_agg(municipality ORDER BY "lastSeenAt" DESC) FILTER(WHERE municipality IS NOT NULL))[1] "lastMunicipality"
        FROM "UserActivitySession" WHERE "clientId"=c.id
      ) us ON TRUE
      LEFT JOIN LATERAL (SELECT count(*) events FROM "Event" WHERE "clientId"=c.id) ev ON TRUE
      LEFT JOIN LATERAL (SELECT count(*) sessions FROM "StationSession" ss JOIN "Event" e ON e.id=ss."eventId" WHERE e."clientId"=c.id) st ON TRUE
      LEFT JOIN LATERAL (SELECT count(*) actions FROM "MarketingAnalyticsEvent" WHERE "clientId"=c.id) ma ON TRUE
      WHERE c."organizationId"=${user.organizationId}::uuid
      ORDER BY COALESCE(us.sessions,0) DESC,COALESCE(ev.events,0) DESC,c."createdAt" DESC
      LIMIT 500
    `;
    return rows.map(row=>{const totalSeconds=Number(row.totalConnectedSeconds||0);const regular=Number(row.connectionCount)>=config.regularClientMinSessions&&Number(row.activeDays)>=config.regularClientMinActiveDays&&totalSeconds>=config.regularClientMinMinutes*60;return{...row,totalConnectedSeconds:totalSeconds,regular,engagementScore:Math.min(100,Math.round(Number(row.connectionCount)*5+Number(row.eventCount)*12+Number(row.stationSessionCount)*2+Math.min(30,totalSeconds/3600*3)))}});
  }

  async visitorsOverview(user:AuthenticatedUser){
    const config=await this.getStrategy(user.organizationId);const days=config.analysisWindowDays;
    const [summary,geographies,visitors]=await Promise.all([
      this.prisma.$queryRaw<any[]>`SELECT count(*) FILTER(WHERE "eventType"='PAGE_VIEW')::int visits,count(DISTINCT "anonymousId") FILTER(WHERE "anonymousId" IS NOT NULL)::int visitors,count(*) FILTER(WHERE "eventType"='PLAN_SELECTED')::int "planSelections",count(*) FILTER(WHERE "eventType"='CHECKOUT_STARTED')::int checkouts,count(*) FILTER(WHERE "eventType"='CHECKOUT_COMPLETED')::int conversions FROM "MarketingAnalyticsEvent" WHERE "organizationId"=${user.organizationId}::uuid AND "createdAt">=CURRENT_TIMESTAMP-${days}*INTERVAL '1 day'`,
      this.prisma.$queryRaw<any[]>`SELECT "countryCode","regionCode",municipality,round(avg(latitude)::numeric,4)::float8 latitude,round(avg(longitude)::numeric,4)::float8 longitude,count(*)::int events,count(DISTINCT "anonymousId")::int visitors FROM "MarketingAnalyticsEvent" WHERE "organizationId"=${user.organizationId}::uuid AND consent=TRUE AND "countryCode" IS NOT NULL AND "createdAt">=CURRENT_TIMESTAMP-${days}*INTERVAL '1 day' GROUP BY "countryCode","regionCode",municipality ORDER BY visitors DESC,events DESC LIMIT 100`,
      this.prisma.$queryRaw<any[]>`SELECT left("anonymousId",8) "visitorKey",count(*)::int events,count(*) FILTER(WHERE "eventType"='PAGE_VIEW')::int visits,count(*) FILTER(WHERE "eventType"='PLAN_SELECTED')::int plans,count(*) FILTER(WHERE "eventType"='CHECKOUT_STARTED')::int checkouts,count(*) FILTER(WHERE "eventType"='CHECKOUT_COMPLETED')::int conversions,max("createdAt") "lastSeenAt",max("countryCode") "countryCode",max("regionCode") "regionCode",max(municipality) municipality FROM "MarketingAnalyticsEvent" WHERE "organizationId"=${user.organizationId}::uuid AND "anonymousId" IS NOT NULL AND "createdAt">=CURRENT_TIMESTAMP-${days}*INTERVAL '1 day' GROUP BY "anonymousId" ORDER BY checkouts DESC,plans DESC,visits DESC LIMIT 100`,
    ]);
    const scored=visitors.map(row=>{const score=Math.min(100,Number(row.visits)*8+Number(row.plans)*18+Number(row.checkouts)*35+Number(row.conversions)*50);return{...row,intentScore:score,highIntent:score>=config.highIntentScore};});
    const s=summary[0]??{visits:0,visitors:0,planSelections:0,checkouts:0,conversions:0};const highIntent=scored.filter(v=>v.highIntent).length;
    const recommendations:string[]=[];
    if(Number(s.visitors)>0&&Number(s.checkouts)/Math.max(1,Number(s.visitors))<0.08)recommendations.push('Renforcer les CTA et la preuve sociale entre découverte et choix d’offre.');
    if(highIntent>0)recommendations.push(`${highIntent} visiteur(s) à forte intention ont été détectés : privilégier une offre contextualisée et le rappel de la valeur avant toute remise.`);
    if(geographies[0])recommendations.push(`La zone ${[geographies[0].municipality,geographies[0].regionCode,geographies[0].countryCode].filter(Boolean).join(' · ')} concentre le plus d’activité consentie : adapter les contenus, devises et témoignages à cette zone.`);
    if(!recommendations.length)recommendations.push('Le volume actuel est encore faible : continuer la collecte consentie avant de modifier fortement le parcours commercial.');
    return{days,summary:s,highIntentVisitors:highIntent,geographies,visitors:scored,recommendations,strategy:config};
  }
}
