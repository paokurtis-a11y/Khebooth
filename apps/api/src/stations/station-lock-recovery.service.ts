import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

const RECOVERY_TTL_MS=10*60*1000;

@Injectable()
export class StationLockRecoveryService{
  constructor(private readonly prisma:PrismaService){}
  private hash(value:string){return createHash('sha256').update(value).digest('hex');}
  private sameHash(a:string,b:string){try{const left=Buffer.from(a,'hex');const right=Buffer.from(b,'hex');return left.length===right.length&&timingSafeEqual(left,right);}catch{return false;}}
  private mask(email:string){const[local,domain]=email.split('@');if(!domain)return email;return`${local.slice(0,2)}${'*'.repeat(Math.max(2,local.length-2))}@${domain}`;}
  private async recoveryEmail(station:AuthenticatedStation){
    const rows=await this.prisma.$queryRaw<Array<{email:string|null}>>(Prisma.sql`
      SELECT COALESCE(NULLIF(btrim(p.email),''),c.email) AS email
      FROM "Event" e
      LEFT JOIN "OrganizationProfile" p ON p."organizationId"=e."organizationId"
      LEFT JOIN "Client" c ON c.id=e."clientId"
      WHERE e.id=${station.eventId}::uuid AND e."organizationId"=${station.organizationId}::uuid LIMIT 1`);
    const email=String(rows[0]?.email??'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new BadRequestException('Ajoutez une adresse e-mail valide au profil KHE avant d’utiliser la récupération du mot de passe de régie.');
    return email;
  }
  async request(station:AuthenticatedStation){
    const email=await this.recoveryEmail(station);const code=String(randomInt(100000,1000000));const rawToken=randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+RECOVERY_TTL_MS);
    await this.prisma.$executeRaw(Prisma.sql`UPDATE "StationLockRecoveryToken" SET "usedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "usedAt" IS NULL`);
    await this.prisma.$executeRaw(Prisma.sql`INSERT INTO "StationLockRecoveryToken" (id,"organizationId","eventId","tokenHash","codeHash",email,"expiresAt") VALUES (gen_random_uuid(),${station.organizationId}::uuid,${station.eventId}::uuid,${this.hash(rawToken)},${this.hash(code)},${email},${expiresAt})`);
    const key=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!key||!from)throw new ServiceUnavailableException('Le service e-mail KHE n’est pas configuré. Contactez le support pour récupérer la régie.');
    const deepLink=`khebooth://lock-recovery?token=${encodeURIComponent(rawToken)}`;
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:'Récupération du mot de passe de régie KHE Booth',html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><div style="background:#0d0d0f;padding:24px;border-radius:18px;color:#fff"><div style="color:#d2ad4f;font-weight:900;letter-spacing:3px">KHE BOOTH</div><h2>Récupérer la régie SHARING</h2><p>Une demande de récupération a été faite pour votre station événement.</p><p><a href="${deepLink}" style="display:inline-block;background:#b31520;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:800">CRÉER UN NOUVEAU MOT DE PASSE</a></p><p>Si le bouton ne rouvre pas automatiquement KHE Booth, saisissez ce code dans l’application :</p><div style="font-size:32px;letter-spacing:8px;font-weight:900;color:#d2ad4f">${code}</div><p style="font-size:12px;color:#bbb">Le lien et le code expirent dans 10 minutes et ne peuvent être utilisés qu’une seule fois. Ne les partagez pas.</p></div></div>`})});
    if(!response.ok)throw new ServiceUnavailableException('KHE n’a pas pu envoyer l’e-mail de récupération. Réessayez dans quelques instants.');
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'STATION_LOCK_RECOVERY_REQUESTED',entityType:'Event',entityId:station.eventId,metadata:{mode:station.mode,email:this.mask(email),expiresAt:expiresAt.toISOString()}}}).catch(()=>undefined);
    return{requested:true,maskedEmail:this.mask(email),expiresAt};
  }
  async verify(station:AuthenticatedStation,input:{code?:unknown;token?:unknown}){
    const code=String(input.code??'').trim();const token=String(input.token??'').trim();if(!code&&!token)throw new BadRequestException('Code ou lien de récupération requis.');
    const rows=await this.prisma.$queryRaw<Array<{id:string;codeHash:string;tokenHash:string;expiresAt:Date;usedAt:Date|null}>>(Prisma.sql`SELECT id,"codeHash","tokenHash","expiresAt","usedAt" FROM "StationLockRecoveryToken" WHERE "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "usedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`);const row=rows[0];
    if(!row||row.usedAt||row.expiresAt.getTime()<Date.now())throw new BadRequestException('La récupération a expiré. Demandez un nouveau lien.');
    const valid=code?this.sameHash(row.codeHash,this.hash(code)):this.sameHash(row.tokenHash,this.hash(token));if(!valid)throw new BadRequestException('Code ou lien de récupération invalide.');
    await this.prisma.$executeRaw(Prisma.sql`UPDATE "StationLockRecoveryToken" SET "usedAt"=CURRENT_TIMESTAMP WHERE id=${row.id}::uuid AND "usedAt" IS NULL`);
    await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'STATION_LOCK_RECOVERY_APPROVED',entityType:'Event',entityId:station.eventId,metadata:{mode:station.mode}}}).catch(()=>undefined);
    return{approved:true};
  }
}
