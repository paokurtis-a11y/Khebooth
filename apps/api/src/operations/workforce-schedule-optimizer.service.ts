import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { WorkforceIntelligenceService } from './workforce-intelligence.service';

type ForecastSlot={slotStart:string|Date;slotEnd:string|Date;requiredAgents:number;scheduledAgents:number;gapAgents:number;languages:string[];topics:string[];missingLanguages:string[];missingSkills:string[];scheduledAgentIds:string[]};
type Candidate={id:string;email:string;firstName:string|null;lastName:string|null;role:string;skills:string[];languages:string[];timezone:string|null;enabled:boolean;workingDays:number[];workStartLocal:string|null;workEndLocal:string|null};
type Assignment={userId:string;email:string;slotStart:Date;slotEnd:Date;score:number;languages:string[];skills:string[]};
type ProposalRow={id:string;organizationId:string;status:string;horizonDays:number;forecastTimezone:string;startsAt:Date;endsAt:Date;sampleSize:number;requiredAgentSlots:number;proposedAgentSlots:number;uncoveredAgentSlots:number;coveragePct:number|string;note:string|null;optimizerVersion:string;snapshot:any;createdByUserId:string|null;approvedByUserId:string|null;approvedAt:Date|null;appliedByUserId:string|null;appliedAt:Date|null;rejectedByUserId:string|null;rejectedAt:Date|null;createdAt:Date;updatedAt:Date};

type ProposalShiftRow={id:string;proposalId:string;organizationId:string;userId:string;startsAt:Date;endsAt:Date;enabled:boolean;score:number;reason:string;languages:string[];skills:string[];slotCount:number;plannedMinutes:number;editedByUserId:string|null;editedAt:Date|null;createdAt:Date;updatedAt:Date;agentEmail:string;agentFirstName:string|null;agentLastName:string|null};

const WEEKDAY:Record<string,number>={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};

@Injectable()
export class WorkforceScheduleOptimizerService{
  constructor(private readonly prisma:PrismaService,private readonly workforce:WorkforceIntelligenceService){}

  private integer(value:unknown,min:number,max:number,fallback:number){const n=Math.trunc(Number(value));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
  private date(value:unknown,label:string){const parsed=new Date(String(value??''));if(!Number.isFinite(parsed.getTime()))throw new BadRequestException(`${label} invalide`);return parsed;}
  private name(value:{email:string;firstName?:string|null;lastName?:string|null}){return[value.firstName,value.lastName].filter(Boolean).join(' ')||value.email;}
  private localParts(date:Date,timeZone:string){const parts=new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));return{dow:WEEKDAY[map.weekday]??1,dateKey:`${map.year}-${map.month}-${map.day}`};}
  private parseTime(value:string|null){if(!value)return null;const [h,m]=value.slice(0,5).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;}
  private recurringMinutes(agent:Candidate,date:Date,forecastZone:string){if(agent.enabled===false||!agent.workingDays?.length)return 0;const zone=agent.timezone||forecastZone;let p;try{p=this.localParts(date,zone);}catch{return 0;}if(!agent.workingDays.includes(p.dow))return 0;const start=this.parseTime(agent.workStartLocal),end=this.parseTime(agent.workEndLocal);if(start===null||end===null)return 0;return start<=end?Math.max(0,end-start):1440-start+end;}
  private union(left:string[],right:string[]){return [...new Set([...(left??[]),...(right??[])])];}

  private async candidates(organizationId:string){
    return this.prisma.$queryRaw<Candidate[]>`
      SELECT u.id,u.email,u."firstName",u."lastName",u.role::text role,COALESCE(rp.enabled,TRUE) enabled,
        COALESCE(rp.skills,ARRAY[]::text[]) skills,COALESCE(rp.languages,ARRAY['fr']::text[]) languages,COALESCE(rp.timezone,p.timezone) timezone,
        COALESCE(rp."workingDays",ARRAY[]::integer[]) "workingDays",rp."workStartLocal"::text "workStartLocal",rp."workEndLocal"::text "workEndLocal"
      FROM "User" u LEFT JOIN "AgentRoutingProfile" rp ON rp."userId"=u.id LEFT JOIN "AgentPresence" p ON p."userId"=u.id
      WHERE u."organizationId"=${organizationId}::uuid AND u."isActive"=TRUE AND u.role IN ('OWNER','ADMIN','OPERATOR')
      ORDER BY CASE u.role WHEN 'OPERATOR' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,u.email
    `;
  }

  async list(user:AuthenticatedUser){
    const rows=await this.prisma.$queryRaw<any[]>`
      SELECT p.id,p.status,p."horizonDays",p."forecastTimezone",p."startsAt",p."endsAt",p."sampleSize",p."requiredAgentSlots",p."proposedAgentSlots",p."uncoveredAgentSlots",p."coveragePct"::float8 "coveragePct",p.note,p."optimizerVersion",p."approvedAt",p."appliedAt",p."rejectedAt",p."createdAt",p."updatedAt",
        (SELECT count(*)::int FROM "WorkforceScheduleProposalShift" s WHERE s."proposalId"=p.id AND s.enabled=TRUE) "enabledShifts"
      FROM "WorkforceScheduleProposal" p WHERE p."organizationId"=${user.organizationId}::uuid ORDER BY p."createdAt" DESC LIMIT 30
    `;
    return rows;
  }

  async proposal(user:AuthenticatedUser,id:string){
    const proposals=await this.prisma.$queryRaw<ProposalRow[]>`
      SELECT id,"organizationId",status,"horizonDays","forecastTimezone","startsAt","endsAt","sampleSize","requiredAgentSlots","proposedAgentSlots","uncoveredAgentSlots","coveragePct"::float8 "coveragePct",note,"optimizerVersion",snapshot,
        "createdByUserId","approvedByUserId","approvedAt","appliedByUserId","appliedAt","rejectedByUserId","rejectedAt","createdAt","updatedAt"
      FROM "WorkforceScheduleProposal" WHERE id=${id}::uuid AND "organizationId"=${user.organizationId}::uuid LIMIT 1
    `;
    const proposal=proposals[0];if(!proposal)throw new NotFoundException('Proposition de planning introuvable');
    const [shifts,agents]=await Promise.all([
      this.prisma.$queryRaw<ProposalShiftRow[]>`
        SELECT s.*,u.email "agentEmail",u."firstName" "agentFirstName",u."lastName" "agentLastName"
        FROM "WorkforceScheduleProposalShift" s JOIN "User" u ON u.id=s."userId" WHERE s."proposalId"=${id}::uuid ORDER BY s."startsAt",u.email
      `,
      this.candidates(user.organizationId),
    ]);
    return{proposal:{...proposal,coveragePct:Number(proposal.coveragePct)},shifts:shifts.map(s=>({...s,agentName:this.name({email:s.agentEmail,firstName:s.agentFirstName,lastName:s.agentLastName})})),agents:agents.map(a=>({...a,name:this.name(a)}))};
  }

  async generate(user:AuthenticatedUser,body:Record<string,unknown>){
    const days=this.integer(body.days,1,14,7);const maxHoursPerAgentDay=this.integer(body.maxHoursPerAgentDay,2,12,8);const note=String(body.note??'').trim().slice(0,500)||null;
    const dashboard:any=await this.workforce.dashboard(user,days);if(dashboard?.config?.enabled===false)throw new BadRequestException('Workforce Intelligence est désactivé');
    const forecast=(dashboard?.forecast??[]) as ForecastSlot[];const agents=(await this.candidates(user.organizationId)).filter(a=>a.enabled!==false);const slotMinutes=Number(dashboard?.config?.slotMinutes??60);const zone=String(dashboard?.forecastTimezone||dashboard?.config?.forecastTimezone||'Europe/Zurich');
    const risky=forecast.filter(s=>Number(s.gapAgents)>0).sort((a,b)=>new Date(a.slotStart).getTime()-new Date(b.slotStart).getTime());const requiredAgentSlots=risky.reduce((n,s)=>n+Math.max(0,Number(s.gapAgents)||0),0);
    const assignmentBySlot=new Map<string,Set<string>>();const proposedMinutesByDay=new Map<string,number>();const manualMinutesByDay=new Map<string,number>();
    for(const shift of (dashboard?.shifts??[]) as any[]){if(shift.status!=='PLANNED')continue;const start=new Date(shift.startsAt),end=new Date(shift.endsAt);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))continue;const agent=agents.find(a=>a.id===shift.userId);if(!agent)continue;let key;try{key=`${agent.id}:${this.localParts(start,agent.timezone||zone).dateKey}`;}catch{key=`${agent.id}:${start.toISOString().slice(0,10)}`;}manualMinutesByDay.set(key,(manualMinutesByDay.get(key)??0)+Math.max(0,Math.round((end.getTime()-start.getTime())/60000)));}
    const assignments:Assignment[]=[];let uncovered=0;
    for(const slot of risky){const start=new Date(slot.slotStart),end=new Date(slot.slotEnd);const slotKey=start.toISOString();const occupied=new Set<string>(slot.scheduledAgentIds??[]);const already=assignmentBySlot.get(slotKey)??new Set<string>();const wantedLanguages=(slot.missingLanguages?.length?slot.missingLanguages:slot.languages??[]).map(x=>String(x).toLowerCase());const wantedSkills=(slot.missingSkills?.length?slot.missingSkills:(slot.topics??[]).filter(x=>x!=='GENERAL')).map(x=>String(x).toUpperCase());
      for(let seat=0;seat<Math.max(0,Number(slot.gapAgents)||0);seat++){
        const ranked=agents.filter(agent=>!occupied.has(agent.id)&&!already.has(agent.id)).map(agent=>{let dayKey;try{dayKey=`${agent.id}:${this.localParts(start,agent.timezone||zone).dateKey}`;}catch{dayKey=`${agent.id}:${start.toISOString().slice(0,10)}`;}const recurring=this.recurringMinutes(agent,start,zone);const existing=manualMinutesByDay.get(dayKey)??0;const proposed=proposedMinutesByDay.get(dayKey)??0;const after=recurring+existing+proposed+slotMinutes;if(after>maxHoursPerAgentDay*60)return null;const langMatch=wantedLanguages.filter(l=>agent.languages.map(x=>x.toLowerCase()).includes(l)).length;const skillMatch=wantedSkills.filter(s=>agent.skills.map(x=>x.toUpperCase()).includes(s)).length;let score=100+langMatch*40+skillMatch*55-(Math.floor((existing+proposed)/60)*3);if(wantedLanguages.length&&langMatch===0)score-=35;if(wantedSkills.length&&skillMatch===0)score-=50;if(agent.role==='OPERATOR')score+=15;else if(agent.role==='ADMIN')score+=8;return{agent,score,dayKey,load:existing+proposed};}).filter(Boolean) as Array<{agent:Candidate;score:number;dayKey:string;load:number}>;
        ranked.sort((a,b)=>b.score-a.score||a.load-b.load||a.agent.email.localeCompare(b.agent.email));const chosen=ranked[0];if(!chosen){uncovered++;continue;}already.add(chosen.agent.id);assignmentBySlot.set(slotKey,already);proposedMinutesByDay.set(chosen.dayKey,(proposedMinutesByDay.get(chosen.dayKey)??0)+slotMinutes);assignments.push({userId:chosen.agent.id,email:chosen.agent.email,slotStart:start,slotEnd:end,score:chosen.score,languages:wantedLanguages,skills:wantedSkills});
      }
    }
    const merged:any[]=[];const byAgent=new Map<string,Assignment[]>();for(const a of assignments){const list=byAgent.get(a.userId)??[];list.push(a);byAgent.set(a.userId,list);}for(const [userId,list] of byAgent){list.sort((a,b)=>a.slotStart.getTime()-b.slotStart.getTime());let current:any=null;for(const a of list){if(current&&current.endsAt.getTime()===a.slotStart.getTime()){current.endsAt=a.slotEnd;current.slotCount++;current.plannedMinutes+=slotMinutes;current.languages=this.union(current.languages,a.languages);current.skills=this.union(current.skills,a.skills);current.scoreTotal+=a.score;current.score=Math.round(current.scoreTotal/current.slotCount);}else{if(current)merged.push(current);current={userId,startsAt:a.slotStart,endsAt:a.slotEnd,slotCount:1,plannedMinutes:slotMinutes,languages:[...a.languages],skills:[...a.skills],score:a.score,scoreTotal:a.score};}}if(current)merged.push(current);}
    const proposedAgentSlots=assignments.length;const uncoveredAgentSlots=Math.max(uncovered,requiredAgentSlots-proposedAgentSlots);const coveragePct=requiredAgentSlots===0?100:Number(((proposedAgentSlots/requiredAgentSlots)*100).toFixed(2));const first=forecast[0]?new Date(forecast[0].slotStart):new Date();const last=forecast.length?new Date(forecast[forecast.length-1].slotEnd):new Date(Date.now()+days*86400000);const snapshot={optimizerVersion:'workforce-scheduler-v1',generatedAt:new Date().toISOString(),slotMinutes,maxHoursPerAgentDay,forecastTimezone:zone,sourceSampleSize:Number(dashboard?.sampleSize??0),sourceSummary:dashboard?.summary??{},riskSlotCount:risky.length,requiredAgentSlots,proposedAgentSlots,uncoveredAgentSlots};
    const created=await this.prisma.$transaction(async tx=>{await tx.$executeRaw`UPDATE "WorkforceScheduleProposal" SET status='EXPIRED',"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${user.organizationId}::uuid AND status='DRAFT'`;const rows=await tx.$queryRaw<Array<{id:string}>>`
        INSERT INTO "WorkforceScheduleProposal" ("organizationId",status,"horizonDays","forecastTimezone","startsAt","endsAt","sampleSize","requiredAgentSlots","proposedAgentSlots","uncoveredAgentSlots","coveragePct",note,"optimizerVersion",snapshot,"createdByUserId")
        VALUES (${user.organizationId}::uuid,'DRAFT',${days},${zone},${first},${last},${Number(dashboard?.sampleSize??0)},${requiredAgentSlots},${proposedAgentSlots},${uncoveredAgentSlots},${coveragePct},${note},'workforce-scheduler-v1',${JSON.stringify(snapshot)}::jsonb,${user.id}::uuid) RETURNING id
      `;const id=rows[0].id;for(const s of merged){const reason=s.skills.length||s.languages.length?`KHE_OPTIMIZER · ${s.skills.join('/')||'GENERAL'} · ${s.languages.join('/')||'langue n/d'}`:'KHE_OPTIMIZER · couverture générale';await tx.$executeRaw`
          INSERT INTO "WorkforceScheduleProposalShift" ("proposalId","organizationId","userId","startsAt","endsAt",enabled,score,reason,languages,skills,"slotCount","plannedMinutes")
          VALUES (${id}::uuid,${user.organizationId}::uuid,${s.userId}::uuid,${s.startsAt},${s.endsAt},TRUE,${s.score},${reason},${s.languages}::text[],${s.skills}::text[],${s.slotCount},${s.plannedMinutes})
        `;}return id;});
    return this.proposal(user,created);
  }

  private async ensureEditable(user:AuthenticatedUser,proposalId:string){const rows=await this.prisma.$queryRaw<Array<{id:string;status:string;startsAt:Date;endsAt:Date;snapshot:any}>>`SELECT id,status,"startsAt","endsAt",snapshot FROM "WorkforceScheduleProposal" WHERE id=${proposalId}::uuid AND "organizationId"=${user.organizationId}::uuid LIMIT 1`;const row=rows[0];if(!row)throw new NotFoundException('Proposition introuvable');if(row.status!=='DRAFT')throw new BadRequestException('Le planning doit être en brouillon pour être modifié');return row;}

  private async refreshMetrics(proposalId:string){await this.prisma.$executeRaw`
    UPDATE "WorkforceScheduleProposal" p SET "proposedAgentSlots"=x.selected,"uncoveredAgentSlots"=GREATEST(0,p."requiredAgentSlots"-x.selected),"coveragePct"=CASE WHEN p."requiredAgentSlots"=0 THEN 100 ELSE LEAST(100,ROUND((x.selected::numeric/p."requiredAgentSlots"::numeric)*100,2)) END,"updatedAt"=CURRENT_TIMESTAMP
    FROM (SELECT COALESCE(sum("slotCount") FILTER(WHERE enabled=TRUE),0)::int selected FROM "WorkforceScheduleProposalShift" WHERE "proposalId"=${proposalId}::uuid) x WHERE p.id=${proposalId}::uuid
  `;}

  async updateShift(user:AuthenticatedUser,proposalId:string,shiftId:string,body:Record<string,unknown>){const proposal=await this.ensureEditable(user,proposalId);const rows=await this.prisma.$queryRaw<ProposalShiftRow[]>`SELECT s.*,u.email "agentEmail",u."firstName" "agentFirstName",u."lastName" "agentLastName" FROM "WorkforceScheduleProposalShift" s JOIN "User" u ON u.id=s."userId" WHERE s.id=${shiftId}::uuid AND s."proposalId"=${proposalId}::uuid AND s."organizationId"=${user.organizationId}::uuid LIMIT 1`;const current=rows[0];if(!current)throw new NotFoundException('Shift proposé introuvable');const agentId=String(body.agentId??current.userId);const candidates=await this.candidates(user.organizationId);if(!candidates.some(a=>a.id===agentId&&a.enabled!==false))throw new BadRequestException('Agent indisponible pour ce planning');const startsAt=body.startsAt===undefined?new Date(current.startsAt):this.date(body.startsAt,'Début');const endsAt=body.endsAt===undefined?new Date(current.endsAt):this.date(body.endsAt,'Fin');if(endsAt<=startsAt)throw new BadRequestException('La fin doit être après le début');if(startsAt<new Date(proposal.startsAt)||endsAt>new Date(proposal.endsAt))throw new BadRequestException('Le shift doit rester dans la période de la proposition');const minutes=Math.round((endsAt.getTime()-startsAt.getTime())/60000);if(minutes<30||minutes>960)throw new BadRequestException('Un shift proposé doit durer entre 30 minutes et 16 heures');const slotMinutes=Math.max(30,Number(proposal.snapshot?.slotMinutes??60));const slotCount=Math.max(1,Math.ceil(minutes/slotMinutes));const enabled=body.enabled===undefined?current.enabled:body.enabled!==false;const changed=agentId!==current.userId||startsAt.getTime()!==new Date(current.startsAt).getTime()||endsAt.getTime()!==new Date(current.endsAt).getTime();await this.prisma.$executeRaw`
      UPDATE "WorkforceScheduleProposalShift" SET "userId"=${agentId}::uuid,"startsAt"=${startsAt},"endsAt"=${endsAt},enabled=${enabled},"slotCount"=${slotCount},"plannedMinutes"=${minutes},reason=${changed?'OWNER_EDITED':current.reason},"editedByUserId"=${user.id}::uuid,"editedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${shiftId}::uuid
    `;await this.refreshMetrics(proposalId);return this.proposal(user,proposalId);}

  async approve(user:AuthenticatedUser,id:string){const updated=await this.prisma.$queryRaw<Array<{id:string}>>`UPDATE "WorkforceScheduleProposal" SET status='APPROVED',"approvedByUserId"=${user.id}::uuid,"approvedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND "organizationId"=${user.organizationId}::uuid AND status='DRAFT' RETURNING id`;if(!updated[0])throw new BadRequestException('Seul un brouillon peut être validé');return this.proposal(user,id);}
  async reopen(user:AuthenticatedUser,id:string){const updated=await this.prisma.$queryRaw<Array<{id:string}>>`UPDATE "WorkforceScheduleProposal" SET status='DRAFT',"approvedByUserId"=NULL,"approvedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND "organizationId"=${user.organizationId}::uuid AND status='APPROVED' RETURNING id`;if(!updated[0])throw new BadRequestException('Seul un planning validé peut revenir en brouillon');return this.proposal(user,id);}
  async reject(user:AuthenticatedUser,id:string){const updated=await this.prisma.$queryRaw<Array<{id:string}>>`UPDATE "WorkforceScheduleProposal" SET status='REJECTED',"rejectedByUserId"=${user.id}::uuid,"rejectedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND "organizationId"=${user.organizationId}::uuid AND status IN ('DRAFT','APPROVED') RETURNING id`;if(!updated[0])throw new BadRequestException('Cette proposition ne peut plus être rejetée');return this.proposal(user,id);}

  async apply(user:AuthenticatedUser,id:string){await this.prisma.$transaction(async tx=>{const proposals=await tx.$queryRaw<Array<{id:string;status:string}>>`SELECT id,status FROM "WorkforceScheduleProposal" WHERE id=${id}::uuid AND "organizationId"=${user.organizationId}::uuid FOR UPDATE`;const proposal=proposals[0];if(!proposal)throw new NotFoundException('Proposition introuvable');if(proposal.status==='APPLIED')return;if(proposal.status!=='APPROVED')throw new BadRequestException('Validez d’abord le planning avant de l’appliquer');const shifts=await tx.$queryRaw<Array<{id:string;userId:string;startsAt:Date;endsAt:Date;reason:string}>>`SELECT id,"userId","startsAt","endsAt",reason FROM "WorkforceScheduleProposalShift" WHERE "proposalId"=${id}::uuid AND enabled=TRUE ORDER BY "startsAt"`;
      for(const s of shifts){const conflicts=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "AgentWorkShift" WHERE "organizationId"=${user.organizationId}::uuid AND "userId"=${s.userId}::uuid AND status='PLANNED' AND "startsAt"<${s.endsAt} AND "endsAt">${s.startsAt} AND ("proposalShiftId" IS NULL OR "proposalShiftId"<>${s.id}::uuid) LIMIT 1`;if(conflicts[0])throw new ConflictException('Le planning a changé depuis la validation. Rouvrez ou régénérez la proposition avant application.');await tx.$executeRaw`
          INSERT INTO "AgentWorkShift" ("organizationId","userId","startsAt","endsAt",status,source,note,"createdByUserId","proposalShiftId","createdAt","updatedAt")
          VALUES (${user.organizationId}::uuid,${s.userId}::uuid,${s.startsAt},${s.endsAt},'PLANNED','RECOMMENDED',${`KHE Optimizer · ${s.reason}`},${user.id}::uuid,${s.id}::uuid,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
          ON CONFLICT ("proposalShiftId") WHERE "proposalShiftId" IS NOT NULL DO NOTHING
        `;}await tx.$executeRaw`UPDATE "WorkforceScheduleProposal" SET status='APPLIED',"appliedByUserId"=${user.id}::uuid,"appliedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid`;});return this.proposal(user,id);}
}
