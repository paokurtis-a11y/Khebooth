import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class ClientEnterpriseAccessService{
  constructor(private readonly prisma:PrismaService,private readonly auth:AuthService){}

  private async ensureRootOwner(organizationId:string,role:string){
    const rows=await this.prisma.$queryRaw<Array<{tenantKind:string}>>`SELECT "tenantKind" FROM "Organization" WHERE id=${organizationId}::uuid LIMIT 1`;
    if(role!=='OWNER'||rows[0]?.tenantKind!=='KHE_ROOT')throw new ForbiddenException('Only the KHE root owner can manage Enterprise portal access');
  }

  private async client(organizationId:string,clientId:string){
    const rows=await this.prisma.$queryRaw<Array<{id:string;name:string;email:string|null;companyName:string|null;subscriptionPlan:string;subscriptionStatus:string;paymentStatus:string}>>`
      SELECT id,name,email,"companyName","subscriptionPlan","subscriptionStatus","paymentStatus" FROM "Client"
      WHERE id=${clientId}::uuid AND "organizationId"=${organizationId}::uuid LIMIT 1
    `;
    if(!rows[0])throw new NotFoundException('Client not found');return rows[0];
  }

  private async requireApprovedOnboarding(organizationId:string,clientId:string){
    const rows=await this.prisma.$queryRaw<Array<{status:string}>>`
      SELECT status FROM "EnterpriseOnboarding" WHERE "organizationId"=${organizationId}::uuid AND "clientId"=${clientId}::uuid LIMIT 1`;
    if(rows[0]?.status!=='APPROVED')throw new BadRequestException('Enterprise identity verification and OWNER approval are required before enabling platform access');
  }

  async setAccess(rootOrganizationId:string,ownerUserId:string,ownerRole:string,clientId:string,enabled:boolean){
    await this.ensureRootOwner(rootOrganizationId,ownerRole);const client=await this.client(rootOrganizationId,clientId);
    if(enabled&&client.subscriptionPlan!=='ENTERPRISE')throw new BadRequestException('Enterprise KHE Booth access requires the ENTERPRISE plan');
    if(enabled&&client.paymentStatus!=='PAID')throw new BadRequestException('Enterprise payment must be validated before enabling KHE Booth access');
    if(enabled&&!client.email)throw new BadRequestException('A valid client email is required before enabling KHE Booth access');
    if(enabled)await this.requireApprovedOnboarding(rootOrganizationId,clientId);

    const existing=await this.prisma.$queryRaw<Array<{id:string;organizationId:string;email:string;isActive:boolean}>>`
      SELECT u.id,u."organizationId",u.email,u."isActive" FROM "User" u
      JOIN "Organization" o ON o.id=u."organizationId"
      WHERE u."managedClientId"=${clientId}::uuid AND o."managedByOrganizationId"=${rootOrganizationId}::uuid
      ORDER BY u."createdAt" ASC LIMIT 1
    `;

    let managedUser=existing[0]??null;
    if(enabled&&!managedUser){
      const company=(client.companyName||client.name||'Client Enterprise').trim().slice(0,150);const email=client.email!.trim().toLowerCase();const randomPassword=await argon2.hash(randomBytes(32).toString('hex'));
      const created=await this.prisma.$transaction(async tx=>{
        const orgRows=await tx.$queryRaw<Array<{id:string}>>`
          INSERT INTO "Organization" (id,name,"tenantKind","managedByOrganizationId","isPlatformManaged","createdAt","updatedAt")
          VALUES (gen_random_uuid(),${`Enterprise • ${company}`},'ENTERPRISE_CLIENT',${rootOrganizationId}::uuid,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
          RETURNING id
        `;
        const childOrgId=orgRows[0].id;
        const userRows=await tx.$queryRaw<Array<{id:string;organizationId:string;email:string;isActive:boolean}>>`
          INSERT INTO "User" (id,"organizationId",email,"passwordHash","firstName","lastName",role,"isActive",permissions,"managedClientId","passwordResetRequired","authVersion","createdAt","updatedAt")
          VALUES (gen_random_uuid(),${childOrgId}::uuid,${email},${randomPassword},${client.name.split(/\s+/)[0]||'Client'},${client.name.split(/\s+/).slice(1).join(' ')||'Enterprise'},'ADMIN',TRUE,
            ${JSON.stringify({
              'dashboard.view':true,'clients.view':true,'events.view':true,'events.manage':true,'studio.view':true,
              'marketing.view':true,'reports.export':true,'communications.manage':false,'site.manage':false,'team.manage':false,
              'clients.manage':false,'clients.delete':false,'marketing.manage':false
            })}::jsonb,${clientId}::uuid,TRUE,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
          RETURNING id,"organizationId",email,"isActive"
        `;
        await tx.auditLog.create({data:{organizationId:rootOrganizationId,userId:ownerUserId,action:'ENTERPRISE_ACCESS_CREATED',entityType:'Client',entityId:clientId,metadata:{childOrganizationId:childOrgId,userId:userRows[0].id}}});
        return userRows[0];
      });
      managedUser=created;
    }else if(managedUser){
      await this.prisma.$executeRaw`UPDATE "User" SET "isActive"=${enabled},"authVersion"="authVersion"+1,"passwordResetRequired"=${enabled?true:false},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${managedUser.id}::uuid`;
      await this.prisma.auditLog.create({data:{organizationId:rootOrganizationId,userId:ownerUserId,action:enabled?'ENTERPRISE_ACCESS_ENABLED':'ENTERPRISE_ACCESS_DISABLED',entityType:'Client',entityId:clientId,metadata:{managedUserId:managedUser.id}}});
    }

    if(enabled&&managedUser?.email)await this.auth.requestPasswordReset(managedUser.email,{userAgent:'KHE_OWNER_MANAGED_ACCESS'});
    return this.report(rootOrganizationId,ownerRole,clientId);
  }

  async report(rootOrganizationId:string,ownerRole:string,clientId:string){
    await this.ensureRootOwner(rootOrganizationId,ownerRole);const client=await this.client(rootOrganizationId,clientId);
    const users=await this.prisma.$queryRaw<Array<{id:string;organizationId:string;email:string;role:string;isActive:boolean;failedLoginAttempts:number;passwordResetRequired:boolean;passwordChangedAt:Date|null;passwordChangeCount:number;createdAt:Date}>>`
      SELECT u.id,u."organizationId",u.email,u.role::text AS role,u."isActive",u."failedLoginAttempts",u."passwordResetRequired",u."passwordChangedAt",u."passwordChangeCount",u."createdAt"
      FROM "User" u JOIN "Organization" o ON o.id=u."organizationId"
      WHERE u."managedClientId"=${clientId}::uuid AND o."managedByOrganizationId"=${rootOrganizationId}::uuid ORDER BY u."createdAt" ASC
    `;
    const userIds=users.map(u=>u.id);
    const events=userIds.length?await this.prisma.$queryRaw<any[]>`
      SELECT id,"userId",email,"eventType","ipAddress",metadata,"createdAt" FROM "PasswordSecurityEvent"
      WHERE "userId"=ANY(${userIds}::uuid[]) ORDER BY "createdAt" DESC LIMIT 100
    `:[];
    const resetRequests=events.filter((event:any)=>event.eventType==='PASSWORD_RESET_REQUESTED').length;
    const failedAttempts=events.filter((event:any)=>event.eventType==='LOGIN_PASSWORD_FAILED'||event.eventType==='PASSWORD_LOCKED_AFTER_FAILURES').length;
    const onboardingRows=await this.prisma.$queryRaw<Array<{status:string}>>`SELECT status FROM "EnterpriseOnboarding" WHERE "clientId"=${clientId}::uuid LIMIT 1`;
    return{
      client:{id:client.id,name:client.name,email:client.email,subscriptionPlan:client.subscriptionPlan,subscriptionStatus:client.subscriptionStatus,paymentStatus:client.paymentStatus},
      onboardingStatus:onboardingRows[0]?.status??'PAYMENT_PENDING',
      accessEnabled:users.some(user=>user.isActive),
      users,
      passwordReport:{resetRequests,failedAttempts,passwordChanges:users.reduce((sum,user)=>sum+Number(user.passwordChangeCount||0),0),lastPasswordChangeAt:users.map(u=>u.passwordChangedAt).filter(Boolean).sort((a,b)=>new Date(b!).getTime()-new Date(a!).getTime())[0]??null,events},
      ownerControlsOnly:true,
      isolation:'ENTERPRISE_CLIENT_TENANT',
      securityVisibility:'HEALTH_STATUS_ONLY',
    };
  }
}
