import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type ShiftRow={id:string;organizationId:string;userId:string;startsAt:Date;endsAt:Date;status:string;source:string;note:string|null;confirmationStatus:string;confirmationRequestedAt:Date;respondedAt:Date|null;responseNote:string|null;proposalShiftId:string|null;agentEmail:string;agentFirstName:string|null;agentLastName:string|null;languages:string[];skills:string[];availabilityConflict:boolean};
type CandidateRow={id:string;email:string;firstName:string|null;lastName:string|null;role:string;skills:string[];languages:string[];plannedMinutes:number};
type AvailabilityRow={id:string;userId:string;startsAt:Date;endsAt:Date;status:string;note:string|null;createdAt:Date;updatedAt:Date};

@Injectable()
export class AgentWorkforceService{
  constructor(private readonly prisma:PrismaService){}

  private date(value:unknown,label:string){const d=new Date(String(value??''));if(!Number.isFinite(d.getTime()))throw new BadRequestException(`${label} invalide`);return d;}
  private note(value:unknown,max=240){return String(value??'').trim().slice(0,max)||null;}
  private name(value:{email:string;firstName?:string|null;lastName?:string|null}){return[value.firstName,value.lastName].filter(Boolean).join(' ')||value.email;}
  private async notifyUser(organizationId:string,userId:string,kind:string,title:string,body:string,actionUrl:string){await this.prisma.$executeRaw`INSERT INTO "AgentWorkforceNotice" ("organizationId","userId",kind,title,body,"actionUrl") VALUES (${organizationId}::uuid,${userId}::uuid,${kind},${title},${body},${actionUrl})`;}
  private async managerIds(organizationId:string){const rows=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "User" WHERE "organizationId"=${organizationId}::uuid AND "isActive"=TRUE AND role IN ('OWNER','ADMIN')`;return rows.map(r=>r.id);}
  private async notifyManagers(organizationId:string,title:string,body:string){for(const id of await this.managerIds(organizationId))await this.notifyUser(organizationId,id,'MANAGER',title,body,'/operations/workforce/team');}

  private async shift(organizationId:string,id:string){const rows=await this.prisma.$queryRaw<ShiftRow[]>`
    SELECT s.id,s."organizationId",s."userId",s."startsAt",s."endsAt",s.status,s.source,s.note,s."confirmationStatus",s."confirmationRequestedAt",s."respondedAt",s."responseNote",s."proposalShiftId",
      u.email "agentEmail",u."firstName" "agentFirstName",u."lastName" "agentLastName",COALESCE(ps.languages,ARRAY[]::text[]) languages,COALESCE(ps.skills,ARRAY[]::text[]) skills,
      EXISTS(SELECT 1 FROM "AgentAvailabilityBlock" b WHERE b."userId"=s."userId" AND b.status='ACTIVE' AND b."startsAt"<s."endsAt" AND b."endsAt">s."startsAt") "availabilityConflict"
    FROM "AgentWorkShift" s JOIN "User" u ON u.id=s."userId" LEFT JOIN "WorkforceScheduleProposalShift" ps ON ps.id=s."proposalShiftId"
    WHERE s.id=${id}::uuid AND s."organizationId"=${organizationId}::uuid LIMIT 1`;
    return rows[0];
  }

  async compact(user:AuthenticatedUser){const next=await this.prisma.$queryRaw<Array<{id:string;startsAt:Date;endsAt:Date;confirmationStatus:string}>>`SELECT id,"startsAt","endsAt","confirmationStatus" FROM "AgentWorkShift" WHERE "organizationId"=${user.organizationId}::uuid AND "userId"=${user.id}::uuid AND status='PLANNED' AND "startsAt">CURRENT_TIMESTAMP ORDER BY "startsAt" ASC LIMIT 1`;const unread=await this.prisma.$queryRaw<Array<{count:number}>>`SELECT count(*)::int count FROM "AgentWorkforceNotice" WHERE "organizationId"=${user.organizationId}::uuid AND "userId"=${user.id}::uuid AND "readAt" IS NULL`;return{nextShift:next[0]??null,unreadNotices:Number(unread[0]?.count??0)};}

  async mine(user:AuthenticatedUser){const shifts=await this.prisma.$queryRaw<ShiftRow[]>`
    SELECT s.id,s."organizationId",s."userId",s."startsAt",s."endsAt",s.status,s.source,s.note,s."confirmationStatus",s."confirmationRequestedAt",s."respondedAt",s."responseNote",s."proposalShiftId",
      u.email "agentEmail",u."firstName" "agentFirstName",u."lastName" "agentLastName",COALESCE(ps.languages,ARRAY[]::text[]) languages,COALESCE(ps.skills,ARRAY[]::text[]) skills,
      EXISTS(SELECT 1 FROM "AgentAvailabilityBlock" b WHERE b."userId"=s."userId" AND b.status='ACTIVE' AND b."startsAt"<s."endsAt" AND b."endsAt">s."startsAt") "availabilityConflict"
    FROM "AgentWorkShift" s JOIN "User" u ON u.id=s."userId" LEFT JOIN "WorkforceScheduleProposalShift" ps ON ps.id=s."proposalShiftId"
    WHERE s."organizationId"=${user.organizationId}::uuid AND s."userId"=${user.id}::uuid AND s."endsAt">=CURRENT_TIMESTAMP-INTERVAL '1 day' AND s."startsAt"<=CURRENT_TIMESTAMP+INTERVAL '30 days'
    ORDER BY s."startsAt" ASC`;
    const [availability,notices]=await Promise.all([
      this.prisma.$queryRaw<AvailabilityRow[]>`SELECT * FROM "AgentAvailabilityBlock" WHERE "organizationId"=${user.organizationId}::uuid AND "userId"=${user.id}::uuid AND status='ACTIVE' AND "endsAt">=CURRENT_TIMESTAMP ORDER BY "startsAt" ASC`,
      this.prisma.$queryRaw<any[]>`SELECT id,kind,title,body,"actionUrl","readAt","createdAt" FROM "AgentWorkforceNotice" WHERE "organizationId"=${user.organizationId}::uuid AND "userId"=${user.id}::uuid ORDER BY "createdAt" DESC LIMIT 30`,
    ]);
    return{summary:{upcoming:shifts.filter(s=>s.status==='PLANNED'&&new Date(s.startsAt)>new Date()).length,pending:shifts.filter(s=>s.status==='PLANNED'&&s.confirmationStatus==='PENDING').length,accepted:shifts.filter(s=>s.status==='PLANNED'&&s.confirmationStatus==='ACCEPTED').length,conflicts:shifts.filter(s=>s.availabilityConflict).length,unreadNotices:notices.filter(n=>!n.readAt).length},shifts,availability,notices};
  }

  async markNoticeRead(user:AuthenticatedUser,id:string){const rows=await this.prisma.$queryRaw<Array<{id:string}>>`UPDATE "AgentWorkforceNotice" SET "readAt"=COALESCE("readAt",CURRENT_TIMESTAMP) WHERE id=${id}::uuid AND "organizationId"=${user.organizationId}::uuid AND "userId"=${user.id}::uuid RETURNING id`;if(!rows.length)throw new NotFoundException('Rappel introuvable');return{ok:true};}

  async respond(user:AuthenticatedUser,shiftId:string,body:Record<string,unknown>){const response=String(body.response??'').toUpperCase();if(!['ACCEPTED','DECLINED'].includes(response))throw new BadRequestException('Réponse invalide');const shift=await this.shift(user.organizationId,shiftId);if(!shift||shift.userId!==user.id)throw new NotFoundException('Shift introuvable');if(shift.status!=='PLANNED'||new Date(shift.startsAt)<=new Date())throw new BadRequestException('Ce shift ne peut plus être confirmé');const note=this.note(body.note);
    await this.prisma.$transaction(async tx=>{await tx.$executeRaw`UPDATE "AgentWorkShift" SET "confirmationStatus"=${response},"respondedAt"=CURRENT_TIMESTAMP,"responseNote"=${note},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${shiftId}::uuid`;await tx.$executeRaw`INSERT INTO "AgentWorkShiftResponse" ("organizationId","shiftId","userId",response,note) VALUES (${user.organizationId}::uuid,${shiftId}::uuid,${user.id}::uuid,${response},${note})`;});
    await this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:`WORKFORCE_SHIFT_${response}`,entityType:'AgentWorkShift',entityId:shiftId,metadata:{noteProvided:Boolean(note)}}});
    if(response==='DECLINED')await this.notifyManagers(user.organizationId,'Shift à remplacer',`${this.name({email:shift.agentEmail,firstName:shift.agentFirstName,lastName:shift.agentLastName})} a indiqué ne pas pouvoir prendre un shift planifié. KHE peut proposer des remplaçants sans appliquer de changement automatiquement.`);
    return this.shift(user.organizationId,shiftId);
  }

  async addAvailability(user:AuthenticatedUser,body:Record<string,unknown>){const startsAt=this.date(body.startsAt,'Début');const endsAt=this.date(body.endsAt,'Fin');if(endsAt<=startsAt)throw new BadRequestException('La fin doit être après le début');if(endsAt.getTime()-startsAt.getTime()>31*86400000)throw new BadRequestException('Une indisponibilité ne peut pas dépasser 31 jours');if(endsAt<new Date())throw new BadRequestException('La période est déjà terminée');const note=this.note(body.note);
    const rows=await this.prisma.$queryRaw<Array<{id:string}>>`INSERT INTO "AgentAvailabilityBlock" ("organizationId","userId","startsAt","endsAt",note) VALUES (${user.organizationId}::uuid,${user.id}::uuid,${startsAt},${endsAt},${note}) RETURNING id`;const id=rows[0].id;
    const conflicts=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "AgentWorkShift" WHERE "organizationId"=${user.organizationId}::uuid AND "userId"=${user.id}::uuid AND status='PLANNED' AND "startsAt"<${endsAt} AND "endsAt">${startsAt}`;
    await this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'WORKFORCE_AVAILABILITY_BLOCK_CREATED',entityType:'AgentAvailabilityBlock',entityId:id,metadata:{conflictingShifts:conflicts.length}}});
    if(conflicts.length)await this.notifyManagers(user.organizationId,'Conflit de disponibilité agent',`Une indisponibilité déclarée chevauche ${conflicts.length} shift(s) déjà planifié(s). Aucun shift n’a été annulé automatiquement.`);
    return{block:(await this.prisma.$queryRaw<AvailabilityRow[]>`SELECT * FROM "AgentAvailabilityBlock" WHERE id=${id}::uuid`)[0],conflictingShifts:conflicts.length};
  }

  async cancelAvailability(user:AuthenticatedUser,id:string){const rows=await this.prisma.$queryRaw<Array<{id:string}>>`UPDATE "AgentAvailabilityBlock" SET status='CANCELLED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND "organizationId"=${user.organizationId}::uuid AND "userId"=${user.id}::uuid AND status='ACTIVE' RETURNING id`;if(!rows.length)throw new NotFoundException('Indisponibilité introuvable');await this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'WORKFORCE_AVAILABILITY_BLOCK_CANCELLED',entityType:'AgentAvailabilityBlock',entityId:id}});return{ok:true};}

  async team(user:AuthenticatedUser){const shifts=await this.prisma.$queryRaw<ShiftRow[]>`
    SELECT s.id,s."organizationId",s."userId",s."startsAt",s."endsAt",s.status,s.source,s.note,s."confirmationStatus",s."confirmationRequestedAt",s."respondedAt",s."responseNote",s."proposalShiftId",
      u.email "agentEmail",u."firstName" "agentFirstName",u."lastName" "agentLastName",COALESCE(ps.languages,ARRAY[]::text[]) languages,COALESCE(ps.skills,ARRAY[]::text[]) skills,
      EXISTS(SELECT 1 FROM "AgentAvailabilityBlock" b WHERE b."userId"=s."userId" AND b.status='ACTIVE' AND b."startsAt"<s."endsAt" AND b."endsAt">s."startsAt") "availabilityConflict"
    FROM "AgentWorkShift" s JOIN "User" u ON u.id=s."userId" LEFT JOIN "WorkforceScheduleProposalShift" ps ON ps.id=s."proposalShiftId"
    WHERE s."organizationId"=${user.organizationId}::uuid AND s.status='PLANNED' AND s."endsAt">=CURRENT_TIMESTAMP AND s."startsAt"<=CURRENT_TIMESTAMP+INTERVAL '30 days' ORDER BY s."startsAt" ASC`;
    const availability=await this.prisma.$queryRaw<any[]>`SELECT b.*,u.email,u."firstName",u."lastName" FROM "AgentAvailabilityBlock" b JOIN "User" u ON u.id=b."userId" WHERE b."organizationId"=${user.organizationId}::uuid AND b.status='ACTIVE' AND b."endsAt">=CURRENT_TIMESTAMP ORDER BY b."startsAt" ASC LIMIT 200`;
    return{summary:{planned:shifts.length,pending:shifts.filter(s=>s.confirmationStatus==='PENDING').length,accepted:shifts.filter(s=>s.confirmationStatus==='ACCEPTED').length,declined:shifts.filter(s=>s.confirmationStatus==='DECLINED').length,replacementNeeded:shifts.filter(s=>s.confirmationStatus==='DECLINED'||s.availabilityConflict).length},shifts:shifts.map(s=>({...s,agentName:this.name({email:s.agentEmail,firstName:s.agentFirstName,lastName:s.agentLastName}),replacementNeeded:s.confirmationStatus==='DECLINED'||s.availabilityConflict})),availability};
  }

  async replacements(user:AuthenticatedUser,shiftId:string){const shift=await this.shift(user.organizationId,shiftId);if(!shift)throw new NotFoundException('Shift introuvable');const candidates=await this.prisma.$queryRaw<CandidateRow[]>`
    SELECT u.id,u.email,u."firstName",u."lastName",u.role::text role,COALESCE(rp.skills,ARRAY[]::text[]) skills,COALESCE(rp.languages,ARRAY['fr']::text[]) languages,
      COALESCE((SELECT sum(EXTRACT(EPOCH FROM (x."endsAt"-x."startsAt"))/60)::int FROM "AgentWorkShift" x WHERE x."userId"=u.id AND x.status='PLANNED' AND x."startsAt">=date_trunc('day',${shift.startsAt}) AND x."startsAt"<date_trunc('day',${shift.startsAt})+INTERVAL '1 day'),0) "plannedMinutes"
    FROM "User" u LEFT JOIN "AgentRoutingProfile" rp ON rp."userId"=u.id
    WHERE u."organizationId"=${user.organizationId}::uuid AND u."isActive"=TRUE AND u.role IN ('OWNER','ADMIN','OPERATOR') AND u.id<>${shift.userId}::uuid AND COALESCE(rp.enabled,TRUE)=TRUE
      AND NOT EXISTS(SELECT 1 FROM "AgentAvailabilityBlock" b WHERE b."userId"=u.id AND b.status='ACTIVE' AND b."startsAt"<${shift.endsAt} AND b."endsAt">${shift.startsAt})
      AND NOT EXISTS(SELECT 1 FROM "AgentWorkShift" x WHERE x."userId"=u.id AND x.status='PLANNED' AND x.id<>${shiftId}::uuid AND x."startsAt"<${shift.endsAt} AND x."endsAt">${shift.startsAt})`;
    const wantedSkills=(shift.skills??[]).map(x=>x.toUpperCase()),wantedLanguages=(shift.languages??[]).map(x=>x.toLowerCase());const ranked=candidates.map(c=>{const skillMatch=wantedSkills.filter(x=>c.skills.map(v=>v.toUpperCase()).includes(x)).length;const langMatch=wantedLanguages.filter(x=>c.languages.map(v=>v.toLowerCase()).includes(x)).length;let score=100+skillMatch*55+langMatch*40-Math.floor(c.plannedMinutes/60)*3;if(wantedSkills.length&&!skillMatch)score-=50;if(wantedLanguages.length&&!langMatch)score-=35;if(c.role==='OPERATOR')score+=15;else if(c.role==='ADMIN')score+=8;return{...c,name:this.name(c),score,skillMatch,languageMatch:langMatch,reason:`${skillMatch}/${wantedSkills.length||0} compétence(s), ${langMatch}/${wantedLanguages.length||0} langue(s), ${Math.round(c.plannedMinutes/60*10)/10}h déjà planifiée(s)`};}).sort((a,b)=>b.score-a.score||a.plannedMinutes-b.plannedMinutes||a.email.localeCompare(b.email));return{shift:{...shift,agentName:this.name({email:shift.agentEmail,firstName:shift.agentFirstName,lastName:shift.agentLastName})},candidates:ranked.slice(0,8)};}

  async reassign(user:AuthenticatedUser,shiftId:string,body:Record<string,unknown>){const agentId=String(body.agentId??'');const shift=await this.shift(user.organizationId,shiftId);if(!shift)throw new NotFoundException('Shift introuvable');if(!agentId||agentId===shift.userId)throw new BadRequestException('Choisissez un autre agent');const valid=await this.prisma.$queryRaw<Array<{id:string;email:string;firstName:string|null;lastName:string|null}>>`
    SELECT u.id,u.email,u."firstName",u."lastName" FROM "User" u LEFT JOIN "AgentRoutingProfile" rp ON rp."userId"=u.id WHERE u.id=${agentId}::uuid AND u."organizationId"=${user.organizationId}::uuid AND u."isActive"=TRUE AND u.role IN ('OWNER','ADMIN','OPERATOR') AND COALESCE(rp.enabled,TRUE)=TRUE
      AND NOT EXISTS(SELECT 1 FROM "AgentAvailabilityBlock" b WHERE b."userId"=u.id AND b.status='ACTIVE' AND b."startsAt"<${shift.endsAt} AND b."endsAt">${shift.startsAt})
      AND NOT EXISTS(SELECT 1 FROM "AgentWorkShift" x WHERE x."userId"=u.id AND x.status='PLANNED' AND x.id<>${shiftId}::uuid AND x."startsAt"<${shift.endsAt} AND x."endsAt">${shift.startsAt}) LIMIT 1`;
    if(!valid.length)throw new ConflictException('Cet agent a maintenant un conflit ou une indisponibilité');const next=valid[0];
    await this.prisma.$executeRaw`UPDATE "AgentWorkShift" SET "userId"=${agentId}::uuid,"confirmationStatus"='PENDING',"confirmationRequestedAt"=CURRENT_TIMESTAMP,"respondedAt"=NULL,"responseNote"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${shiftId}::uuid AND "organizationId"=${user.organizationId}::uuid`;
    await this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'WORKFORCE_SHIFT_REASSIGNED',entityType:'AgentWorkShift',entityId:shiftId,metadata:{fromUserId:shift.userId,toUserId:agentId}}});
    await this.notifyUser(user.organizationId,agentId,'ASSIGNMENT','Nouveau shift KHE à confirmer','Un shift vous a été réassigné. Consultez votre planning et confirmez votre disponibilité.','/operations/workforce/me');return{shift:await this.shift(user.organizationId,shiftId),assignedTo:{...next,name:this.name(next)}};
  }

  private async reminderOnce(organizationId:string,shiftId:string,userId:string,kind:string,title:string,body:string){return this.prisma.$transaction(async tx=>{const marker=await tx.$queryRaw<Array<{id:string}>>`INSERT INTO "AgentWorkShiftReminder" ("organizationId","shiftId","userId",kind) VALUES (${organizationId}::uuid,${shiftId}::uuid,${userId}::uuid,${kind}) ON CONFLICT ("shiftId","userId",kind) DO NOTHING RETURNING id`;if(!marker.length)return false;const noticeKind=kind==='ASSIGNMENT'?'ASSIGNMENT':'REMINDER';await tx.$executeRaw`INSERT INTO "AgentWorkforceNotice" ("organizationId","userId",kind,title,body,"actionUrl") VALUES (${organizationId}::uuid,${userId}::uuid,${noticeKind},${title},${body},'/operations/workforce/me')`;return true;});}

  async pulse(user:AuthenticatedUser){const rows=await this.prisma.$queryRaw<Array<{id:string;userId:string;startsAt:Date;endsAt:Date;confirmationStatus:string;timezone:string|null}>>`
    SELECT s.id,s."userId",s."startsAt",s."endsAt",s."confirmationStatus",COALESCE(rp.timezone,'Europe/Zurich') timezone FROM "AgentWorkShift" s LEFT JOIN "AgentRoutingProfile" rp ON rp."userId"=s."userId"
    WHERE s."organizationId"=${user.organizationId}::uuid AND s.status='PLANNED' AND s."startsAt">CURRENT_TIMESTAMP AND s."startsAt"<=CURRENT_TIMESTAMP+INTERVAL '30 days' AND s."confirmationStatus"<>'DECLINED' ORDER BY s."startsAt" ASC LIMIT 200`;
    let sent=0;const now=Date.now();for(const s of rows){const start=new Date(s.startsAt);const zone=s.timezone||'Europe/Zurich';const label=start.toLocaleString('fr-CH',{timeZone:zone,weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});if(await this.reminderOnce(user.organizationId,s.id,s.userId,'ASSIGNMENT','Shift KHE à confirmer',`Un shift est planifié le ${label}. Ouvrez votre planning pour accepter ou signaler une indisponibilité.`))sent++;const delta=start.getTime()-now;if(delta<=24*3600000&&await this.reminderOnce(user.organizationId,s.id,s.userId,'REMINDER_24H','Rappel shift KHE — moins de 24h',`Votre shift commence le ${label}. Vérifiez votre confirmation et votre disponibilité.`))sent++;if(delta<=2*3600000&&await this.reminderOnce(user.organizationId,s.id,s.userId,'REMINDER_2H','Rappel shift KHE — moins de 2h',`Votre shift commence bientôt (${label}). Ouvrez KHE Booth pour vérifier votre statut.`))sent++;}return{processed:rows.length,notificationsSent:sent};}
}
