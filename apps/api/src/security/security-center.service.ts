import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, SupportConversationStatus, SupportMessageAuthor } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const MANAGER_ROLES = ['OWNER','ADMIN'];

@Injectable()
export class SecurityCenterService{
  constructor(private readonly prisma:PrismaService){}

  private async tenant(organizationId:string){
    const rows=await this.prisma.$queryRaw<Array<{id:string;tenantKind:string;managedByOrganizationId:string|null;isPlatformManaged:boolean}>>`
      SELECT id,"tenantKind","managedByOrganizationId","isPlatformManaged" FROM "Organization" WHERE id=${organizationId}::uuid LIMIT 1
    `;
    if(!rows[0])throw new BadRequestException('Organization not found');
    return rows[0];
  }

  private requireManager(role:string){if(!MANAGER_ROLES.includes(role))throw new ForbiddenException('Owner or administrator access required');}

  private async ensureConfig(organizationId:string){
    await this.prisma.$executeRaw`INSERT INTO "SecurityAutomationConfig" ("organizationId") VALUES (${organizationId}::uuid) ON CONFLICT ("organizationId") DO NOTHING`;
  }

  async status(organizationId:string){
    const tenant=await this.tenant(organizationId);
    const incidentRows=await this.prisma.$queryRaw<Array<{surface:string;severity:string;status:string;count:bigint}>>`
      SELECT surface,severity,status,count(*) AS count FROM "SecurityIncident"
      WHERE "organizationId"=${organizationId}::uuid AND status NOT IN ('RESOLVED','FALSE_POSITIVE')
      GROUP BY surface,severity,status
    `;
    const surfaces=['KHE_BOOTH','API','CAPTURE','SHARING','PROMOTIONAL_SITE','BILLING','AUTH'];
    const rank:Record<string,number>={INFO:0,LOW:1,MEDIUM:2,HIGH:3,CRITICAL:4};
    const health=surfaces.map(surface=>{
      const incidents=incidentRows.filter(row=>row.surface===surface);
      const worst=incidents.sort((a,b)=>(rank[b.severity]??0)-(rank[a.severity]??0))[0];
      return{surface,status:worst?(rank[worst.severity]>=3?'DEGRADED':'MONITORING'):'HEALTHY',severity:worst?.severity??'INFO',openIncidents:incidents.reduce((sum,row)=>sum+Number(row.count),0)};
    });
    return{tenantKind:tenant.tenantKind,managed:tenant.isPlatformManaged,overall:health.some(x=>x.status==='DEGRADED')?'DEGRADED':health.some(x=>x.status==='MONITORING')?'MONITORING':'HEALTHY',surfaces:health,detailsRestricted:tenant.tenantKind!=='KHE_ROOT'};
  }

  async overview(organizationId:string,userRole:string){
    const tenant=await this.tenant(organizationId);
    if(userRole!=='OWNER'||tenant.tenantKind!=='KHE_ROOT')throw new ForbiddenException('Detailed platform security is reserved for the KHE root owner');
    await this.ensureConfig(organizationId);
    const [config]=await this.prisma.$queryRaw<any[]>`SELECT * FROM "SecurityAutomationConfig" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;
    const incidents=await this.prisma.$queryRaw<any[]>`
      SELECT * FROM "SecurityIncident" WHERE "organizationId"=${organizationId}::uuid ORDER BY
      CASE severity WHEN 'CRITICAL' THEN 5 WHEN 'HIGH' THEN 4 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 2 ELSE 1 END DESC,"createdAt" DESC LIMIT 100
    `;
    const authEvents=await this.prisma.$queryRaw<any[]>`
      SELECT id,"userId",email,"eventType","ipAddress",metadata,"createdAt" FROM "PasswordSecurityEvent"
      WHERE "organizationId"=${organizationId}::uuid ORDER BY "createdAt" DESC LIMIT 100
    `;
    const audit=await this.prisma.$queryRaw<any[]>`
      SELECT id,"userId",action,"entityType","entityId",metadata,"createdAt" FROM "AuditLog"
      WHERE "organizationId"=${organizationId}::uuid ORDER BY "createdAt" DESC LIMIT 100
    `;
    return{...(await this.status(organizationId)),config,incidents,authEvents,audit,safeAutomaticActions:['LOCK_ACCOUNT_AFTER_FAILED_LOGINS','REVOKE_COMPROMISED_SESSION','BLOCK_SUSPICIOUS_AUTH_FLOW','RATE_LIMIT_REPEATED_FAILURES','NOTIFY_OWNER'],ownerApprovalRequiredFor:['DELETE_DATA','DISABLE_PRODUCTION_SERVICE','ROTATE_EXTERNAL_PROVIDER_CREDENTIALS','PAID_SECURITY_SERVICE','IRREVERSIBLE_CONFIGURATION_CHANGE']};
  }

  async devices(organizationId:string,userRole:string){
    this.requireManager(userRole);
    const now=new Date();
    const devices=await this.prisma.device.findMany({
      where:{organizationId},
      include:{sessions:{orderBy:{lastSeenAt:'desc'},take:8,include:{event:{select:{id:true,name:true,status:true}}}}},
      orderBy:{lastSeenAt:'desc'},
    });
    return devices.map(device=>({
      id:device.id,
      installationId:device.installationId,
      name:device.name,
      platform:device.platform,
      lastSeenAt:device.lastSeenAt,
      revokedAt:device.revokedAt,
      active:!device.revokedAt,
      sessions:device.sessions.map(session=>({id:session.id,event:session.event,mode:session.mode,lastSeenAt:session.lastSeenAt,expiresAt:session.expiresAt,revokedAt:session.revokedAt,online:!session.revokedAt&&session.expiresAt>now&&now.getTime()-session.lastSeenAt.getTime()<30_000})),
    }));
  }

  async revokeDevice(user:AuthenticatedUser,deviceId:string){
    this.requireManager(user.role);
    const device=await this.prisma.device.findFirst({where:{id:deviceId,organizationId:user.organizationId},select:{id:true,name:true,installationId:true,revokedAt:true}});
    if(!device)throw new NotFoundException('Device not found');
    const now=new Date();
    await this.prisma.$transaction([
      this.prisma.device.update({where:{id:device.id},data:{revokedAt:now}}),
      this.prisma.stationSession.updateMany({where:{organizationId:user.organizationId,deviceId:device.id,revokedAt:null},data:{revokedAt:now}}),
      this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'DEVICE_REVOKED',entityType:'Device',entityId:device.id,metadata:{name:device.name,installationId:device.installationId}}}),
    ]);
    return{revoked:true,id:device.id,revokedAt:now};
  }

  async reactivateDevice(user:AuthenticatedUser,deviceId:string){
    this.requireManager(user.role);
    const device=await this.prisma.device.findFirst({where:{id:deviceId,organizationId:user.organizationId},select:{id:true,name:true,installationId:true}});
    if(!device)throw new NotFoundException('Device not found');
    await this.prisma.$transaction([
      this.prisma.device.update({where:{id:device.id},data:{revokedAt:null}}),
      this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'DEVICE_REACTIVATED',entityType:'Device',entityId:device.id,metadata:{name:device.name,installationId:device.installationId}}}),
    ]);
    return{reactivated:true,id:device.id};
  }

  async revokeMyWebSessions(user:AuthenticatedUser){
    const rows=await this.prisma.$queryRaw<Array<{authVersion:number}>>`
      UPDATE "User" SET "authVersion"="authVersion"+1,"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${user.id}::uuid AND "organizationId"=${user.organizationId}::uuid
      RETURNING "authVersion"
    `;
    if(!rows[0])throw new NotFoundException('User not found');
    await this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'WEB_SESSIONS_REVOKED',entityType:'User',entityId:user.id,metadata:{authVersion:rows[0].authVersion}}});
    return{revoked:true,authVersion:rows[0].authVersion};
  }

  async audit(organizationId:string,userRole:string){
    this.requireManager(userRole);
    return this.prisma.auditLog.findMany({where:{organizationId},orderBy:{createdAt:'desc'},take:200});
  }

  async privacyExport(user:AuthenticatedUser){
    const accountRows=await this.prisma.$queryRaw<Array<Record<string,unknown>>>`
      SELECT id,email,"firstName","lastName",role,"isActive","notificationsEnabled","productUpdatesEnabled","supportNotificationsEnabled","createdAt","updatedAt"
      FROM "User" WHERE id=${user.id}::uuid AND "organizationId"=${user.organizationId}::uuid LIMIT 1
    `;
    if(!accountRows[0])throw new NotFoundException('User not found');
    const [organization,conversations,audit]=await Promise.all([
      this.prisma.organization.findUnique({where:{id:user.organizationId},select:{id:true,name:true,createdAt:true,updatedAt:true}}),
      this.prisma.supportConversation.findMany({where:{organizationId:user.organizationId,requesterUserId:user.id},include:{messages:{orderBy:{createdAt:'asc'}}},orderBy:{createdAt:'asc'}}),
      this.prisma.auditLog.findMany({where:{organizationId:user.organizationId,userId:user.id},orderBy:{createdAt:'asc'}}),
    ]);
    await this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'PRIVACY_EXPORT_GENERATED',entityType:'User',entityId:user.id}});
    return{format:'KHE_PRIVACY_EXPORT_V1',generatedAt:new Date(),account:accountRows[0],organization,supportConversations:conversations,audit};
  }

  async requestDeletion(user:AuthenticatedUser){
    const existing=await this.prisma.auditLog.findFirst({where:{organizationId:user.organizationId,userId:user.id,action:'DATA_DELETION_REQUESTED'},orderBy:{createdAt:'desc'}});
    if(existing&&Date.now()-existing.createdAt.getTime()<24*60*60*1000)return{requested:true,requestedAt:existing.createdAt,duplicate:true};
    const created=await this.prisma.supportConversation.create({
      data:{organizationId:user.organizationId,requesterUserId:user.id,subject:'Demande sécurisée de suppression des données',status:SupportConversationStatus.HANDOFF_REQUESTED,messages:{create:[{author:SupportMessageAuthor.USER,body:'Je demande la suppression de mes données KHE Booth. Merci de vérifier mon identité et les obligations de conservation applicables avant toute suppression.'},{author:SupportMessageAuthor.SYSTEM,body:'Demande créée depuis le centre de confidentialité authentifié. Aucune donnée n’est supprimée automatiquement avant vérification.'}]}},
    });
    const now=new Date();
    await this.prisma.$transaction([
      this.prisma.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'DATA_DELETION_REQUESTED',entityType:'User',entityId:user.id,metadata:{conversationId:created.id}}}),
      this.prisma.appNotification.create({data:{organizationId:user.organizationId,kind:NotificationKind.SUPPORT,title:'Demande de suppression à vérifier',body:'Une demande authentifiée de suppression des données nécessite une vérification humaine.',actionUrl:`/help?agentConversation=${created.id}`}}),
    ]);
    return{requested:true,requestedAt:now,conversationId:created.id,automaticDeletion:false};
  }

  async updateConfig(organizationId:string,userRole:string,payload:Record<string,unknown>){
    const tenant=await this.tenant(organizationId);
    if(userRole!=='OWNER'||tenant.tenantKind!=='KHE_ROOT')throw new ForbiddenException('Only the KHE root owner can manage platform security');
    await this.ensureConfig(organizationId);
    const mode=String(payload.mode??'AUTO_SAFE').toUpperCase();if(!['AUTO_SAFE','MANUAL'].includes(mode))throw new BadRequestException('Invalid security mode');
    const threshold=Math.min(10,Math.max(3,Math.trunc(Number(payload.failedLoginThreshold??5))));
    const minutes=Math.min(1440,Math.max(15,Math.trunc(Number(payload.healthScanMinutes??60))));
    await this.prisma.$executeRaw`
      UPDATE "SecurityAutomationConfig" SET mode=${mode},"safeAutoContainment"=${payload.safeAutoContainment!==false},"emailAlerts"=${payload.emailAlerts!==false},"ownerReports"=${payload.ownerReports!==false},"failedLoginThreshold"=${threshold},"healthScanMinutes"=${minutes},"updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=${organizationId}::uuid
    `;
    return this.overview(organizationId,userRole);
  }

  async updateIncident(organizationId:string,userRole:string,id:string,payload:Record<string,unknown>){
    const tenant=await this.tenant(organizationId);
    if(userRole!=='OWNER'||tenant.tenantKind!=='KHE_ROOT')throw new ForbiddenException('Only the KHE root owner can manage incidents');
    const status=String(payload.status??'MONITORING').toUpperCase();if(!['OPEN','CONTAINED','MONITORING','RESOLVED','FALSE_POSITIVE'].includes(status))throw new BadRequestException('Invalid incident status');
    const rows=await this.prisma.$queryRaw<any[]>`
      UPDATE "SecurityIncident" SET status=${status},"ownerReviewedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${id}::uuid AND "organizationId"=${organizationId}::uuid RETURNING *
    `;
    if(!rows[0])throw new BadRequestException('Incident not found');return rows[0];
  }

  async recordIncident(organizationId:string,input:{surface:string;severity:string;title:string;description:string;automaticAction?:string;ownerActionRequired?:boolean;metadata?:Record<string,unknown>}){
    const rows=await this.prisma.$queryRaw<any[]>`
      INSERT INTO "SecurityIncident" (id,"organizationId",surface,severity,status,title,description,"automaticAction","ownerActionRequired",metadata)
      VALUES (gen_random_uuid(),${organizationId}::uuid,${input.surface},${input.severity},${input.automaticAction?'CONTAINED':'OPEN'},${input.title},${input.description},${input.automaticAction??null},${Boolean(input.ownerActionRequired)},${JSON.stringify(input.metadata??{})}::jsonb) RETURNING *
    `;
    return rows[0];
  }
}
