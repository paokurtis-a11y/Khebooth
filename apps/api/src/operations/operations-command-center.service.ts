import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type SummaryRow={
  open?:number;critical?:number;high?:number;overdue?:number;unassigned?:number;
  active?:number;paused?:number;scheduled?:number;missed?:number;
  openBriefs?:number;readyBriefs?:number;urgentBriefs?:number;missingNotes?:number;
  rescueOpen?:number;rescuePrepared?:number;rescueOverdue?:number;rescueUrgent?:number;
  handoverBatches?:number;handoverPending?:number;handoverWithoutSuggestion?:number;
  agents?:number;online?:number;available?:number;activeShiftAgents?:number;pausedShiftAgents?:number;
};

@Injectable()
export class OperationsCommandCenterService{
  constructor(private readonly prisma:PrismaService){}
  private name(v:{email:string;firstName?:string|null;lastName?:string|null}){return[v.firstName,v.lastName].filter(Boolean).join(' ')||v.email;}

  async dashboard(user:AuthenticatedUser){
    const organizationId=user.organizationId;
    const [supportRows,liveRows,briefRows,rescueRows,handoverRows,agentRows,policyRows,criticalRows,loadRows,coverageRows]=await Promise.all([
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          count(*) FILTER(WHERE c.status<>'RESOLVED')::int open,
          count(*) FILTER(WHERE c.status<>'RESOLVED' AND COALESCE(c.priority::text,'NORMAL')='CRITICAL')::int critical,
          count(*) FILTER(WHERE c.status<>'RESOLVED' AND COALESCE(c.priority::text,'NORMAL')='HIGH')::int high,
          count(*) FILTER(WHERE c.status<>'RESOLVED' AND ((c."firstAgentResponseAt" IS NULL AND c."slaFirstResponseDueAt"<CURRENT_TIMESTAMP) OR c."slaResolutionDueAt"<CURRENT_TIMESTAMP))::int overdue,
          count(*) FILTER(WHERE c.status<>'RESOLVED' AND c."assignedToUserId" IS NULL)::int unassigned
        FROM "SupportConversation" c WHERE c."organizationId"=${organizationId}::uuid`,
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          count(*) FILTER(WHERE s.status='PLANNED' AND s."liveStatus"='ACTIVE')::int active,
          count(*) FILTER(WHERE s.status='PLANNED' AND s."liveStatus"='PAUSED')::int paused,
          count(*) FILTER(WHERE s.status='PLANNED' AND s."liveStatus"='SCHEDULED' AND s."startsAt"<=CURRENT_TIMESTAMP+INTERVAL '4 hours' AND s."endsAt">CURRENT_TIMESTAMP)::int scheduled,
          count(*) FILTER(WHERE s."liveStatus"='MISSED' AND s."endsAt">CURRENT_TIMESTAMP-INTERVAL '24 hours')::int missed
        FROM "AgentWorkShift" s WHERE s."organizationId"=${organizationId}::uuid`,
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          count(*) FILTER(WHERE b.status='OPEN')::int "openBriefs",
          count(*) FILTER(WHERE b.status='READY')::int "readyBriefs",
          COALESCE(sum(b."urgentSlaCount") FILTER(WHERE b.status IN ('OPEN','READY')),0)::int "urgentBriefs",
          COALESCE(sum(b."missingNoteCount") FILTER(WHERE b.status IN ('OPEN','READY')),0)::int "missingNotes"
        FROM "ShiftBrief" b WHERE b."organizationId"=${organizationId}::uuid`,
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          count(*) FILTER(WHERE r.status='OPEN')::int "rescueOpen",
          count(*) FILTER(WHERE r.status='PREPARED')::int "rescuePrepared",
          count(*) FILTER(WHERE r.status IN ('OPEN','PREPARED','HOLD','ESCALATED') AND r."riskLevel"='OVERDUE')::int "rescueOverdue",
          count(*) FILTER(WHERE r.status IN ('OPEN','PREPARED','HOLD','ESCALATED') AND r."riskLevel"='URGENT')::int "rescueUrgent"
        FROM "SlaRescueCase" r WHERE r."organizationId"=${organizationId}::uuid`,
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          count(DISTINCT b.id) FILTER(WHERE b.status IN ('DRAFT','PARTIAL'))::int "handoverBatches",
          count(i.id) FILTER(WHERE i.status='PENDING')::int "handoverPending",
          count(i.id) FILTER(WHERE i.status='PENDING' AND i."suggestedUserId" IS NULL)::int "handoverWithoutSuggestion"
        FROM "ShiftHandoverBatch" b LEFT JOIN "ShiftHandoverItem" i ON i."batchId"=b.id
        WHERE b."organizationId"=${organizationId}::uuid`,
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          count(DISTINCT u.id)::int agents,
          count(DISTINCT u.id) FILTER(WHERE p."lastHeartbeatAt">CURRENT_TIMESTAMP-INTERVAL '90 seconds')::int online,
          count(DISTINCT u.id) FILTER(WHERE p."lastHeartbeatAt">CURRENT_TIMESTAMP-INTERVAL '90 seconds' AND p.availability='AVAILABLE' AND p."acceptingAssignments"=TRUE)::int available,
          count(DISTINCT u.id) FILTER(WHERE EXISTS(SELECT 1 FROM "AgentWorkShift" s WHERE s."userId"=u.id AND s."organizationId"=${organizationId}::uuid AND s.status='PLANNED' AND s."liveStatus"='ACTIVE'))::int "activeShiftAgents",
          count(DISTINCT u.id) FILTER(WHERE EXISTS(SELECT 1 FROM "AgentWorkShift" s WHERE s."userId"=u.id AND s."organizationId"=${organizationId}::uuid AND s.status='PLANNED' AND s."liveStatus"='PAUSED'))::int "pausedShiftAgents"
        FROM "User" u LEFT JOIN "AgentPresence" p ON p."userId"=u.id
        WHERE u."organizationId"=${organizationId}::uuid AND u."isActive"=TRUE AND u.role IN ('OWNER','ADMIN','OPERATOR')`,
      this.prisma.$queryRaw<Array<{strictRouting:boolean}>>`
        SELECT COALESCE((SELECT "requireActiveShiftForRouting" FROM "LiveShiftPolicy" WHERE "organizationId"=${organizationId}::uuid LIMIT 1),FALSE) "strictRouting"`,
      this.prisma.$queryRaw<any[]>`
        SELECT c.id,c.subject,c.status::text status,COALESCE(c.priority::text,'NORMAL') priority,COALESCE(c."routingTopic",'GENERAL') "routingTopic",COALESCE(c."requestedLanguage",'fr') "requestedLanguage",c."lastMessageAt",c."escalationLevel",c."assignedToUserId",
          CASE
            WHEN c."firstAgentResponseAt" IS NULL AND c."slaFirstResponseDueAt" IS NOT NULL AND c."slaResolutionDueAt" IS NOT NULL THEN LEAST(c."slaFirstResponseDueAt",c."slaResolutionDueAt")
            WHEN c."firstAgentResponseAt" IS NULL AND c."slaFirstResponseDueAt" IS NOT NULL THEN c."slaFirstResponseDueAt"
            ELSE c."slaResolutionDueAt"
          END "nextSlaDueAt",
          au.email "agentEmail",au."firstName" "agentFirstName",au."lastName" "agentLastName"
        FROM "SupportConversation" c LEFT JOIN "User" au ON au.id=c."assignedToUserId"
        WHERE c."organizationId"=${organizationId}::uuid AND c.status<>'RESOLVED'
          AND (COALESCE(c.priority::text,'NORMAL') IN ('CRITICAL','HIGH') OR (c."firstAgentResponseAt" IS NULL AND c."slaFirstResponseDueAt"<CURRENT_TIMESTAMP) OR c."slaResolutionDueAt"<CURRENT_TIMESTAMP)
        ORDER BY
          CASE WHEN (c."firstAgentResponseAt" IS NULL AND c."slaFirstResponseDueAt"<CURRENT_TIMESTAMP) OR c."slaResolutionDueAt"<CURRENT_TIMESTAMP THEN 0 ELSE 1 END,
          CASE COALESCE(c.priority::text,'NORMAL') WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,
          "nextSlaDueAt" ASC NULLS LAST,c."lastMessageAt" DESC LIMIT 12`,
      this.prisma.$queryRaw<any[]>`
        SELECT u.id,u.email,u."firstName",u."lastName",u.role::text role,p.availability::text availability,p."acceptingAssignments",p."lastHeartbeatAt",
          COALESCE(rp."maxActiveConversations",5)::int "maxConversations",COALESCE(rp."maxActiveTasks",15)::int "maxTasks",
          (SELECT count(*)::int FROM "SupportConversation" c WHERE c."assignedToUserId"=u.id AND c.status<>'RESOLVED') "activeConversations",
          (SELECT count(*)::int FROM "SupportTask" t WHERE t."assignedToUserId"=u.id AND t.status<>'DONE') "activeTasks",
          COALESCE(ls."liveStatus",'OFF_SHIFT') "liveStatus",ls."endsAt" "shiftEndsAt"
        FROM "User" u LEFT JOIN "AgentPresence" p ON p."userId"=u.id LEFT JOIN "AgentRoutingProfile" rp ON rp."userId"=u.id
        LEFT JOIN LATERAL (
          SELECT s."liveStatus"::text "liveStatus",s."endsAt" FROM "AgentWorkShift" s
          WHERE s."organizationId"=${organizationId}::uuid AND s."userId"=u.id AND s.status='PLANNED' AND s."liveStatus" IN ('ACTIVE','PAUSED')
          ORDER BY s."startsAt" DESC LIMIT 1
        ) ls ON TRUE
        WHERE u."organizationId"=${organizationId}::uuid AND u."isActive"=TRUE AND u.role IN ('OWNER','ADMIN','OPERATOR')
        ORDER BY CASE WHEN ls."liveStatus"='ACTIVE' THEN 0 WHEN ls."liveStatus"='PAUSED' THEN 1 ELSE 2 END,
          CASE WHEN p."lastHeartbeatAt">CURRENT_TIMESTAMP-INTERVAL '90 seconds' AND p.availability='AVAILABLE' THEN 0 ELSE 1 END,
          "activeConversations" DESC,u.email LIMIT 20`,
      this.prisma.$queryRaw<any[]>`
        SELECT s.id,s."userId",s."startsAt",s."endsAt",s."liveStatus"::text "liveStatus",u.email,u."firstName",u."lastName"
        FROM "AgentWorkShift" s JOIN "User" u ON u.id=s."userId"
        WHERE s."organizationId"=${organizationId}::uuid AND s.status='PLANNED' AND s."confirmationStatus"='ACCEPTED'
          AND s."startsAt"<=CURRENT_TIMESTAMP+INTERVAL '4 hours' AND s."endsAt">CURRENT_TIMESTAMP
        ORDER BY s."startsAt" ASC,s."endsAt" ASC LIMIT 40`
    ]);

    const support=supportRows[0]??{},live=liveRows[0]??{},brief=briefRows[0]??{},rescue=rescueRows[0]??{},handover=handoverRows[0]??{},agents=agentRows[0]??{};
    const n=(v:unknown)=>Number(v??0);
    const summary={
      support:{open:n(support.open),critical:n(support.critical),high:n(support.high),overdue:n(support.overdue),unassigned:n(support.unassigned)},
      live:{active:n(live.active),paused:n(live.paused),scheduled:n(live.scheduled),missed:n(live.missed)},
      brief:{open:n(brief.openBriefs),ready:n(brief.readyBriefs),urgent:n(brief.urgentBriefs),missingNotes:n(brief.missingNotes)},
      rescue:{open:n(rescue.rescueOpen),prepared:n(rescue.rescuePrepared),overdue:n(rescue.rescueOverdue),urgent:n(rescue.rescueUrgent)},
      handover:{batches:n(handover.handoverBatches),pending:n(handover.handoverPending),withoutSuggestion:n(handover.handoverWithoutSuggestion)},
      agents:{total:n(agents.agents),online:n(agents.online),available:n(agents.available),activeShift:n(agents.activeShiftAgents),pausedShift:n(agents.pausedShiftAgents)},
      coverage4h:{shifts:coverageRows.length,agents:new Set(coverageRows.map(r=>r.userId)).size}
    };
    const attention:Array<{severity:'CRITICAL'|'WATCH'|'INFO';title:string;detail:string;href:string}>=[];
    if(summary.support.overdue)attention.push({severity:'CRITICAL',title:`${summary.support.overdue} SLA dépassé(s)`,detail:'Conversations ouvertes dont une échéance SLA est déjà dépassée.',href:'/operations/workforce/rescue'});
    if(summary.rescue.open)attention.push({severity:'CRITICAL',title:`${summary.rescue.open} décision(s) Rescue`,detail:'Un OWNER/ADMIN doit choisir garder, préparer une relève ou escalader.',href:'/operations/workforce/rescue'});
    if(summary.handover.pending)attention.push({severity:'WATCH',title:`${summary.handover.pending} relais en attente`,detail:`${summary.handover.withoutSuggestion} sans suggestion active.`,href:'/operations/workforce/handover'});
    if(summary.brief.urgent||summary.brief.missingNotes)attention.push({severity:'WATCH',title:`${summary.brief.urgent} SLA urgent(s) dans les briefs`,detail:`${summary.brief.missingNotes} note(s) de relais manquante(s).`,href:'/operations/workforce/brief/team'});
    if(summary.support.open>0&&summary.agents.available===0)attention.push({severity:'CRITICAL',title:'Aucun agent disponible',detail:`${summary.support.open} conversation(s) ouverte(s) mais aucun agent ne reçoit actuellement de nouvelles assignations.`,href:'/operations/workforce/live/team'});
    if(!attention.length)attention.push({severity:'INFO',title:'Situation opérationnelle stable',detail:'Aucune alerte prioritaire détectée par le Command Center.',href:'/operations'});

    return{
      generatedAt:new Date(),
      policy:{strictRouting:Boolean(policyRows[0]?.strictRouting)},
      summary,
      attention,
      criticalConversations:criticalRows.map(r=>({...r,assignedAgentName:r.agentEmail?this.name({email:r.agentEmail,firstName:r.agentFirstName,lastName:r.agentLastName}):null})),
      agents:loadRows.map(r=>({...r,name:this.name(r),online:Boolean(r.lastHeartbeatAt&&new Date(r.lastHeartbeatAt).getTime()>Date.now()-90000)})),
      coverage:coverageRows.map(r=>({...r,agentName:this.name(r)}))
    };
  }
}
