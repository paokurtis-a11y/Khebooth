import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const TOKEN_TTL_MS=60*24*60*60*1000;
const DAY_MS=24*60*60*1000;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

type Candidate={organizationId:string;clientId:string;name:string;email:string|null;verificationCycle:number;reverificationStatus:string;nextDocumentVerificationAt:Date;reverificationDueAt:Date|null;reverificationLeadDays:number};

@Injectable()
export class EnterpriseReverificationService{
  constructor(private readonly prisma:PrismaService){}

  private async ensureRoot(organizationId:string){const rows=await this.prisma.$queryRaw<Array<{tenantKind:string}>>`SELECT "tenantKind" FROM "Organization" WHERE id=${organizationId}::uuid LIMIT 1`;if(rows[0]?.tenantKind!=='KHE_ROOT')throw new ForbiddenException('KHE root access required');}

  async process(secret:string|undefined){const expected=process.env.CRON_SECRET?.trim();if(!expected||secret!==expected)throw new UnauthorizedException('Invalid cron authorization');const candidates=await this.candidates();let opened=0;let reminded=0;for(const item of candidates){const result=await this.processCandidate(item);opened+=result.opened?1:0;reminded+=result.reminded?1:0;}return{ok:true,checked:candidates.length,opened,reminded};}

  private async candidates(){return this.prisma.$queryRaw<Candidate[]>`
    SELECT c."organizationId",c.id AS "clientId",c.name,c.email,o."verificationCycle",o."reverificationStatus",o."nextDocumentVerificationAt",o."reverificationDueAt",COALESCE(w."reverificationLeadDays",30) AS "reverificationLeadDays"
    FROM "Client" c JOIN "EnterpriseOnboarding" o ON o."clientId"=c.id
    LEFT JOIN "EnterpriseWorkflowSettings" w ON w."organizationId"=c."organizationId"
    WHERE c."subscriptionPlan"='ENTERPRISE' AND c."subscriptionStatus"='ACTIVE' AND c."paymentStatus"='PAID'
      AND o.status='APPROVED' AND o."nextDocumentVerificationAt" IS NOT NULL
      AND o."nextDocumentVerificationAt"<=CURRENT_TIMESTAMP+(COALESCE(w."reverificationLeadDays",30)||' days')::interval
    ORDER BY o."nextDocumentVerificationAt" ASC LIMIT 200`;
  }

  private async processCandidate(item:Candidate){let cycle=Number(item.verificationCycle||0);let status=item.reverificationStatus;let opened=false;const due=new Date(item.nextDocumentVerificationAt);const now=new Date();
    if(!['ACTION_REQUIRED','DOCUMENTS_RECEIVED','UNDER_REVIEW','CHANGES_REQUESTED','OVERDUE'].includes(status)){
      cycle+=1;opened=true;status='ACTION_REQUIRED';
      await this.prisma.$executeRaw`UPDATE "EnterpriseOnboarding" SET "verificationCycle"=${cycle},"reverificationStatus"='ACTION_REQUIRED',"reverificationStartedAt"=CURRENT_TIMESTAMP,"reverificationDueAt"=${due},"updatedAt"=CURRENT_TIMESTAMP WHERE "clientId"=${item.clientId}::uuid`;
      await this.prisma.auditLog.create({data:{organizationId:item.organizationId,userId:null,action:'ENTERPRISE_ANNUAL_REVERIFICATION_OPENED',entityType:'Client',entityId:item.clientId,metadata:{verificationCycle:cycle,dueAt:due,leadDays:item.reverificationLeadDays}}});
    }
    const days=Math.ceil((due.getTime()-now.getTime())/DAY_MS);if(days<0)await this.prisma.$executeRaw`UPDATE "EnterpriseOnboarding" SET "reverificationStatus"=CASE WHEN "reverificationStatus"='VERIFIED' THEN 'VERIFIED' ELSE 'OVERDUE' END,"updatedAt"=CURRENT_TIMESTAMP WHERE "clientId"=${item.clientId}::uuid`;
    const kind=this.reminderKind(days,opened);if(!kind)return{opened,reminded:false};const inserted=await this.prisma.$queryRaw<Array<{id:string}>>`
      INSERT INTO "EnterpriseReverificationReminder" (id,"organizationId","clientId","verificationCycle",kind)
      VALUES (gen_random_uuid(),${item.organizationId}::uuid,${item.clientId}::uuid,${cycle},${kind})
      ON CONFLICT ("clientId","verificationCycle",kind) DO NOTHING RETURNING id`;
    if(!inserted[0])return{opened,reminded:false};
    const url=await this.issueLink(item.organizationId,item.clientId);await this.createClientMessage(item,kind,url,due);if(['DUE','OVERDUE_7'].includes(kind))await this.notifyKhe(item,kind,due);return{opened,reminded:true};
  }

  private reminderKind(days:number,opened:boolean){if(days<=-7)return'OVERDUE_7';if(days<=0)return'DUE';if(days<=1)return'D1';if(days<=7)return'D7';if(days<=14)return'D14';if(days<=30||opened)return'D30';return null;}

  private async issueLink(organizationId:string,clientId:string){const raw=randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+TOKEN_TTL_MS);await this.prisma.$executeRaw`INSERT INTO "EnterpriseOnboardingToken" (id,"organizationId","clientId","tokenHash","expiresAt") VALUES (gen_random_uuid(),${organizationId}::uuid,${clientId}::uuid,${hash(raw)},${expiresAt})`;const origin=(process.env.WEB_ORIGIN||'https://khebooth.vercel.app').split(',')[0].trim().replace(/\/$/,'');return`${origin}/enterprise/onboarding/${raw}`;}

  private copy(kind:string,due:Date){const date=due.toLocaleDateString('fr-CH');if(kind==='D30')return{title:'Votre vérification Enterprise annuelle approche',body:`Pour maintenir votre dossier de sécurité à jour, préparez une pièce d’identité ou un passeport valable et une preuve de domicile récente avant le ${date}. Cette mise à jour annuelle prend seulement quelques minutes.`};if(kind==='D14')return{title:'Plus que 2 semaines pour actualiser votre dossier Enterprise',body:`Votre re-vérification annuelle est attendue avant le ${date}. Vos informations principales sont déjà conservées : il vous suffit d’actualiser les deux justificatifs demandés.`};if(kind==='D7')return{title:'Action recommandée cette semaine',body:`Votre vérification Enterprise arrive à échéance le ${date}. Déposez vos justificatifs maintenant pour éviter une revue de dernière minute.`};if(kind==='D1')return{title:'Votre vérification annuelle arrive à échéance demain',body:`Une dernière étape reste à faire : actualiser votre identité et votre preuve de domicile. Votre dossier KHE est déjà prêt.`};if(kind==='DUE')return{title:'Vérification Enterprise à actualiser',body:'La date annuelle de re-vérification est atteinte. Vos documents peuvent être transmis immédiatement depuis votre espace sécurisé; KHE les placera ensuite en revue prioritaire.'};return{title:'Votre dossier Enterprise attend toujours 2 justificatifs',body:'Votre re-vérification annuelle est en retard depuis une semaine. Nous avons simplifié l’action : ouvrez votre dossier, ajoutez une pièce d’identité/passeport valable et une preuve de domicile récente. Si vous avez un blocage, contactez KHE depuis le même espace.'};}

  private async createClientMessage(item:Candidate,kind:string,url:string,due:Date){const text=this.copy(kind,due);await this.prisma.$executeRaw`INSERT INTO "ClientMessage" (id,"organizationId","clientId",kind,title,body,"actionUrl","emailRequested") VALUES (gen_random_uuid(),${item.organizationId}::uuid,${item.clientId}::uuid,'SECURITY',${text.title},${text.body},${url},FALSE)`;if(item.email)await this.sendEmail(item.email,item.name,text.title,text.body,url).catch(()=>undefined);}

  private async notifyKhe(item:Candidate,kind:string,due:Date){await this.prisma.appNotification.create({data:{organizationId:item.organizationId,kind:'SYSTEM',title:kind==='OVERDUE_7'?'Re-vérification Enterprise en retard':'Re-vérification Enterprise arrivée à échéance',body:`${item.name} doit actualiser ses justificatifs annuels. Échéance : ${due.toLocaleDateString('fr-CH')}.`,actionUrl:`/clients?client=${item.clientId}`}});}

  private async sendEmail(to:string,name:string,title:string,body:string,url:string){const key=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!key||!from)return;await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:title,html:`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2 style="color:#b58a27">KHE BOOTH Enterprise</h2><p>Bonjour ${name},</p><p>${body}</p><p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none">Actualiser mes justificatifs</a></p><p style="font-size:12px;color:#666">KHE limite volontairement les rappels : 30 jours, 14 jours, 7 jours, 1 jour avant l’échéance, puis uniquement aux étapes importantes après l’échéance.</p></div>`})});}

  async manualStart(organizationId:string,userId:string,role:string,clientId:string){await this.ensureRoot(organizationId);if(role!=='OWNER')throw new ForbiddenException('Only OWNER can manually start a reverification cycle');const rows=await this.prisma.$queryRaw<Candidate[]>`SELECT c."organizationId",c.id AS "clientId",c.name,c.email,o."verificationCycle",o."reverificationStatus",COALESCE(o."nextDocumentVerificationAt",CURRENT_TIMESTAMP) AS "nextDocumentVerificationAt",o."reverificationDueAt",30 AS "reverificationLeadDays" FROM "Client" c JOIN "EnterpriseOnboarding" o ON o."clientId"=c.id WHERE c.id=${clientId}::uuid AND c."organizationId"=${organizationId}::uuid AND c."subscriptionPlan"='ENTERPRISE' LIMIT 1`;const item=rows[0];if(!item)throw new NotFoundException('Enterprise client not found');if(['ACTION_REQUIRED','DOCUMENTS_RECEIVED','UNDER_REVIEW','CHANGES_REQUESTED','OVERDUE'].includes(item.reverificationStatus))throw new BadRequestException('A reverification cycle is already active');const due=new Date(Date.now()+30*DAY_MS);const candidate={...item,nextDocumentVerificationAt:due};const result=await this.processCandidate(candidate);await this.prisma.auditLog.create({data:{organizationId,userId,action:'ENTERPRISE_ANNUAL_REVERIFICATION_MANUALLY_STARTED',entityType:'Client',entityId:clientId,metadata:{verificationCycle:Number(item.verificationCycle||0)+1}}});return result;}

  async queue(organizationId:string){await this.ensureRoot(organizationId);return this.prisma.$queryRaw<any[]>`SELECT c.id AS "clientId",c.name,c.email,o."verificationCycle",o."reverificationStatus",o."reverificationStartedAt",o."reverificationDueAt",o."nextDocumentVerificationAt",COUNT(d.id) FILTER (WHERE d."verificationCycle"=o."verificationCycle" AND d."documentType" IN ('IDENTITY_CARD','PASSPORT','PROOF_OF_ADDRESS'))::int AS "currentCycleDocuments" FROM "Client" c JOIN "EnterpriseOnboarding" o ON o."clientId"=c.id LEFT JOIN "EnterpriseVerificationDocument" d ON d."clientId"=c.id AND d."deletedAt" IS NULL WHERE c."organizationId"=${organizationId}::uuid AND c."subscriptionPlan"='ENTERPRISE' AND o."verificationCycle">0 AND o."reverificationStatus"<>'VERIFIED' GROUP BY c.id,c.name,c.email,o."verificationCycle",o."reverificationStatus",o."reverificationStartedAt",o."reverificationDueAt",o."nextDocumentVerificationAt" ORDER BY COALESCE(o."reverificationDueAt",o."nextDocumentVerificationAt") ASC`;}
}
