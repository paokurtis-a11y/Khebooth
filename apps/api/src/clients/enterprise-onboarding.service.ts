import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { del, head, issueSignedToken, presignUrl } from '@vercel/blob';
import { PrismaService } from '../prisma/prisma.service';

const EU_EEA = new Set(['AT','BE','BG','HR','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HU','IE','IS','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SI','SK']);
const MAX_DOC_BYTES=20*1024*1024;
const UPLOAD_TTL_MS=15*60*1000;
const DOWNLOAD_TTL_MS=15*60*1000;
const INVITE_TTL_MS=30*24*60*60*1000;
const ID_CONTENT_TYPES=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
const MANUAL_CONTENT_TYPES=new Set([...ID_CONTENT_TYPES,'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
const DOC_TYPES=new Set(['IDENTITY_CARD','PASSPORT','PROOF_OF_ADDRESS','MANUAL_FORM_PDF','MANUAL_FORM_DOCX','MANUAL_FORM_XLSX','OTHER']);

function tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}
function code(value:unknown){return String(value??'').trim().toUpperCase().slice(0,2);}
function safeString(value:unknown,max=4000){return String(value??'').trim().slice(0,max);}
function ext(contentType:string){
  if(contentType==='application/pdf')return'pdf';if(contentType==='image/jpeg')return'jpg';if(contentType==='image/png')return'png';if(contentType==='image/webp')return'webp';
  if(contentType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return'docx';
  if(contentType==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')return'xlsx';
  return'bin';
}

@Injectable()
export class EnterpriseOnboardingService{
  constructor(private readonly prisma:PrismaService){}

  private async ensureRoot(organizationId:string,role:string,allowAdmin=false){
    const rows=await this.prisma.$queryRaw<Array<{tenantKind:string}>>`SELECT "tenantKind" FROM "Organization" WHERE id=${organizationId}::uuid LIMIT 1`;
    const roleOk=role==='OWNER'||(allowAdmin&&role==='ADMIN');
    if(!roleOk||rows[0]?.tenantKind!=='KHE_ROOT')throw new ForbiddenException('KHE root access required');
  }

  private async client(organizationId:string,clientId:string){
    const rows=await this.prisma.$queryRaw<any[]>`
      SELECT id,"organizationId",name,email,phone,"companyName","subscriptionPlan","subscriptionStatus","paymentStatus","lastPaymentAt"
      FROM "Client" WHERE id=${clientId}::uuid AND "organizationId"=${organizationId}::uuid LIMIT 1`;
    if(!rows[0])throw new NotFoundException('Client not found');return rows[0];
  }

  private jurisdiction(countryCode:string){
    if(countryCode==='CH')return'SWITZERLAND';if(EU_EEA.has(countryCode))return'EU_EEA';if(countryCode==='GB')return'UNITED_KINGDOM';if(countryCode==='US')return'UNITED_STATES';if(countryCode==='CA')return'CANADA';return'GLOBAL';
  }

  private async templateFor(organizationId:string,countryCode:string){
    const cc=code(countryCode);const jurisdiction=this.jurisdiction(cc);
    const exact=await this.prisma.$queryRaw<any[]>`
      SELECT * FROM "EnterpriseFormTemplate" WHERE "organizationId"=${organizationId}::uuid AND active=TRUE
      AND "countryCodes" @> ${JSON.stringify([cc])}::jsonb ORDER BY "legalReviewRequired" ASC,version DESC LIMIT 1`;
    if(exact[0])return exact[0];
    const byJurisdiction=await this.prisma.$queryRaw<any[]>`
      SELECT * FROM "EnterpriseFormTemplate" WHERE "organizationId"=${organizationId}::uuid AND active=TRUE AND jurisdiction=${jurisdiction}
      ORDER BY version DESC LIMIT 1`;
    if(byJurisdiction[0])return byJurisdiction[0];
    const fallback=await this.prisma.$queryRaw<any[]>`
      SELECT * FROM "EnterpriseFormTemplate" WHERE "organizationId"=${organizationId}::uuid AND active=TRUE AND code='GLOBAL_BASELINE' LIMIT 1`;
    if(!fallback[0])throw new ServiceUnavailableException('Enterprise form template is not configured');return fallback[0];
  }

  private async onboarding(organizationId:string,clientId:string){
    const rows=await this.prisma.$queryRaw<any[]>`SELECT * FROM "EnterpriseOnboarding" WHERE "organizationId"=${organizationId}::uuid AND "clientId"=${clientId}::uuid LIMIT 1`;
    return rows[0]??null;
  }

  async adminReport(organizationId:string,role:string,clientId:string){
    await this.ensureRoot(organizationId,role,true);const client=await this.client(organizationId,clientId);
    const onboarding=await this.onboarding(organizationId,clientId);
    const profileRows=await this.prisma.$queryRaw<any[]>`SELECT * FROM "ClientProfileSnapshot" WHERE "clientId"=${clientId}::uuid LIMIT 1`;
    const documents=await this.prisma.$queryRaw<any[]>`
      SELECT id,"documentType","originalFileName","contentType","byteSize",status,"expiresOn","uploadedAt","verifiedAt","verifiedByUserId","rejectionReason","retentionDeleteAt","deletedAt"
      FROM "EnterpriseVerificationDocument" WHERE "clientId"=${clientId}::uuid ORDER BY "uploadedAt" DESC`;
    const quotes=await this.prisma.$queryRaw<any[]>`SELECT * FROM "EnterpriseQuote" WHERE "clientId"=${clientId}::uuid ORDER BY "createdAt" DESC`;
    const template=onboarding?.templateId?(await this.prisma.$queryRaw<any[]>`SELECT * FROM "EnterpriseFormTemplate" WHERE id=${onboarding.templateId}::uuid LIMIT 1`)[0]??null:null;
    return{client,profile:profileRows[0]??null,onboarding,template,documents,quotes,accessGate:{paymentRequired:true,formRequired:true,identityRequired:true,agentVerificationRequired:true,ownerApprovalRequired:true,canEnablePlatform:client.paymentStatus==='PAID'&&client.subscriptionPlan==='ENTERPRISE'&&onboarding?.status==='APPROVED'}};
  }

  async profileAvatarTicket(organizationId:string,role:string,clientId:string){
    await this.ensureRoot(organizationId,role,true);await this.client(organizationId,clientId);
    const rows=await this.prisma.$queryRaw<Array<{avatarPath:string|null}>>`SELECT "avatarPath" FROM "ClientProfileSnapshot" WHERE "clientId"=${clientId}::uuid LIMIT 1`;
    const pathname=rows[0]?.avatarPath;if(!pathname)return{downloadUrl:null,expiresAt:null};
    const expiresAtMs=Date.now()+DOWNLOAD_TTL_MS;const token=await issueSignedToken({pathname,operations:['get'],validUntil:expiresAtMs});
    const {presignedUrl}=await presignUrl(token,{access:'private',pathname,operation:'get',validUntil:expiresAtMs});return{downloadUrl:presignedUrl,expiresAt:new Date(expiresAtMs)};
  }

  async templates(organizationId:string,role:string){await this.ensureRoot(organizationId,role,true);return this.prisma.$queryRaw<any[]>`SELECT * FROM "EnterpriseFormTemplate" WHERE "organizationId"=${organizationId}::uuid ORDER BY jurisdiction,code`;}

  async updateTemplate(organizationId:string,userId:string,role:string,id:string,payload:Record<string,unknown>){
    await this.ensureRoot(organizationId,role);const name=safeString(payload.name,160);const privacyNotice=safeString(payload.privacyNotice,10000);const fields=Array.isArray(payload.fields)?payload.fields:[];const identityRequirements=payload.identityRequirements&&typeof payload.identityRequirements==='object'?payload.identityRequirements:{};const retentionPolicy=payload.retentionPolicy&&typeof payload.retentionPolicy==='object'?payload.retentionPolicy:{};
    if(!name||!privacyNotice||fields.length===0)throw new BadRequestException('Name, privacy notice and fields are required');
    const rows=await this.prisma.$queryRaw<any[]>`
      UPDATE "EnterpriseFormTemplate" SET name=${name},fields=${JSON.stringify(fields)}::jsonb,"identityRequirements"=${JSON.stringify(identityRequirements)}::jsonb,"privacyNotice"=${privacyNotice},"retentionPolicy"=${JSON.stringify(retentionPolicy)}::jsonb,"legalReviewRequired"=${payload.legalReviewRequired===true},active=${payload.active!==false},version=version+1,"updatedByUserId"=${userId}::uuid,"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${id}::uuid AND "organizationId"=${organizationId}::uuid RETURNING *`;
    if(!rows[0])throw new NotFoundException('Form template not found');return rows[0];
  }

  async offers(organizationId:string,role:string){await this.ensureRoot(organizationId,role,true);return this.prisma.$queryRaw<any[]>`SELECT * FROM "EnterpriseOfferTemplate" WHERE "organizationId"=${organizationId}::uuid ORDER BY "sortOrder",name`;}

  async updateOffer(organizationId:string,role:string,id:string,payload:Record<string,unknown>){
    await this.ensureRoot(organizationId,role);const name=safeString(payload.name,160);const description=safeString(payload.description,4000);const currency=safeString(payload.currency,3).toUpperCase()||'CHF';const baseMonthlyCents=Math.max(0,Math.round(Number(payload.baseMonthlyCents??0)));const setupFeeCents=Math.max(0,Math.round(Number(payload.setupFeeCents??0)));const includedUsers=Math.max(1,Math.round(Number(payload.includedUsers??1)));const extraUserMonthlyCents=Math.max(0,Math.round(Number(payload.extraUserMonthlyCents??0)));const features=Array.isArray(payload.features)?payload.features.map(String).filter(Boolean):[];
    if(!name)throw new BadRequestException('Offer name is required');const rows=await this.prisma.$queryRaw<any[]>`
      UPDATE "EnterpriseOfferTemplate" SET name=${name},description=${description},currency=${currency},"baseMonthlyCents"=${baseMonthlyCents},"setupFeeCents"=${setupFeeCents},"includedUsers"=${includedUsers},"extraUserMonthlyCents"=${extraUserMonthlyCents},features=${JSON.stringify(features)}::jsonb,active=${payload.active!==false},"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${id}::uuid AND "organizationId"=${organizationId}::uuid RETURNING *`;
    if(!rows[0])throw new NotFoundException('Offer not found');return rows[0];
  }

  async createQuote(organizationId:string,userId:string,role:string,clientId:string,payload:Record<string,unknown>){
    await this.ensureRoot(organizationId,role,true);const client=await this.client(organizationId,clientId);if(client.subscriptionPlan!=='ENTERPRISE')throw new BadRequestException('Enterprise quote requires the ENTERPRISE plan');
    const offerId=safeString(payload.offerTemplateId,80);const offers=offerId?await this.prisma.$queryRaw<any[]>`SELECT * FROM "EnterpriseOfferTemplate" WHERE id=${offerId}::uuid AND "organizationId"=${organizationId}::uuid LIMIT 1`:[];const offer=offers[0]??null;
    const onboarding=await this.onboarding(organizationId,clientId);const userCount=Math.max(1,Math.round(Number(payload.userCount??onboarding?.desiredUsers??1)));const currency=safeString(payload.currency??offer?.currency??'CHF',3).toUpperCase();const included=Number(offer?.includedUsers??1);const base=Number(offer?.baseMonthlyCents??0);const extra=Number(offer?.extraUserMonthlyCents??0);const calculated=base+Math.max(0,userCount-included)*extra;const monthlyCents=payload.monthlyCents===undefined?calculated:Math.max(0,Math.round(Number(payload.monthlyCents)));const setupFeeCents=payload.setupFeeCents===undefined?Number(offer?.setupFeeCents??0):Math.max(0,Math.round(Number(payload.setupFeeCents)));const discountCents=Math.max(0,Math.round(Number(payload.discountCents??0)));const quoteNumber=`KHE-ENT-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;const features=Array.isArray(payload.features)?payload.features:(Array.isArray(offer?.features)?offer.features:[]);const customItems=Array.isArray(payload.customItems)?payload.customItems:[];
    const rows=await this.prisma.$queryRaw<any[]>`
      INSERT INTO "EnterpriseQuote" (id,"organizationId","clientId","offerTemplateId","quoteNumber",currency,"userCount","monthlyCents","setupFeeCents","discountCents","customItems",features,notes,status,"validUntil","createdByUserId")
      VALUES (gen_random_uuid(),${organizationId}::uuid,${clientId}::uuid,${offer?.id??null}::uuid,${quoteNumber},${currency},${userCount},${monthlyCents},${setupFeeCents},${discountCents},${JSON.stringify(customItems)}::jsonb,${JSON.stringify(features)}::jsonb,${safeString(payload.notes,4000)||null},'DRAFT',${payload.validUntil?safeString(payload.validUntil,10):null}::date,${userId}::uuid) RETURNING *`;
    return rows[0];
  }

  async invite(organizationId:string,userId:string,role:string,clientId:string){
    await this.ensureRoot(organizationId,role,true);const client=await this.client(organizationId,clientId);if(client.subscriptionPlan!=='ENTERPRISE'||client.paymentStatus!=='PAID')throw new BadRequestException('Enterprise payment must be validated before onboarding');if(!client.email)throw new BadRequestException('Client email is required');
    let onboarding=await this.onboarding(organizationId,clientId);if(!onboarding){const template=await this.templateFor(organizationId,'');const rows=await this.prisma.$queryRaw<any[]>`INSERT INTO "EnterpriseOnboarding" (id,"organizationId","clientId","templateId",status,"paymentVerifiedAt","formAvailableAt") VALUES (gen_random_uuid(),${organizationId}::uuid,${clientId}::uuid,${template.id}::uuid,'FORM_AVAILABLE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *`;onboarding=rows[0];}
    const raw=randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+INVITE_TTL_MS);
    await this.prisma.$transaction(async tx=>{await tx.$executeRaw`UPDATE "EnterpriseOnboardingToken" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "clientId"=${clientId}::uuid AND "revokedAt" IS NULL`;await tx.$executeRaw`INSERT INTO "EnterpriseOnboardingToken" (id,"organizationId","clientId","tokenHash","expiresAt") VALUES (gen_random_uuid(),${organizationId}::uuid,${clientId}::uuid,${tokenHash(raw)},${expiresAt})`;await tx.auditLog.create({data:{organizationId,userId,action:'ENTERPRISE_ONBOARDING_INVITED',entityType:'Client',entityId:clientId,metadata:{expiresAt}}});});
    const origin=(process.env.WEB_ORIGIN||'https://khebooth.vercel.app').split(',')[0].trim().replace(/\/$/,'');const url=`${origin}/enterprise/onboarding/${raw}`;await this.sendTransactional(client.email,'Finalisez votre accès Enterprise KHE Booth',`Votre paiement Enterprise est validé. Complétez maintenant le formulaire sécurisé, puis transmettez les justificatifs demandés. Votre accès sera ouvert après vérification KHE.`,url);
    return{sent:true,expiresAt,status:onboarding.status};
  }

  private async sendTransactional(to:string,subject:string,message:string,url:string){const key=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!key||!from)return;await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html:`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2 style="color:#b58a27">KHE BOOTH Enterprise</h2><p>${message}</p><p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none">Ouvrir mon formulaire sécurisé</a></p><p style="font-size:12px;color:#666">Lien personnel et temporaire. Ne le transférez pas.</p></div>`})});}

  private async byToken(rawToken:string){const hash=tokenHash(rawToken);const rows=await this.prisma.$queryRaw<any[]>`
    SELECT t.id AS "tokenId",t."organizationId",t."clientId",t."expiresAt",t."revokedAt",c.name,c.email,c."companyName",c."subscriptionPlan",c."paymentStatus",o.*
    FROM "EnterpriseOnboardingToken" t JOIN "Client" c ON c.id=t."clientId" JOIN "EnterpriseOnboarding" o ON o."clientId"=c.id
    WHERE t."tokenHash"=${hash} LIMIT 1`;
    const row=rows[0];if(!row||row.revokedAt||new Date(row.expiresAt).getTime()<Date.now())throw new UnauthorizedException('Enterprise onboarding link is invalid or expired');if(row.subscriptionPlan!=='ENTERPRISE'||row.paymentStatus!=='PAID')throw new ForbiddenException('Enterprise payment is not validated');await this.prisma.$executeRaw`UPDATE "EnterpriseOnboardingToken" SET "lastUsedAt"=CURRENT_TIMESTAMP WHERE id=${row.tokenId}::uuid`;return row;}

  async publicForm(rawToken:string){const row=await this.byToken(rawToken);let template=row.templateId?(await this.prisma.$queryRaw<any[]>`SELECT * FROM "EnterpriseFormTemplate" WHERE id=${row.templateId}::uuid LIMIT 1`)[0]??null:null;if(!template)template=await this.templateFor(row.organizationId,row.countryCode);const documents=await this.prisma.$queryRaw<any[]>`SELECT id,"documentType","originalFileName",status,"uploadedAt","verifiedAt","rejectionReason" FROM "EnterpriseVerificationDocument" WHERE "clientId"=${row.clientId}::uuid AND "deletedAt" IS NULL ORDER BY "uploadedAt" DESC`;
    return{client:{name:row.name,email:row.email,companyName:row.companyName},onboarding:{status:row.status,countryCode:row.countryCode,jurisdiction:row.jurisdiction,desiredUsers:row.desiredUsers,answers:row.answers,privacyAcceptedAt:row.privacyAcceptedAt,truthConfirmedAt:row.truthConfirmedAt,submittedAt:row.submittedAt,reviewNotes:row.reviewNotes,rejectionReason:row.rejectionReason},template:{id:template.id,code:template.code,name:template.name,jurisdiction:template.jurisdiction,fields:template.fields,identityRequirements:template.identityRequirements,privacyNotice:template.privacyNotice,retentionPolicy:template.retentionPolicy,legalReviewRequired:template.legalReviewRequired},documents,security:{manualReview:true,platformAccessAutomatic:false,ownerApprovalRequired:true}};
  }

  async savePublicForm(rawToken:string,payload:Record<string,unknown>){const row=await this.byToken(rawToken);if(['APPROVED','REJECTED'].includes(row.status))throw new BadRequestException('This onboarding is closed');const countryCode=code(payload.countryCode||row.countryCode);if(countryCode.length!==2)throw new BadRequestException('Country is required');const template=await this.templateFor(row.organizationId,countryCode);const answers=payload.answers&&typeof payload.answers==='object'&&!Array.isArray(payload.answers)?payload.answers as Record<string,unknown>:{};const desiredUsers=Math.max(1,Math.min(10000,Math.round(Number(payload.desiredUsers??answers.desiredUsers??row.desiredUsers??1))));const submit=payload.submit===true;
    if(submit){const fields=Array.isArray(template.fields)?template.fields:[];for(const field of fields){if(field&&typeof field==='object'&&(field as any).required===true){const key=String((field as any).key||'');if(key==='desiredUsers')continue;if(!safeString(answers[key],10000))throw new BadRequestException(`Champ obligatoire manquant: ${String((field as any).label||key)}`);}}if(payload.privacyAccepted!==true)throw new BadRequestException('Privacy notice acceptance is required');if(payload.truthConfirmed!==true)throw new BadRequestException('Information accuracy confirmation is required');}
    await this.prisma.$executeRaw`
      UPDATE "EnterpriseOnboarding" SET "templateId"=${template.id}::uuid,"countryCode"=${countryCode},jurisdiction=${template.jurisdiction},"desiredUsers"=${desiredUsers},"formVersion"=${template.version},answers=${JSON.stringify(answers)}::jsonb,
      "privacyAcceptedAt"=CASE WHEN ${payload.privacyAccepted===true} THEN COALESCE("privacyAcceptedAt",CURRENT_TIMESTAMP) ELSE "privacyAcceptedAt" END,
      "truthConfirmedAt"=CASE WHEN ${payload.truthConfirmed===true} THEN COALESCE("truthConfirmedAt",CURRENT_TIMESTAMP) ELSE "truthConfirmedAt" END,
      status=CASE WHEN ${submit} THEN 'IDENTITY_PENDING' ELSE CASE WHEN status='CHANGES_REQUESTED' THEN 'FORM_AVAILABLE' ELSE status END END,
      "submittedAt"=CASE WHEN ${submit} THEN CURRENT_TIMESTAMP ELSE "submittedAt" END,"updatedAt"=CURRENT_TIMESTAMP WHERE "clientId"=${row.clientId}::uuid`;
    if(submit)await this.syncSnapshotFromAnswers(row.organizationId,row.clientId,answers,countryCode);return this.publicForm(rawToken);
  }

  private async syncSnapshotFromAnswers(organizationId:string,clientId:string,answers:Record<string,unknown>,countryCode:string){const representative=safeString(answers.representativeName,200);const parts=representative.split(/\s+/).filter(Boolean);const firstName=parts[0]||'';const lastName=parts.slice(1).join(' ');const company=safeString(answers.legalName,200);const address=safeString(answers.registeredAddress,500);await this.prisma.$executeRaw`
    INSERT INTO "ClientProfileSnapshot" ("clientId","organizationId",source,"firstName","lastName","displayName",company,address,"countryCode","syncedAt","updatedAt") VALUES (${clientId}::uuid,${organizationId}::uuid,'ENTERPRISE_PORTAL',${firstName},${lastName},${representative||company},${company},${address},${countryCode},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("clientId") DO UPDATE SET source='ENTERPRISE_PORTAL',"firstName"=EXCLUDED."firstName","lastName"=EXCLUDED."lastName","displayName"=EXCLUDED."displayName",company=EXCLUDED.company,address=EXCLUDED.address,"countryCode"=EXCLUDED."countryCode","syncedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`;
  }

  async prepareDocumentUpload(rawToken:string,payload:Record<string,unknown>){const row=await this.byToken(rawToken);const documentType=safeString(payload.documentType,40).toUpperCase();const contentType=safeString(payload.contentType,160).toLowerCase();const byteSize=Math.round(Number(payload.byteSize??0));const originalFileName=safeString(payload.originalFileName,240)||`${documentType}.${ext(contentType)}`;if(!DOC_TYPES.has(documentType))throw new BadRequestException('Unsupported document type');const allowed=documentType.startsWith('MANUAL_FORM_')?MANUAL_CONTENT_TYPES:ID_CONTENT_TYPES;if(!allowed.has(contentType))throw new BadRequestException('Unsupported document format');if(!Number.isInteger(byteSize)||byteSize<=0||byteSize>MAX_DOC_BYTES)throw new BadRequestException('Document must be 20 MB or less');const pathname=`enterprise-verification/${row.organizationId}/${row.clientId}/${randomUUID()}.${ext(contentType)}`;const validUntil=Date.now()+UPLOAD_TTL_MS;const token=await issueSignedToken({pathname,operations:['put'],validUntil,maximumSizeInBytes:byteSize,allowedContentTypes:[contentType]});const {presignedUrl}=await presignUrl(token,{access:'private',pathname,operation:'put',validUntil,maximumSizeInBytes:byteSize,allowedContentTypes:[contentType],allowOverwrite:false});return{pathname,uploadUrl:presignedUrl,expiresAt:new Date(validUntil),documentType,contentType,byteSize,originalFileName};}

  async confirmDocument(rawToken:string,payload:Record<string,unknown>){const row=await this.byToken(rawToken);const pathname=safeString(payload.pathname,500);const prefix=`enterprise-verification/${row.organizationId}/${row.clientId}/`;if(!pathname.startsWith(prefix))throw new BadRequestException('Invalid document path');const documentType=safeString(payload.documentType,40).toUpperCase();if(!DOC_TYPES.has(documentType))throw new BadRequestException('Unsupported document type');const blob=await head(pathname);if(!blob.size||blob.size>MAX_DOC_BYTES)throw new BadRequestException('Invalid document size');const originalFileName=safeString(payload.originalFileName,240)||pathname.split('/').pop()||'document';const expiresOn=payload.expiresOn?safeString(payload.expiresOn,10):null;const rows=await this.prisma.$queryRaw<any[]>`INSERT INTO "EnterpriseVerificationDocument" (id,"organizationId","clientId","documentType",pathname,"originalFileName","contentType","byteSize","expiresOn") VALUES (gen_random_uuid(),${row.organizationId}::uuid,${row.clientId}::uuid,${documentType},${pathname},${originalFileName},${blob.contentType||'application/octet-stream'},${blob.size},${expiresOn}::date) RETURNING id`;
    await this.refreshReviewState(row.organizationId,row.clientId);return{id:rows[0].id,received:true};}

  private async refreshReviewState(organizationId:string,clientId:string){const onboarding=await this.onboarding(organizationId,clientId);if(!onboarding||!onboarding.submittedAt)return;const docs=await this.prisma.$queryRaw<Array<{documentType:string}>>`SELECT "documentType" FROM "EnterpriseVerificationDocument" WHERE "clientId"=${clientId}::uuid AND "deletedAt" IS NULL AND status<>'REJECTED'`;const types=new Set(docs.map(d=>d.documentType));const hasIdentity=types.has('IDENTITY_CARD')||types.has('PASSPORT');const hasAddress=types.has('PROOF_OF_ADDRESS');if(hasIdentity&&hasAddress)await this.prisma.$executeRaw`UPDATE "EnterpriseOnboarding" SET status='UNDER_REVIEW',"reviewStartedAt"=COALESCE("reviewStartedAt",CURRENT_TIMESTAMP),"updatedAt"=CURRENT_TIMESTAMP WHERE "clientId"=${clientId}::uuid AND status IN ('FORM_SUBMITTED','IDENTITY_PENDING','CHANGES_REQUESTED')`;}

  async documentTicket(organizationId:string,role:string,clientId:string,documentId:string){await this.ensureRoot(organizationId,role,true);await this.client(organizationId,clientId);const rows=await this.prisma.$queryRaw<any[]>`SELECT pathname,"deletedAt" FROM "EnterpriseVerificationDocument" WHERE id=${documentId}::uuid AND "clientId"=${clientId}::uuid AND "organizationId"=${organizationId}::uuid LIMIT 1`;const doc=rows[0];if(!doc||doc.deletedAt)throw new NotFoundException('Document not found');const validUntil=Date.now()+DOWNLOAD_TTL_MS;const token=await issueSignedToken({pathname:doc.pathname,operations:['get'],validUntil});const {presignedUrl}=await presignUrl(token,{access:'private',pathname:doc.pathname,operation:'get',validUntil});return{downloadUrl:presignedUrl,expiresAt:new Date(validUntil)};}

  async reviewDocument(organizationId:string,userId:string,role:string,clientId:string,documentId:string,payload:Record<string,unknown>){await this.ensureRoot(organizationId,role,true);const decision=safeString(payload.decision,20).toUpperCase();if(!['VERIFIED','REJECTED'].includes(decision))throw new BadRequestException('Invalid document decision');const reason=safeString(payload.reason,1000)||null;const retentionDeleteAt=decision==='VERIFIED'?new Date(Date.now()+7*24*60*60*1000):null;const rows=await this.prisma.$queryRaw<any[]>`UPDATE "EnterpriseVerificationDocument" SET status=${decision},"verifiedAt"=CASE WHEN ${decision}='VERIFIED' THEN CURRENT_TIMESTAMP ELSE NULL END,"verifiedByUserId"=${userId}::uuid,"rejectionReason"=${reason},"retentionDeleteAt"=${retentionDeleteAt},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${documentId}::uuid AND "clientId"=${clientId}::uuid AND "organizationId"=${organizationId}::uuid RETURNING *`;if(!rows[0])throw new NotFoundException('Document not found');await this.prisma.auditLog.create({data:{organizationId,userId,action:`ENTERPRISE_DOCUMENT_${decision}`,entityType:'Client',entityId:clientId,metadata:{documentId}}});return rows[0];}

  async reviewOnboarding(organizationId:string,userId:string,role:string,clientId:string,payload:Record<string,unknown>){await this.ensureRoot(organizationId,role,true);const action=safeString(payload.action,30).toUpperCase();const notes=safeString(payload.notes,4000)||null;const onboarding=await this.onboarding(organizationId,clientId);if(!onboarding)throw new NotFoundException('Onboarding not found');let next:string;
    if(action==='VERIFY'){const docs=await this.prisma.$queryRaw<Array<{documentType:string;status:string}>>`SELECT "documentType",status FROM "EnterpriseVerificationDocument" WHERE "clientId"=${clientId}::uuid AND "deletedAt" IS NULL`;const identity=docs.some(d=>(d.documentType==='IDENTITY_CARD'||d.documentType==='PASSPORT')&&d.status==='VERIFIED');const address=docs.some(d=>d.documentType==='PROOF_OF_ADDRESS'&&d.status==='VERIFIED');if(!identity||!address)throw new BadRequestException('Identity and proof of address must be verified first');next='VERIFIED';}
    else if(action==='REQUEST_CHANGES')next='CHANGES_REQUESTED';else if(action==='REJECT')next='REJECTED';else if(action==='APPROVE'){if(role!=='OWNER')throw new ForbiddenException('Only OWNER can approve Enterprise access');if(onboarding.status!=='VERIFIED')throw new BadRequestException('Agent verification is required before OWNER approval');next='APPROVED';}else throw new BadRequestException('Invalid onboarding action');
    await this.prisma.$executeRaw`UPDATE "EnterpriseOnboarding" SET status=${next},"reviewedAt"=CASE WHEN ${next} IN ('VERIFIED','REJECTED') THEN CURRENT_TIMESTAMP ELSE "reviewedAt" END,"reviewedByUserId"=CASE WHEN ${next} IN ('VERIFIED','REJECTED') THEN ${userId}::uuid ELSE "reviewedByUserId" END,"ownerApprovedAt"=CASE WHEN ${next}='APPROVED' THEN CURRENT_TIMESTAMP ELSE "ownerApprovedAt" END,"ownerApprovedByUserId"=CASE WHEN ${next}='APPROVED' THEN ${userId}::uuid ELSE "ownerApprovedByUserId" END,"reviewNotes"=${notes},"rejectionReason"=CASE WHEN ${next}='REJECTED' THEN ${notes} ELSE NULL END,"updatedAt"=CURRENT_TIMESTAMP WHERE "clientId"=${clientId}::uuid`;
    await this.prisma.auditLog.create({data:{organizationId,userId,action:`ENTERPRISE_ONBOARDING_${next}`,entityType:'Client',entityId:clientId,metadata:{notes}}});return this.adminReport(organizationId,role,clientId);
  }

  async purgeExpiredDocuments(secret:string|undefined){const expected=process.env.CRON_SECRET?.trim();if(!expected||secret!==expected)throw new UnauthorizedException('Invalid cron authorization');const docs=await this.prisma.$queryRaw<Array<{id:string;pathname:string}>>`SELECT id,pathname FROM "EnterpriseVerificationDocument" WHERE "deletedAt" IS NULL AND "retentionDeleteAt" IS NOT NULL AND "retentionDeleteAt"<=CURRENT_TIMESTAMP LIMIT 100`;let deleted=0;for(const doc of docs){try{await del(doc.pathname);await this.prisma.$executeRaw`UPDATE "EnterpriseVerificationDocument" SET status='DELETED',"deletedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${doc.id}::uuid`;deleted++;}catch(error){console.error('[enterprise-kyc] retention deletion failed',doc.id,error);}}return{deleted,checked:docs.length};}
}
