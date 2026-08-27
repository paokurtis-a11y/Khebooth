import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { head, issueSignedToken, presignUrl } from '@vercel/blob';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const APPLICATION_STATUSES = new Set(['SUBMITTED','UNDER_REVIEW','CHANGES_REQUESTED','CONTRACT_PENDING','CONTRACT_SIGNED','ACTIVATION_SENT','ACTIVATED','REJECTED']);
const DOCUMENT_KINDS = new Set(['IDENTITY','PROOF_OF_ADDRESS','CV','SIGNED_CONTRACT','OTHER']);
const DOCUMENT_STATUSES = new Set(['PENDING','VALID','REJECTED']);
const LANGUAGES = new Set(['fr','en','de','it','es','pt']);
const CONTENT_TYPES = new Map([
  ['application/pdf','pdf'],['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','docx'],
]);
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

type ApplicationRow = {
  id:string; organizationId:string; applicationNumber:string; accessTokenHash:string; accessTokenExpiresAt:Date; status:string;
  firstName:string; lastName:string; email:string; phone:string; street:string; addressNumber:string;
  postalCode:string; city:string; countryCode:string; preferredLanguage:string; experienceYears:number;
  boothExperience:unknown; motivation:string|null; privacyAcceptedAt:Date; assignedToUserId:string|null;
  reviewedByUserId:string|null; decisionReason:string|null; reviewedAt:Date|null; approvedAt:Date|null;
  rejectedAt:Date|null; teamInvitationId:string|null; invitedUserId:string|null; activatedAt:Date|null;
  submittedAt:Date; createdAt:Date; updatedAt:Date;
};

type ContractRow = {
  id:string; organizationId:string; applicationId:string; contractNumber:string; countryCode:string;
  jurisdiction:string; language:string; status:string; contractSnapshot:unknown; contentHash:string;
  legalReviewRequired:boolean; legalReviewConfirmedAt:Date|null; legalReviewConfirmedByUserId:string|null; legalReviewReference:string|null;
  signatureMethod:string|null; signerName:string|null; signatureMention:string|null;
  signatureHash:string|null; signatureEvidence:unknown; sentAt:Date|null; signedAt:Date|null; createdAt:Date; updatedAt:Date;
};

function clean(value:unknown,max=500){return String(value??'').trim().slice(0,max);}
function tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}
function html(value:unknown){return String(value??'').replace(/[&<>'"]/g,(character)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' })[character]??character);}
function jurisdiction(countryCode:string){
  if(countryCode==='CH')return 'SWITZERLAND';
  if(['AT','BE','BG','HR','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HU','IE','IS','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SI','SK'].includes(countryCode))return 'EU_EEA';
  if(countryCode==='GB')return 'UNITED_KINGDOM';
  if(countryCode==='US')return 'UNITED_STATES';
  if(countryCode==='CA')return 'CANADA';
  return 'INTERNATIONAL';
}

const REQUIRED_MENTION:Record<string,string>={fr:'LU ET APPROUVE',en:'READ AND APPROVED',de:'GELESEN UND GENEHMIGT',it:'LETTO E APPROVATO',es:'LEIDO Y APROBADO',pt:'LIDO E APROVADO'};

@Injectable()
export class RecruitmentService {
  constructor(private readonly prisma:PrismaService) {}

  private async publicOrganizationId(){
    const rows=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1`;
    if(!rows[0])throw new ServiceUnavailableException('KHE Booth is not initialized');
    return rows[0].id;
  }

  private async applicationByToken(rawToken:string){
    if(!TOKEN_PATTERN.test(rawToken))throw new BadRequestException('Lien de candidature invalide');
    const rows=await this.prisma.$queryRaw<ApplicationRow[]>`SELECT * FROM "AgentApplication" WHERE "accessTokenHash"=${tokenHash(rawToken)} AND "accessTokenExpiresAt">CURRENT_TIMESTAMP LIMIT 1`;
    if(!rows[0])throw new NotFoundException('Candidature introuvable');
    return rows[0];
  }

  private async applicationForStaff(user:AuthenticatedUser,id:string){
    const rows=await this.prisma.$queryRaw<ApplicationRow[]>`SELECT * FROM "AgentApplication" WHERE id=${id}::uuid AND "organizationId"=${user.organizationId}::uuid LIMIT 1`;
    if(!rows[0])throw new NotFoundException('Candidature introuvable');
    return rows[0];
  }

  private publicApplication(row:ApplicationRow){
    const safe={...row} as Record<string,unknown>;
    delete safe.accessTokenHash;
    return safe;
  }

  private async documents(applicationId:string){
    return this.prisma.$queryRaw<any[]>`SELECT id,kind,"originalFileName","contentType","byteSize",status,"rejectionReason","reviewedAt","createdAt" FROM "AgentApplicationDocument" WHERE "applicationId"=${applicationId}::uuid ORDER BY "createdAt" DESC`;
  }

  private async contract(applicationId:string){
    const rows=await this.prisma.$queryRaw<ContractRow[]>`SELECT * FROM "AgentContract" WHERE "applicationId"=${applicationId}::uuid LIMIT 1`;
    return rows[0]??null;
  }

  async submit(payload:Record<string,unknown>){
    const organizationId=await this.publicOrganizationId();
    const firstName=clean(payload.firstName,100);const lastName=clean(payload.lastName,100);
    const email=clean(payload.email,240).toLowerCase();const phone=clean(payload.phone,60);
    const street=clean(payload.street,180);const addressNumber=clean(payload.addressNumber,30);
    const postalCode=clean(payload.postalCode,30);const city=clean(payload.city,120);
    const countryCode=clean(payload.countryCode,2).toUpperCase();
    const preferredLanguage=LANGUAGES.has(clean(payload.preferredLanguage,2).toLowerCase())?clean(payload.preferredLanguage,2).toLowerCase():'fr';
    const experienceYears=Math.max(0,Math.min(80,Math.trunc(Number(payload.experienceYears??0))||0));
    const boothExperience=Array.isArray(payload.boothExperience)?payload.boothExperience.map((item)=>clean(item,80)).filter(Boolean).slice(0,12):[];
    const motivation=clean(payload.motivation,4000)||null;
    if(!firstName||!lastName||!email.includes('@')||!phone||!street||!addressNumber||!postalCode||!city||!/^[A-Z]{2}$/.test(countryCode))throw new BadRequestException('Toutes les coordonnées obligatoires doivent être complétées');
    if(payload.privacyAccepted!==true)throw new BadRequestException('Le consentement au traitement de la candidature est obligatoire');
    const duplicate=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "AgentApplication" WHERE "organizationId"=${organizationId}::uuid AND lower(email)=${email} AND status NOT IN ('REJECTED','ACTIVATED') LIMIT 1`;
    if(duplicate[0])throw new BadRequestException('Une candidature active existe déjà pour cette adresse e-mail');
    const accessToken=randomBytes(32).toString('base64url');
    const accessTokenExpiresAt=new Date(Date.now()+90*86400000);
    const applicationNumber=`KHE-AGT-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const rows=await this.prisma.$queryRaw<ApplicationRow[]>`
      INSERT INTO "AgentApplication" (id,"organizationId","applicationNumber","accessTokenHash","accessTokenExpiresAt",status,"firstName","lastName",email,phone,street,"addressNumber","postalCode",city,"countryCode","preferredLanguage","experienceYears","boothExperience",motivation,"privacyAcceptedAt","submittedAt","createdAt","updatedAt")
      VALUES (gen_random_uuid(),${organizationId}::uuid,${applicationNumber},${tokenHash(accessToken)},${accessTokenExpiresAt},'SUBMITTED',${firstName},${lastName},${email},${phone},${street},${addressNumber},${postalCode},${city},${countryCode},${preferredLanguage},${experienceYears},${JSON.stringify(boothExperience)}::jsonb,${motivation},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const application=rows[0];
    const origin=this.webOrigin();const portalUrl=`${origin}/agent-application/${accessToken}`;
    await this.prisma.$executeRaw`INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt") VALUES (gen_random_uuid(),${organizationId}::uuid,'NEWS',${`Nouvelle candidature ${applicationNumber}`},${`${firstName} ${lastName} · ${countryCode}`},${`/applications/${application.id}`},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`;
    await Promise.allSettled([
      this.sendEmail(email,'Candidature KHE Booth reçue',`<h2>Bonjour ${html(firstName)},</h2><p>Votre candidature <strong>${applicationNumber}</strong> a bien été reçue.</p><p><a href="${html(portalUrl)}">Suivre ma candidature et transmettre mes documents</a></p><p>Ce lien est personnel. Ne le partagez pas.</p>`),
      this.notifyRecruitment(application,portalUrl),
    ]);
    return {applicationNumber,accessToken,portalUrl,status:application.status};
  }

  async publicContext(rawToken:string){
    const application=await this.applicationByToken(rawToken);const contract=await this.contract(application.id);
    return {application:this.publicApplication(application),documents:await this.documents(application.id),contract:contract?{...contract,contractSnapshot:undefined}:null,requirements:{identity:true,proofOfAddress:true,contractRequired:Boolean(contract),requiredMention:REQUIRED_MENTION[application.preferredLanguage]??REQUIRED_MENTION.fr,maximumDocumentBytes:MAX_DOCUMENT_BYTES,allowedContentTypes:[...CONTENT_TYPES.keys()]}};
  }

  async prepareDocument(rawToken:string,payload:Record<string,unknown>){
    const application=await this.applicationByToken(rawToken);
    if(['REJECTED','ACTIVATED'].includes(application.status))throw new BadRequestException('Cette candidature ne peut plus recevoir de document');
    const kind=clean(payload.kind,40).toUpperCase();const contentType=clean(payload.contentType,160).toLowerCase();const byteSize=Math.trunc(Number(payload.byteSize??0));
    const originalFileName=clean(payload.originalFileName,240);
    if(!DOCUMENT_KINDS.has(kind))throw new BadRequestException('Type de document invalide');
    const extension=CONTENT_TYPES.get(contentType);if(!extension)throw new BadRequestException('Format accepté : PDF, Word, JPG, PNG ou WebP');
    if(!Number.isInteger(byteSize)||byteSize<=0||byteSize>MAX_DOCUMENT_BYTES)throw new BadRequestException('Le document doit faire 15 Mo ou moins');
    const pathname=`organizations/${application.organizationId}/agent-applications/${application.id}/${kind.toLowerCase()}-${randomUUID()}.${extension}`;
    const validUntil=Date.now()+10*60*1000;
    try{
      const signed=await issueSignedToken({pathname,operations:['put'],validUntil,maximumSizeInBytes:byteSize,allowedContentTypes:[contentType]});
      const {presignedUrl}=await presignUrl(signed,{access:'private',pathname,operation:'put',validUntil,maximumSizeInBytes:byteSize,allowedContentTypes:[contentType],allowOverwrite:false});
      return {pathname,uploadUrl:presignedUrl,expiresAt:new Date(validUntil),kind,contentType,byteSize,originalFileName:originalFileName||`${kind}.${extension}`};
    }catch(error){throw new ServiceUnavailableException(error instanceof Error?error.message:'Stockage temporairement indisponible');}
  }

  async confirmDocument(rawToken:string,payload:Record<string,unknown>){
    const application=await this.applicationByToken(rawToken);const pathname=clean(payload.pathname,600);const kind=clean(payload.kind,40).toUpperCase();const contentType=clean(payload.contentType,160).toLowerCase();const byteSize=Math.trunc(Number(payload.byteSize??0));
    const prefix=`organizations/${application.organizationId}/agent-applications/${application.id}/`;
    if(!pathname.startsWith(prefix)||!DOCUMENT_KINDS.has(kind)||!CONTENT_TYPES.has(contentType))throw new BadRequestException('Document invalide');
    try{const blob=await head(pathname);if(blob.size!==byteSize||blob.contentType!==contentType)throw new BadRequestException('Le document reçu ne correspond pas au fichier annoncé');}catch(error){if(error instanceof BadRequestException)throw error;throw new BadRequestException('Document introuvable après le téléversement');}
    const rows=await this.prisma.$queryRaw<any[]>`INSERT INTO "AgentApplicationDocument" (id,"organizationId","applicationId",kind,pathname,"originalFileName","contentType","byteSize",status,"createdAt") VALUES (gen_random_uuid(),${application.organizationId}::uuid,${application.id}::uuid,${kind},${pathname},${clean(payload.originalFileName,240)||'document'},${contentType},${byteSize},'PENDING',CURRENT_TIMESTAMP) ON CONFLICT (pathname) DO UPDATE SET "originalFileName"=EXCLUDED."originalFileName" RETURNING id,kind,"originalFileName","contentType","byteSize",status,"createdAt"`;
    return rows[0];
  }

  async list(user:AuthenticatedUser,status?:string,search?:string){
    const normalizedStatus=clean(status,40).toUpperCase()||null;if(normalizedStatus&&!APPLICATION_STATUSES.has(normalizedStatus))throw new BadRequestException('Statut invalide');
    const term=clean(search,120).toLowerCase();const pattern=term?`%${term}%`:null;
    const rows=await this.prisma.$queryRaw<any[]>`
      SELECT a.*,count(d.id)::int AS "documentCount",count(d.id) FILTER (WHERE d.status='PENDING')::int AS "pendingDocumentCount"
      FROM "AgentApplication" a LEFT JOIN "AgentApplicationDocument" d ON d."applicationId"=a.id
      WHERE a."organizationId"=${user.organizationId}::uuid AND (${normalizedStatus}::text IS NULL OR a.status=${normalizedStatus})
        AND (${pattern}::text IS NULL OR lower(a."firstName"||' '||a."lastName") LIKE ${pattern} OR lower(a.email) LIKE ${pattern} OR lower(a."applicationNumber") LIKE ${pattern})
      GROUP BY a.id ORDER BY CASE a.status WHEN 'SUBMITTED' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 WHEN 'CHANGES_REQUESTED' THEN 2 WHEN 'CONTRACT_PENDING' THEN 3 ELSE 4 END,a."createdAt" DESC LIMIT 250
    `;
    return {items:rows.map((row)=>this.publicApplication(row)),statuses:[...APPLICATION_STATUSES]};
  }

  async staffContext(user:AuthenticatedUser,id:string){
    const application=await this.applicationForStaff(user,id);const contract=await this.contract(id);
    const reviewers=await this.prisma.$queryRaw<Array<{id:string;firstName:string|null;lastName:string|null;email:string}>>`SELECT id,"firstName","lastName",email FROM "User" WHERE "organizationId"=${user.organizationId}::uuid AND role IN ('OWNER','ADMIN') AND "isActive"=TRUE ORDER BY "firstName","lastName"`;
    return {application:this.publicApplication(application),documents:await this.documents(id),contract,reviewers};
  }

  async updateReview(user:AuthenticatedUser,id:string,payload:Record<string,unknown>){
    const application=await this.applicationForStaff(user,id);const status=clean(payload.status,40).toUpperCase();
    if(!['UNDER_REVIEW','CHANGES_REQUESTED'].includes(status))throw new BadRequestException('Transition de revue invalide');
    const reason=clean(payload.reason,3000)||null;const assignedTo=clean(payload.assignedToUserId,60)||user.id;
    await this.prisma.$executeRaw`UPDATE "AgentApplication" SET status=${status},"assignedToUserId"=${assignedTo}::uuid,"reviewedByUserId"=${user.id}::uuid,"decisionReason"=${reason},"reviewedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND "organizationId"=${user.organizationId}::uuid`;
    await this.audit(user,'AGENT_APPLICATION_REVIEW_UPDATED',id,{status});
    if(status==='CHANGES_REQUESTED')await this.sendEmail(application.email,'Complément demandé pour votre candidature KHE Booth',`<p>Bonjour ${html(application.firstName)},</p><p>L’équipe KHE vous demande un complément :</p><p><strong>${html(reason||'Consultez votre espace candidat.')}</strong></p><p>Utilisez le lien personnel reçu dans l’e-mail de confirmation de votre candidature.</p>`);
    return this.staffContext(user,id);
  }

  async reviewDocument(user:AuthenticatedUser,applicationId:string,documentId:string,payload:Record<string,unknown>){
    await this.applicationForStaff(user,applicationId);const status=clean(payload.status,20).toUpperCase();if(!DOCUMENT_STATUSES.has(status)||status==='PENDING')throw new BadRequestException('Décision documentaire invalide');
    const reason=status==='REJECTED'?clean(payload.reason,1000)||'Document à remplacer':null;
    const count=await this.prisma.$executeRaw`UPDATE "AgentApplicationDocument" SET status=${status},"rejectionReason"=${reason},"reviewedByUserId"=${user.id}::uuid,"reviewedAt"=CURRENT_TIMESTAMP WHERE id=${documentId}::uuid AND "applicationId"=${applicationId}::uuid AND "organizationId"=${user.organizationId}::uuid`;
    if(!count)throw new NotFoundException('Document introuvable');await this.audit(user,'AGENT_APPLICATION_DOCUMENT_REVIEWED',documentId,{status});return this.staffContext(user,applicationId);
  }

  async decide(user:AuthenticatedUser,id:string,payload:Record<string,unknown>){
    const application=await this.applicationForStaff(user,id);const decision=clean(payload.decision,20).toUpperCase();const reason=clean(payload.reason,3000)||null;
    if(decision==='REJECT'){
      if(!reason)throw new BadRequestException('Un motif de refus est obligatoire');
      await this.prisma.$executeRaw`UPDATE "AgentApplication" SET status='REJECTED',"reviewedByUserId"=${user.id}::uuid,"decisionReason"=${reason},"reviewedAt"=CURRENT_TIMESTAMP,"rejectedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid`;
      await this.sendEmail(application.email,'Décision concernant votre candidature KHE Booth',`<p>Bonjour ${html(application.firstName)},</p><p>Après examen, nous ne pouvons pas donner une suite favorable à votre candidature.</p><p>${html(reason)}</p>`);
      await this.audit(user,'AGENT_APPLICATION_REJECTED',id,{reason});return this.staffContext(user,id);
    }
    if(decision!=='APPROVE')throw new BadRequestException('Décision invalide');
    if(application.status==='REJECTED'||application.status==='ACTIVATED')throw new BadRequestException('Cette candidature ne peut plus être approuvée');
    const contract=await this.ensureContract(application);
    await this.prisma.$executeRaw`UPDATE "AgentApplication" SET status='CONTRACT_PENDING',"reviewedByUserId"=${user.id}::uuid,"decisionReason"=${reason},"reviewedAt"=CURRENT_TIMESTAMP,"approvedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid`;
    await this.prisma.$executeRaw`UPDATE "AgentContract" SET status='SENT',"sentAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${contract.id}::uuid`;
    await this.sendEmail(application.email,'Votre candidature KHE Booth est préapprouvée',`<p>Bonjour ${html(application.firstName)},</p><p>Votre candidature est préapprouvée. Votre contrat personnalisé est disponible dans votre espace candidat.</p><p>La validation définitive reste soumise au contrôle des documents, à la signature et, selon le pays, à la revue juridique.</p>`);
    await this.audit(user,'AGENT_APPLICATION_APPROVED',id,{contractId:contract.id});return this.staffContext(user,id);
  }

  async signContract(rawToken:string,payload:Record<string,unknown>){
    const application=await this.applicationByToken(rawToken);const contract=await this.contract(application.id);if(!contract||!['SENT','DRAFT'].includes(contract.status))throw new BadRequestException('Contrat indisponible ou déjà signé');
    const signerName=clean(payload.signerName,200);const signatureMethod=clean(payload.signatureMethod,30).toUpperCase();const mention=clean(payload.mention,100).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();const required=REQUIRED_MENTION[contract.language]??REQUIRED_MENTION.fr;
    if(!signerName||signerName.toLowerCase()!==`${application.firstName} ${application.lastName}`.toLowerCase())throw new BadRequestException('Le nom du signataire doit correspondre au candidat');
    if(!['TYPED','DRAWN'].includes(signatureMethod))throw new BadRequestException('Méthode de signature invalide');
    if(mention!==required.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()||payload.acceptContract!==true)throw new BadRequestException(`Saisissez « ${required} » et acceptez le contrat`);
    const signedAt=new Date();const evidence={signedAt:signedAt.toISOString(),method:signatureMethod,applicationId:application.id,contractId:contract.id,contentHash:contract.contentHash};const signatureHash=createHash('sha256').update(JSON.stringify({...evidence,signerName,mention})).digest('hex');
    await this.prisma.$executeRaw`UPDATE "AgentContract" SET status='SIGNED',"signatureMethod"=${signatureMethod},"signerName"=${signerName},"signatureMention"=${mention},"signatureHash"=${signatureHash},"signatureEvidence"=${JSON.stringify(evidence)}::jsonb,"signedAt"=${signedAt},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${contract.id}::uuid`;
    await this.prisma.$executeRaw`UPDATE "AgentApplication" SET status='CONTRACT_SIGNED',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${application.id}::uuid`;
    await this.prisma.$executeRaw`INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt") VALUES (gen_random_uuid(),${application.organizationId}::uuid,'NEWS','Contrat agent signé',${`${application.firstName} ${application.lastName} · ${application.applicationNumber}`},${`/applications/${application.id}`},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`;
    return this.publicContext(rawToken);
  }

  async confirmLegalReview(user:AuthenticatedUser,id:string,payload:Record<string,unknown>){
    await this.applicationForStaff(user,id);const contract=await this.contract(id);if(!contract)throw new BadRequestException('Contrat introuvable');
    const reference=clean(payload.reference,500);if(payload.confirmed!==true||reference.length<3)throw new BadRequestException('Indiquez la référence de la revue juridique locale');
    await this.prisma.$executeRaw`UPDATE "AgentContract" SET "legalReviewConfirmedAt"=CURRENT_TIMESTAMP,"legalReviewConfirmedByUserId"=${user.id}::uuid,"legalReviewReference"=${reference},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${contract.id}::uuid`;
    await this.audit(user,'AGENT_CONTRACT_LEGAL_REVIEW_CONFIRMED',id,{contractId:contract.id,reference});return this.staffContext(user,id);
  }

  async activate(user:AuthenticatedUser,id:string){
    const application=await this.applicationForStaff(user,id);const contract=await this.contract(id);if(!contract||contract.status!=='SIGNED')throw new BadRequestException('Le contrat doit être signé avant l’activation');
    if(contract.legalReviewRequired&&!contract.legalReviewConfirmedAt){
      await this.prisma.$executeRaw`UPDATE "AgentContract" SET "legalReviewConfirmedAt"=CURRENT_TIMESTAMP,"legalReviewConfirmedByUserId"=${user.id}::uuid,"legalReviewReference"='Confirmation explicite lors de l’activation KHE',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${contract.id}::uuid`;
      await this.audit(user,'AGENT_CONTRACT_LEGAL_REVIEW_CONFIRMED_AT_ACTIVATION',id,{contractId:contract.id});
    }
    const valid=await this.prisma.$queryRaw<Array<{kind:string}>>`SELECT DISTINCT kind FROM "AgentApplicationDocument" WHERE "applicationId"=${id}::uuid AND status='VALID'`;
    const kinds=new Set(valid.map((item)=>item.kind));if(!kinds.has('IDENTITY')||!kinds.has('PROOF_OF_ADDRESS'))throw new BadRequestException('Une pièce d’identité et un justificatif de domicile validés sont obligatoires');
    if(application.teamInvitationId)throw new BadRequestException('Une invitation d’activation existe déjà');
    const existing=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "User" WHERE lower(email)=${application.email.toLowerCase()} LIMIT 1`;if(existing[0])throw new BadRequestException('Un compte existe déjà avec cette adresse e-mail');
    const token=randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+7*86400000);const permissions={'applications.manage':false};
    const rows=await this.prisma.$queryRaw<Array<{id:string}>>`INSERT INTO "TeamInvitation" (id,"organizationId",email,role,permissions,"tokenHash","expiresAt","invitedByUserId","createdAt") VALUES (gen_random_uuid(),${user.organizationId}::uuid,${application.email.toLowerCase()},${UserRole.OPERATOR}::"UserRole",${JSON.stringify(permissions)}::jsonb,${tokenHash(token)},${expiresAt},${user.id}::uuid,CURRENT_TIMESTAMP) RETURNING id`;
    await this.prisma.$executeRaw`UPDATE "AgentApplication" SET status='ACTIVATION_SENT',"teamInvitationId"=${rows[0].id}::uuid,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid`;
    const inviteUrl=`${this.webOrigin()}/invite/${token}`;
    await this.sendEmail(application.email,'Créez votre accès Agent KHE Booth',`<h2>Bienvenue chez KHE Booth</h2><p>Votre dossier est validé. Créez maintenant vos identifiants sécurisés :</p><p><a href="${html(inviteUrl)}">Activer mon compte agent</a></p><p>Le lien expire dans 7 jours. La page de connexion comporte la procédure « Mot de passe oublié ».</p>`);
    await this.audit(user,'AGENT_APPLICATION_ACTIVATION_SENT',id,{invitationId:rows[0].id});return {activated:false,invitationSent:true,expiresAt};
  }

  async documentTicket(user:AuthenticatedUser,applicationId:string,documentId:string){
    await this.applicationForStaff(user,applicationId);const rows=await this.prisma.$queryRaw<Array<{pathname:string;contentType:string;originalFileName:string}>>`SELECT pathname,"contentType","originalFileName" FROM "AgentApplicationDocument" WHERE id=${documentId}::uuid AND "applicationId"=${applicationId}::uuid AND "organizationId"=${user.organizationId}::uuid LIMIT 1`;if(!rows[0])throw new NotFoundException('Document introuvable');
    const validUntil=Date.now()+5*60*1000;const signed=await issueSignedToken({pathname:rows[0].pathname,operations:['get'],validUntil});const {presignedUrl}=await presignUrl(signed,{access:'private',pathname:rows[0].pathname,operation:'get',validUntil});return {downloadUrl:presignedUrl,expiresAt:new Date(validUntil),contentType:rows[0].contentType,originalFileName:rows[0].originalFileName};
  }

  private async ensureContract(application:ApplicationRow){
    const existing=await this.contract(application.id);if(existing)return existing;
    const contractNumber=`KHE-CTR-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;const region=jurisdiction(application.countryCode);
    const snapshot={version:1,brand:{name:'KHE BOOTH',legalEntity:'Kurtis Hypnotic Events',country:'Switzerland'},candidate:{name:`${application.firstName} ${application.lastName}`,email:application.email,phone:application.phone,address:`${application.street} ${application.addressNumber}, ${application.postalCode} ${application.city}`,countryCode:application.countryCode},engagement:{role:'Agent KHE Booth',services:['Photobooth Station','Photobooth 360°','Capture & Sharing'],independentStatus:'To be confirmed during legal review'},jurisdiction:region,clauses:this.clauses(region),requiredDocuments:['IDENTITY','PROOF_OF_ADDRESS'],notice:'Modèle opérationnel personnalisé. La conformité sociale, fiscale et contractuelle finale doit être confirmée par un juriste qualifié dans le pays de résidence avant activation.'};
    const contentHash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const rows=await this.prisma.$queryRaw<ContractRow[]>`INSERT INTO "AgentContract" (id,"organizationId","applicationId","contractNumber","countryCode",jurisdiction,language,status,"contractSnapshot","contentHash","legalReviewRequired","createdAt","updatedAt") VALUES (gen_random_uuid(),${application.organizationId}::uuid,${application.id}::uuid,${contractNumber},${application.countryCode},${region},${application.preferredLanguage},'DRAFT',${JSON.stringify(snapshot)}::jsonb,${contentHash},TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *`;
    return rows[0];
  }

  private clauses(region:string){
    const common=[{title:'Mission',body:'L’agent accompagne les opérations Photobooth Station et Photobooth 360°, la capture, le partage et la qualité de l’expérience client.'},{title:'Confidentialité et données',body:'Les données, médias, accès et informations KHE ne peuvent être utilisés que pour la mission autorisée. Les règles de confidentialité et de sécurité KHE s’appliquent.'},{title:'Rémunération et planning',body:'Chaque mission, disponibilité, frais et rémunération fait l’objet d’une confirmation opérationnelle distincte avant exécution.'},{title:'Sécurité et matériel',body:'L’agent respecte les consignes de sécurité, signale tout incident et prend soin du matériel confié.'},{title:'Fin de collaboration',body:'Les droits d’accès sont révoqués à la fin de la relation. Les obligations de confidentialité et de restitution subsistent.'}];
    const regional:Record<string,{title:string;body:string}>={SWITZERLAND:{title:'Cadre suisse',body:'Le statut de la relation, les assurances sociales, la fiscalité, la durée et le for compétent doivent être validés au regard du droit suisse et du canton concerné.'},EU_EEA:{title:'Cadre UE/EEE',body:'Le statut du travail, la fiscalité, la protection sociale, le droit local et la protection des données doivent être validés dans le pays de résidence.'},UNITED_KINGDOM:{title:'Cadre britannique',body:'Employment status, tax, data protection and governing law require validation under the law applicable in the United Kingdom.'},UNITED_STATES:{title:'Cadre américain',body:'Worker classification, tax, insurance, governing law and state-specific requirements require local legal review.'},CANADA:{title:'Cadre canadien',body:'Worker classification, tax, insurance, privacy and provincial requirements require local legal review.'},INTERNATIONAL:{title:'Cadre international',body:'Le statut, la fiscalité, les assurances, le droit applicable et les exigences locales doivent être confirmés dans le pays de résidence.'}};
    return [...common,regional[region]??regional.INTERNATIONAL];
  }

  private webOrigin(){return (process.env.WEB_ORIGIN||'https://khebooth-rdvo.vercel.app').split(',')[0].trim().replace(/\/$/,'');}
  private async recruitmentEmail(organizationId:string){
    const configured=process.env.KHE_RECRUITMENT_EMAIL?.trim();if(configured)return configured;
    const rows=await this.prisma.$queryRaw<Array<{supportEmail:string|null}>>`SELECT "supportEmail" FROM "MarketingSiteConfig" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;return rows[0]?.supportEmail||null;
  }
  private async notifyRecruitment(application:ApplicationRow,portalUrl:string){const recipient=await this.recruitmentEmail(application.organizationId);if(!recipient)return false;return this.sendEmail(recipient,`Nouvelle candidature ${application.applicationNumber}`,`<h2>${html(application.firstName)} ${html(application.lastName)}</h2><p>${html(application.email)} · ${html(application.phone)}</p><p>${html(application.city)} · ${html(application.countryCode)}</p><p><a href="${html(portalUrl)}">Espace candidat</a> · <a href="${html(`${this.webOrigin()}/applications/${application.id}`)}">Dossier KHE Booth</a></p>`);}
  private async sendEmail(to:string,subject:string,htmlBody:string){const key=process.env.RESEND_API_KEY?.trim();const from=(process.env.KHE_EMAIL_FROM||process.env.MAIL_FROM)?.trim();if(!key||!from)return false;try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html:`<div style="font-family:Arial,sans-serif;color:#17202a;line-height:1.6"><div style="color:#b68a24;font-weight:800;letter-spacing:.08em">KHE BOOTH</div>${htmlBody}<hr><small>Kurtis Hypnotic Events · Votre événement, notre expertise</small></div>`})});return response.ok;}catch{return false;}}
  private async audit(user:AuthenticatedUser,action:string,entityId:string,metadata:Record<string,unknown>){await this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action,entityType:'AgentApplication',entityId,metadata:JSON.parse(JSON.stringify(metadata))}});}
}
