import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const SKILLS=['GENERAL','CAPTURE','SHARING','SYNC','PRINTING','ACCOUNT','BILLING','ENTERPRISE','KYC','CRM','MARKETING','SECURITY','EVENT_LIVE'] as const;
const LANGUAGES=['fr','en','de','it','es','pt','nl','ar'] as const;
const PRIORITIES=['CRITICAL','HIGH','NORMAL','LOW'] as const;

@Injectable()
export class RoutingIntelligenceService{
  constructor(private readonly prisma:PrismaService){}

  private number(value:unknown,min:number,max:number,fallback:number){const parsed=Math.trunc(Number(value));return Number.isFinite(parsed)?Math.min(max,Math.max(min,parsed)):fallback;}
  private list(value:unknown,allowed:readonly string[],upper=false){if(!Array.isArray(value))return[];const normalized=value.map(x=>upper?String(x).trim().toUpperCase():String(x).trim().toLowerCase()).filter(x=>allowed.includes(x));return [...new Set(normalized)].slice(0,30);}
  private timezone(value:unknown){const zone=String(value??'').trim().slice(0,80);if(!zone)return null;try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(new Date());return zone;}catch{throw new BadRequestException('Fuseau horaire invalide');}}
  private time(value:unknown){const v=String(value??'').trim();if(!v)return null;if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw new BadRequestException('Horaire invalide, format HH:MM attendu');return v;}

  async pulse(user:AuthenticatedUser){
    const rows=await this.prisma.$queryRaw<Array<{processed:number}>>`SELECT khe_process_support_sla(${user.organizationId}::uuid)::int processed`;
    return{processed:Number(rows[0]?.processed??0)};
  }

  async profiles(user:AuthenticatedUser){
    await this.prisma.$executeRaw`
      INSERT INTO "AgentRoutingProfile" ("userId","organizationId")
      SELECT id,"organizationId" FROM "User" WHERE "organizationId"=${user.organizationId}::uuid AND role IN ('OWNER','ADMIN','OPERATOR') AND "isActive"=TRUE
      ON CONFLICT ("userId") DO NOTHING
    `;
    const rows=await this.prisma.$queryRaw<any[]>`
      SELECT u.id,u.email,u."firstName",u."lastName",u.role::text role,
        rp.enabled,rp.skills,rp.languages,COALESCE(rp.timezone,p.timezone) timezone,rp."workingDays",rp."workStartLocal"::text "workStartLocal",rp."workEndLocal"::text "workEndLocal",
        rp."maxActiveConversations",rp."maxActiveTasks",rp."priorityBias",rp."updatedAt",
        p.availability,p."acceptingAssignments",p."lastHeartbeatAt",
        COALESCE(w.conversations,0)::int "activeConversations",COALESCE(w.tasks,0)::int "activeTasks",
        COALESCE(q.resolved,0)::int resolved,COALESCE(q.reviews,0)::int reviews,q.rating "averageRating"
      FROM "User" u
      LEFT JOIN "AgentRoutingProfile" rp ON rp."userId"=u.id
      LEFT JOIN "AgentPresence" p ON p."userId"=u.id
      LEFT JOIN LATERAL (
        SELECT (SELECT count(*) FROM "SupportConversation" c WHERE c."assignedToUserId"=u.id AND c.status<>'RESOLVED') conversations,
               (SELECT count(*) FROM "SupportTask" t WHERE t."assignedToUserId"=u.id AND t.status<>'DONE') tasks
      ) w ON TRUE
      LEFT JOIN LATERAL (
        SELECT (SELECT count(*) FROM "SupportConversation" c WHERE c."assignedToUserId"=u.id AND c.status='RESOLVED') resolved,
               (SELECT count(*) FROM "SupportFeedback" f WHERE f."agentUserId"=u.id) reviews,
               (SELECT round(avg(f.rating)::numeric,2)::float8 FROM "SupportFeedback" f WHERE f."agentUserId"=u.id) rating
      ) q ON TRUE
      WHERE u."organizationId"=${user.organizationId}::uuid AND u."isActive"=TRUE AND u.role IN ('OWNER','ADMIN','OPERATOR')
      ORDER BY u.email ASC
    `;
    return rows.map(row=>({...row,online:Boolean(row.lastHeartbeatAt&&Date.now()-new Date(row.lastHeartbeatAt).getTime()<90000),available:Boolean(row.acceptingAssignments&&row.availability==='AVAILABLE'&&row.lastHeartbeatAt&&Date.now()-new Date(row.lastHeartbeatAt).getTime()<90000),averageRating:row.averageRating===null?null:Number(row.averageRating)}));
  }

  async updateProfile(user:AuthenticatedUser,agentId:string,body:Record<string,unknown>){
    const agents=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "User" WHERE id=${agentId}::uuid AND "organizationId"=${user.organizationId}::uuid AND "isActive"=TRUE AND role IN ('OWNER','ADMIN','OPERATOR') LIMIT 1`;
    if(!agents[0])throw new NotFoundException('Agent introuvable');
    const skills=this.list(body.skills,SKILLS,true);const languages=this.list(body.languages,LANGUAGES,false);const timezone=this.timezone(body.timezone);
    const days=Array.isArray(body.workingDays)?[...new Set(body.workingDays.map(Number).filter(v=>Number.isInteger(v)&&v>=1&&v<=7))].sort((a,b)=>a-b):[];
    const workStart=this.time(body.workStartLocal);const workEnd=this.time(body.workEndLocal);
    const maxConv=this.number(body.maxActiveConversations,1,50,5);const maxTasks=this.number(body.maxActiveTasks,1,100,15);const bias=this.number(body.priorityBias,-50,50,0);
    await this.prisma.$executeRaw`
      INSERT INTO "AgentRoutingProfile" ("userId","organizationId",enabled,skills,languages,timezone,"workingDays","workStartLocal","workEndLocal","maxActiveConversations","maxActiveTasks","priorityBias","updatedAt")
      VALUES (${agentId}::uuid,${user.organizationId}::uuid,${body.enabled!==false},${skills}::text[],${languages.length?languages:['fr']}::text[],${timezone},${days}::int[],CAST(${workStart} AS time),CAST(${workEnd} AS time),${maxConv},${maxTasks},${bias},CURRENT_TIMESTAMP)
      ON CONFLICT ("userId") DO UPDATE SET enabled=EXCLUDED.enabled,skills=EXCLUDED.skills,languages=EXCLUDED.languages,timezone=EXCLUDED.timezone,"workingDays"=EXCLUDED."workingDays","workStartLocal"=EXCLUDED."workStartLocal","workEndLocal"=EXCLUDED."workEndLocal","maxActiveConversations"=EXCLUDED."maxActiveConversations","maxActiveTasks"=EXCLUDED."maxActiveTasks","priorityBias"=EXCLUDED."priorityBias","updatedAt"=CURRENT_TIMESTAMP
    `;
    return this.profiles(user);
  }

  async policy(organizationId:string){
    await this.prisma.$executeRaw`INSERT INTO "SupportRoutingPolicy" ("organizationId") VALUES (${organizationId}::uuid) ON CONFLICT ("organizationId") DO NOTHING`;
    const rows=await this.prisma.$queryRaw<any[]>`SELECT * FROM "SupportRoutingPolicy" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;
    return rows[0];
  }

  async updatePolicy(organizationId:string,body:Record<string,unknown>){
    const current=await this.policy(organizationId);const lang=String(body.defaultLanguage??current.defaultLanguage??'fr').toLowerCase();if(!LANGUAGES.includes(lang as any))throw new BadRequestException('Langue par défaut invalide');
    const values={
      criticalFirstResponseMinutes:this.number(body.criticalFirstResponseMinutes,1,1440,current.criticalFirstResponseMinutes),
      highFirstResponseMinutes:this.number(body.highFirstResponseMinutes,1,2880,current.highFirstResponseMinutes),
      normalFirstResponseMinutes:this.number(body.normalFirstResponseMinutes,1,10080,current.normalFirstResponseMinutes),
      lowFirstResponseMinutes:this.number(body.lowFirstResponseMinutes,1,20160,current.lowFirstResponseMinutes),
      criticalResolutionMinutes:this.number(body.criticalResolutionMinutes,5,10080,current.criticalResolutionMinutes),
      highResolutionMinutes:this.number(body.highResolutionMinutes,5,20160,current.highResolutionMinutes),
      normalResolutionMinutes:this.number(body.normalResolutionMinutes,5,43200,current.normalResolutionMinutes),
      lowResolutionMinutes:this.number(body.lowResolutionMinutes,5,86400,current.lowResolutionMinutes),
      escalationGraceMinutes:this.number(body.escalationGraceMinutes,1,1440,current.escalationGraceMinutes),
      maxEscalationLevel:this.number(body.maxEscalationLevel,1,10,current.maxEscalationLevel),
    };
    await this.prisma.$executeRaw`
      UPDATE "SupportRoutingPolicy" SET enabled=${body.enabled!==false},"defaultLanguage"=${lang},"respectAgentWorkingHours"=${body.respectAgentWorkingHours!==false},"autoReassignOnFirstResponseBreach"=${body.autoReassignOnFirstResponseBreach!==false},
      "criticalFirstResponseMinutes"=${values.criticalFirstResponseMinutes},"highFirstResponseMinutes"=${values.highFirstResponseMinutes},"normalFirstResponseMinutes"=${values.normalFirstResponseMinutes},"lowFirstResponseMinutes"=${values.lowFirstResponseMinutes},
      "criticalResolutionMinutes"=${values.criticalResolutionMinutes},"highResolutionMinutes"=${values.highResolutionMinutes},"normalResolutionMinutes"=${values.normalResolutionMinutes},"lowResolutionMinutes"=${values.lowResolutionMinutes},
      "escalationGraceMinutes"=${values.escalationGraceMinutes},"maxEscalationLevel"=${values.maxEscalationLevel},"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${organizationId}::uuid
    `;
    return this.policy(organizationId);
  }

  async dashboard(user:AuthenticatedUser){
    const policy=await this.policy(user.organizationId);
    const [risk,metrics,topics,languages]=await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT c.id,c.subject,c.status::text status,c.priority,c."routingTopic",c."requestedLanguage",c."customerTier",c."createdAt",c."lastMessageAt",c."slaFirstResponseDueAt",c."slaResolutionDueAt",c."firstAgentResponseAt",c."escalationLevel",c."escalatedAt",c."lastEscalationReason",
          u.id "agentId",u.email "agentEmail",u."firstName" "agentFirstName",u."lastName" "agentLastName",
          CASE WHEN c."firstAgentResponseAt" IS NULL AND c."slaFirstResponseDueAt"<CURRENT_TIMESTAMP THEN 'FIRST_RESPONSE_OVERDUE'
               WHEN c."slaResolutionDueAt"<CURRENT_TIMESTAMP THEN 'RESOLUTION_OVERDUE'
               WHEN c."firstAgentResponseAt" IS NULL AND c."slaFirstResponseDueAt"<CURRENT_TIMESTAMP+INTERVAL '15 minutes' THEN 'FIRST_RESPONSE_DUE_SOON'
               WHEN c."slaResolutionDueAt"<CURRENT_TIMESTAMP+INTERVAL '60 minutes' THEN 'RESOLUTION_DUE_SOON' ELSE 'ON_TRACK' END "riskStatus"
        FROM "SupportConversation" c LEFT JOIN "User" u ON u.id=c."assignedToUserId"
        WHERE c."organizationId"=${user.organizationId}::uuid AND c.status<>'RESOLVED'
        ORDER BY CASE c.priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,c."slaFirstResponseDueAt" ASC LIMIT 200
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT u.id,u.email,u."firstName",u."lastName",
          count(c.id) FILTER(WHERE c."assignedToUserId"=u.id)::int assigned,
          count(c.id) FILTER(WHERE c."assignedToUserId"=u.id AND c.status='RESOLVED')::int resolved,
          round(avg(EXTRACT(EPOCH FROM (c."firstAgentResponseAt"-c."createdAt"))) FILTER(WHERE c."assignedToUserId"=u.id AND c."firstAgentResponseAt" IS NOT NULL))::int "avgFirstResponseSeconds",
          round(avg(EXTRACT(EPOCH FROM (c."resolvedAt"-c."createdAt"))) FILTER(WHERE c."assignedToUserId"=u.id AND c."resolvedAt" IS NOT NULL))::int "avgResolutionSeconds",
          count(c.id) FILTER(WHERE c."assignedToUserId"=u.id AND c."escalationLevel">0)::int escalated
        FROM "User" u LEFT JOIN "SupportConversation" c ON c."organizationId"=u."organizationId"
        WHERE u."organizationId"=${user.organizationId}::uuid AND u.role IN ('OWNER','ADMIN','OPERATOR') AND u."isActive"=TRUE
        GROUP BY u.id,u.email,u."firstName",u."lastName" ORDER BY resolved DESC,u.email
      `,
      this.prisma.$queryRaw<any[]>`SELECT "routingTopic" topic,count(*)::int total,count(*) FILTER(WHERE status='RESOLVED')::int resolved FROM "SupportConversation" WHERE "organizationId"=${user.organizationId}::uuid GROUP BY "routingTopic" ORDER BY total DESC`,
      this.prisma.$queryRaw<any[]>`SELECT "requestedLanguage" language,count(*)::int total,count(*) FILTER(WHERE status='RESOLVED')::int resolved FROM "SupportConversation" WHERE "organizationId"=${user.organizationId}::uuid GROUP BY "requestedLanguage" ORDER BY total DESC`,
    ]);
    const overdue=risk.filter(r=>String(r.riskStatus).includes('OVERDUE')).length;const dueSoon=risk.filter(r=>String(r.riskStatus).includes('DUE_SOON')).length;
    return{policy,summary:{open:risk.length,overdue,dueSoon,critical:risk.filter(r=>r.priority==='CRITICAL').length,high:risk.filter(r=>r.priority==='HIGH').length,unassigned:risk.filter(r=>!r.agentId).length},risk,metrics,topics,languages,availableSkills:SKILLS,availableLanguages:LANGUAGES,priorities:PRIORITIES};
  }
}
