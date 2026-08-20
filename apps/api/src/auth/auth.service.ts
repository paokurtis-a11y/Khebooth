import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './auth.types';
import { resolvedPermissions } from './permissions';
import { ProfilePhotoService } from './profile-photo.service';

export const WEB_TERMS_REVISION = '2026-08-18.1';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  enabled: true,
  soundEnabled: true,
  sound: 'khe_chime',
  soundVolume: 70,
  vibrationEnabled: true,
  vibrationMode: 'double',
  vibrationIntensity: 'medium',
};

interface UserProfileRow {
  id: string;
  organizationId: string;
  email: string;
  username: string | null;
  managedClientId: string | null;
  role: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarPath: string | null;
  permissions: unknown;
  termsAcceptedRevision: string | null;
  termsAcceptedAt: Date | null;
  notificationPreferences: unknown;
  isActive: boolean;
  tenantKind: string;
  managedByOrganizationId: string | null;
  isPlatformManaged: boolean;
}

type AuthSecurityRow={
  id:string;organizationId:string;email:string;username:string|null;managedClientId:string|null;passwordHash:string;authVersion:number;failedLoginAttempts:number;
  passwordResetRequired:boolean;loginLockedAt:Date|null;isActive:boolean;role:any;
};

type RequestContext={ipAddress?:string|null;userAgent?:string|null};

function normalizeNotificationPreferences(value: unknown) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const sound = ['default', 'khe_chime', 'khe_gold', 'khe_pulse', 'khe_crystal', 'khe_air', 'khe_night', 'silent'].includes(String(input.sound)) ? String(input.sound) : DEFAULT_NOTIFICATION_PREFERENCES.sound;
  const vibrationMode = ['off', 'short', 'double', 'triple', 'long', 'heartbeat', 'wave'].includes(String(input.vibrationMode)) ? String(input.vibrationMode) : DEFAULT_NOTIFICATION_PREFERENCES.vibrationMode;
  const vibrationIntensity = ['light', 'medium', 'strong'].includes(String(input.vibrationIntensity)) ? String(input.vibrationIntensity) : DEFAULT_NOTIFICATION_PREFERENCES.vibrationIntensity;
  const rawVolume = Number(input.soundVolume ?? DEFAULT_NOTIFICATION_PREFERENCES.soundVolume);
  const soundVolume = Number.isFinite(rawVolume) ? Math.max(0, Math.min(100, Math.round(rawVolume))) : DEFAULT_NOTIFICATION_PREFERENCES.soundVolume;
  return { enabled: input.enabled !== false, soundEnabled: input.soundEnabled !== false && sound !== 'silent', sound, soundVolume, vibrationEnabled: input.vibrationEnabled !== false && vibrationMode !== 'off', vibrationMode, vibrationIntensity };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService,private readonly jwt: JwtService,private readonly photos: ProfilePhotoService) {}

  private hashResetToken(value:string){return createHash('sha256').update(value).digest('hex');}
  private normalizeUsername(value:string){return value.trim().toLowerCase();}
  private validUsername(value:string){return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);}

  private async authRow(identifier:string):Promise<AuthSecurityRow|null>{
    const normalized=identifier.trim().toLowerCase();
    const rows=await this.prisma.$queryRaw<AuthSecurityRow[]>`
      SELECT id,"organizationId",email,username,"managedClientId","passwordHash","authVersion","failedLoginAttempts","passwordResetRequired","loginLockedAt","isActive",role
      FROM "User" WHERE lower(email)=${normalized} OR lower(username)=${normalized} LIMIT 1
    `;
    return rows[0]??null;
  }

  async usernameAvailability(usernameValue:string){
    const username=this.normalizeUsername(usernameValue);
    if(!this.validUsername(username))return{username,available:false,valid:false,message:'Le nom d’utilisateur doit contenir 3 à 32 caractères : lettres, chiffres, point, tiret ou underscore.'};
    const rows=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "User" WHERE lower(username)=${username} LIMIT 1`;
    return{username,available:rows.length===0,valid:true,message:rows.length===0?'Nom d’utilisateur disponible.':'Ce nom d’utilisateur est déjà utilisé.'};
  }

  private async securityThreshold(organizationId:string):Promise<number>{
    await this.prisma.$executeRaw`INSERT INTO "SecurityAutomationConfig" ("organizationId") VALUES (${organizationId}::uuid) ON CONFLICT ("organizationId") DO NOTHING`;
    const rows=await this.prisma.$queryRaw<Array<{failedLoginThreshold:number}>>`SELECT "failedLoginThreshold" FROM "SecurityAutomationConfig" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;
    return Math.min(10,Math.max(3,rows[0]?.failedLoginThreshold??5));
  }

  private async logPasswordEvent(user:AuthSecurityRow,eventType:string,context:RequestContext,metadata:Record<string,unknown>={}){
    await this.prisma.$executeRaw`
      INSERT INTO "PasswordSecurityEvent" (id,"organizationId","userId",email,"eventType","ipAddress","userAgent",metadata)
      VALUES (gen_random_uuid(),${user.organizationId}::uuid,${user.id}::uuid,${user.email},${eventType},${context.ipAddress??null},${context.userAgent??null},${JSON.stringify(metadata)}::jsonb)
    `;
  }

  private async sendResetEmail(user:AuthSecurityRow,reason:string,context:RequestContext):Promise<void>{
    const raw=randomBytes(32).toString('base64url');const tokenHash=this.hashResetToken(raw);const expiresAt=new Date(Date.now()+30*60*1000);
    await this.prisma.$executeRaw`UPDATE "PasswordResetToken" SET "usedAt"=CURRENT_TIMESTAMP WHERE "userId"=${user.id}::uuid AND "usedAt" IS NULL`;
    await this.prisma.$executeRaw`
      INSERT INTO "PasswordResetToken" (id,"organizationId","userId","tokenHash","requestedFromIp","expiresAt")
      VALUES (gen_random_uuid(),${user.organizationId}::uuid,${user.id}::uuid,${tokenHash},${context.ipAddress??null},${expiresAt})
    `;
    await this.logPasswordEvent(user,'PASSWORD_RESET_REQUESTED',context,{reason,expiresAt:expiresAt.toISOString()});
    const key=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!key||!from)return;
    const origin=(process.env.KHE_PORTAL_ORIGIN||'https://khebooth.vercel.app').replace(/\/$/,'');const resetUrl=`${origin}/reset-password?token=${encodeURIComponent(raw)}`;
    await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[user.email],subject:'Réinitialisation sécurisée de votre mot de passe KHE Booth',html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><div style="background:#0d0d0f;padding:22px;border-radius:18px;color:#fff"><div style="color:#d2ad4f;font-weight:900;letter-spacing:3px">KHE BOOTH</div><h2>Réinitialiser votre mot de passe</h2><p>Une demande de réinitialisation a été enregistrée pour votre compte.</p><p><a href="${resetUrl}" style="display:inline-block;background:#b31520;color:#fff;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:800">Créer mes identifiants sécurisés</a></p><p style="font-size:12px;color:#bbb">Ce lien expire dans 30 minutes et ne peut être utilisé qu’une seule fois. Si vous n’êtes pas à l’origine de cette demande, n’utilisez pas le lien et contactez KHE.</p></div></div>`})}).catch(()=>undefined);
  }

  async login(dto: LoginDto,context:RequestContext={}) {
    const identifier=String(dto.identifier??dto.email??'').trim().toLowerCase();
    if(!identifier)throw new UnauthorizedException('Invalid credentials');
    const user=await this.authRow(identifier);
    if(!user||!user.isActive)throw new UnauthorizedException('Invalid credentials');
    if(user.passwordResetRequired){await this.logPasswordEvent(user,'LOGIN_BLOCKED_RESET_REQUIRED',context);throw new UnauthorizedException('PASSWORD_RESET_REQUIRED');}
    const valid=await argon2.verify(user.passwordHash,dto.password).catch(()=>false);
    if(!valid){
      const threshold=await this.securityThreshold(user.organizationId);const attempts=user.failedLoginAttempts+1;const resetRequired=attempts>=threshold;
      await this.prisma.$executeRaw`
        UPDATE "User" SET "failedLoginAttempts"=${attempts},"lastFailedLoginAt"=CURRENT_TIMESTAMP,"passwordResetRequired"=${resetRequired},"loginLockedAt"=${resetRequired?new Date():null},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${user.id}::uuid
      `;
      await this.logPasswordEvent(user,resetRequired?'PASSWORD_LOCKED_AFTER_FAILURES':'LOGIN_PASSWORD_FAILED',context,{attempt:attempts,threshold});
      if(resetRequired){await this.sendResetEmail({...user,failedLoginAttempts:attempts,passwordResetRequired:true,loginLockedAt:new Date()},'AUTO_AFTER_FAILED_LOGINS',context);throw new UnauthorizedException('PASSWORD_RESET_REQUIRED');}
      throw new UnauthorizedException(`Invalid credentials (${attempts}/${threshold})`);
    }
    await this.prisma.$executeRaw`UPDATE "User" SET "failedLoginAttempts"=0,"lastFailedLoginAt"=NULL,"loginLockedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${user.id}::uuid`;
    const payload: JwtPayload = { sub: user.id, organizationId: user.organizationId, email: user.email, role: user.role, authVersion:user.authVersion };
    await this.prisma.auditLog.create({ data: { organizationId: user.organizationId, userId: user.id, action: 'AUTH_LOGIN', entityType: 'User', entityId: user.id } });
    await this.logPasswordEvent(user,'AUTH_LOGIN_SUCCESS',context,{identifierType:identifier.includes('@')?'email':'username'});
    return { accessToken: await this.jwt.signAsync(payload), user: await this.profile(user.id) };
  }

  async requestPasswordReset(emailValue:string,context:RequestContext={}){
    const email=String(emailValue||'').trim().toLowerCase();
    if(!email.includes('@'))return{requested:true};
    const user=await this.authRow(email);
    if(user&&user.isActive)await this.sendResetEmail(user,'USER_REQUEST',context);
    return{requested:true,message:'Si cette adresse correspond à un compte KHE Booth actif, un e-mail sécurisé a été envoyé.'};
  }

  async passwordResetContext(tokenValue:string){
    const token=String(tokenValue||'').trim();if(token.length<20)return{valid:false,requiresUsername:false};
    const tokenHash=this.hashResetToken(token);
    const rows=await this.prisma.$queryRaw<Array<{expiresAt:Date;usedAt:Date|null;username:string|null;managedClientId:string|null}>>`
      SELECT p."expiresAt",p."usedAt",u.username,u."managedClientId" FROM "PasswordResetToken" p JOIN "User" u ON u.id=p."userId" WHERE p."tokenHash"=${tokenHash} LIMIT 1
    `;
    const row=rows[0];if(!row||row.usedAt||new Date(row.expiresAt).getTime()<Date.now())return{valid:false,requiresUsername:false};
    return{valid:true,requiresUsername:Boolean(row.managedClientId&&!row.username),username:row.username};
  }

  async completePasswordReset(tokenValue:string,passwordValue:string,usernameValue:string,context:RequestContext={}){
    const token=String(tokenValue||'').trim();const password=String(passwordValue||'');
    if(token.length<20)throw new BadRequestException('Invalid reset token');
    if(password.length<10||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))throw new BadRequestException('Le mot de passe doit contenir au moins 10 caractères, avec des lettres et des chiffres.');
    const tokenHash=this.hashResetToken(token);
    const rows=await this.prisma.$queryRaw<Array<{id:string;userId:string;organizationId:string;expiresAt:Date;usedAt:Date|null}>>`
      SELECT id,"userId","organizationId","expiresAt","usedAt" FROM "PasswordResetToken" WHERE "tokenHash"=${tokenHash} LIMIT 1
    `;
    const reset=rows[0];if(!reset||reset.usedAt||new Date(reset.expiresAt).getTime()<Date.now())throw new BadRequestException('Ce lien de réinitialisation est invalide ou expiré.');
    const users=await this.prisma.$queryRaw<AuthSecurityRow[]>`
      SELECT id,"organizationId",email,username,"managedClientId","passwordHash","authVersion","failedLoginAttempts","passwordResetRequired","loginLockedAt","isActive",role FROM "User" WHERE id=${reset.userId}::uuid LIMIT 1
    `;
    const user=users[0];if(!user||!user.isActive)throw new BadRequestException('User unavailable');
    const requestedUsername=this.normalizeUsername(usernameValue||'');const nextUsername=requestedUsername||user.username||null;
    if(user.managedClientId&&!nextUsername)throw new BadRequestException('Choisissez un nom d’utilisateur unique pour activer votre accès KHE BOOTH.');
    if(nextUsername&&!this.validUsername(nextUsername))throw new BadRequestException('Le nom d’utilisateur doit contenir 3 à 32 caractères : lettres, chiffres, point, tiret ou underscore.');
    if(nextUsername){const existing=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "User" WHERE lower(username)=${nextUsername} AND id<>${user.id}::uuid LIMIT 1`;if(existing[0])throw new BadRequestException('Ce nom d’utilisateur est déjà utilisé. Choisissez-en un autre.');}
    const passwordHash=await argon2.hash(password);
    try{
      await this.prisma.$transaction(async(tx)=>{
        await tx.$executeRaw`UPDATE "PasswordResetToken" SET "usedAt"=CURRENT_TIMESTAMP WHERE id=${reset.id}::uuid AND "usedAt" IS NULL`;
        await tx.$executeRaw`UPDATE "User" SET username=${nextUsername},"passwordHash"=${passwordHash},"failedLoginAttempts"=0,"passwordResetRequired"=FALSE,"loginLockedAt"=NULL,"lastFailedLoginAt"=NULL,"passwordChangedAt"=CURRENT_TIMESTAMP,"passwordChangeCount"="passwordChangeCount"+1,"authVersion"="authVersion"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${user.id}::uuid`;
        await tx.auditLog.create({data:{organizationId:user.organizationId,userId:user.id,action:'AUTH_PASSWORD_RESET',entityType:'User',entityId:user.id,metadata:{usernameCreated:Boolean(!user.username&&nextUsername)}}});
      });
    }catch(error){if(String(error).toLowerCase().includes('username'))throw new BadRequestException('Ce nom d’utilisateur vient d’être pris. Choisissez-en un autre.');throw error;}
    await this.logPasswordEvent({...user,username:nextUsername},'PASSWORD_RESET_COMPLETED',context,{sessionsRevoked:true,username:nextUsername});
    return{reset:true,sessionsRevoked:true,username:nextUsername,message:'Identifiants enregistrés. Reconnectez-vous avec votre e-mail ou votre nom d’utilisateur.'};
  }

  private async row(userId: string): Promise<UserProfileRow> {
    const rows = await this.prisma.$queryRaw<UserProfileRow[]>`
      SELECT u.id,u."organizationId",u.email,u.username,u."managedClientId",u.role::text AS role,u."firstName",u."lastName",u.phone,u."avatarPath",u.permissions,
             u."termsAcceptedRevision",u."termsAcceptedAt",u."notificationPreferences",u."isActive",
             o."tenantKind",o."managedByOrganizationId",o."isPlatformManaged"
      FROM "User" u JOIN "Organization" o ON o.id=u."organizationId" WHERE u.id = ${userId}::uuid LIMIT 1
    `;
    const user = rows[0];
    if (!user || !user.isActive) throw new UnauthorizedException('User unavailable');
    return user;
  }

  async profile(userId: string) {
    const user = await this.row(userId);const avatar = await this.photos.download(user.avatarPath);
    return { id:user.id,organizationId:user.organizationId,email:user.email,username:user.username,role:user.role,firstName:user.firstName,lastName:user.lastName,phone:user.phone,avatarUrl:avatar.avatarUrl,avatarExpiresAt:avatar.expiresAt,permissions:resolvedPermissions(user.role,user.permissions),termsRevision:WEB_TERMS_REVISION,termsAccepted:user.termsAcceptedRevision===WEB_TERMS_REVISION,termsAcceptedRevision:user.termsAcceptedRevision,termsAcceptedAt:user.termsAcceptedAt,notificationPreferences:normalizeNotificationPreferences(user.notificationPreferences),tenantKind:user.tenantKind,managedByOrganizationId:user.managedByOrganizationId,isPlatformManaged:user.isPlatformManaged,securityDetailsAllowed:user.role==='OWNER'&&user.tenantKind==='KHE_ROOT' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const firstName = dto.firstName.trim();const lastName = dto.lastName.trim();const email = dto.email.trim().toLowerCase();const phone = dto.phone?.trim() || null;const requestedUsername=dto.username===undefined?undefined:this.normalizeUsername(dto.username);
    if (!firstName || !lastName) throw new BadRequestException('First name and last name are required');
    const emailExisting=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "User" WHERE lower(email)=${email} AND id<>${userId}::uuid LIMIT 1`;if(emailExisting[0])throw new BadRequestException('Cette adresse e-mail est déjà utilisée pour un autre accès KHE BOOTH.');
    if(requestedUsername!==undefined&&!this.validUsername(requestedUsername))throw new BadRequestException('Le nom d’utilisateur doit contenir 3 à 32 caractères : lettres, chiffres, point, tiret ou underscore.');
    if(requestedUsername!==undefined){const usernameExisting=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "User" WHERE lower(username)=${requestedUsername} AND id<>${userId}::uuid LIMIT 1`;if(usernameExisting[0])throw new BadRequestException('Ce nom d’utilisateur est déjà utilisé. Choisissez-en un autre.');}
    const before=await this.row(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { firstName, lastName, email } });
    await this.prisma.$executeRaw`UPDATE "User" SET phone=${phone}, username=COALESCE(${requestedUsername??null},username),"updatedAt"=CURRENT_TIMESTAMP WHERE id=${userId}::uuid`;
    if(before.managedClientId){await this.prisma.$executeRaw`UPDATE "Client" SET name=${`${firstName} ${lastName}`.trim()},email=${email},phone=${phone},"emailSource"='PLATFORM_PROFILE',"emailLastCapturedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${before.managedClientId}::uuid`;}
    const user = await this.row(userId);await this.prisma.auditLog.create({ data: { organizationId: user.organizationId, userId: user.id, action: 'USER_PROFILE_UPDATED', entityType: 'User', entityId: user.id, metadata:{clientProfileSynchronized:Boolean(before.managedClientId)} } });return this.profile(userId);
  }

  terms() {
    return { revision:WEB_TERMS_REVISION,title:'Conditions générales d’utilisation — KHE Booth',sections:[
      { title:'1. Objet', body:'KHE Booth est une plateforme et une application de capture, création, synchronisation, gestion, impression et partage de contenus photo et vidéo pour des événements.' },
      { title:'2. Compte et sécurité', body:'Chaque utilisateur doit protéger ses identifiants, utiliser uniquement les droits qui lui sont attribués et signaler sans délai tout accès non autorisé. Les rôles et permissions sont gérés par l’organisation.' },
      { title:'3. Captation et droit à l’image', body:'L’organisateur et les utilisateurs sont responsables d’obtenir les autorisations nécessaires avant de photographier, filmer, imprimer ou partager des contenus et doivent respecter les règles locales applicables.' },
      { title:'4. Données et confidentialité', body:'Les utilisateurs doivent traiter les données personnelles conformément aux lois applicables, notamment la LPD en Suisse et, lorsque pertinent, le RGPD dans l’Union européenne ou l’EEE.' },
      { title:'5. Cloud, appareils et services tiers', body:'Certaines fonctions dépendent d’Internet, de Vercel, de services de paiement, de stockage, d’e-mail, d’Android, iOS ou du navigateur. Leur disponibilité peut varier selon le pays, l’appareil et le fournisseur.' },
      { title:'6. Abonnements et paiements', body:'Les fonctionnalités disponibles dépendent du niveau d’abonnement. Les abonnements récurrents sont renouvelés selon les conditions présentées au paiement jusqu’à résiliation par le client. Les moyens de paiement disponibles peuvent varier selon le pays.' },
      { title:'7. Contenus interdits', body:'Il est interdit d’utiliser KHE Booth pour des contenus ou activités illicites, abusifs, trompeurs, portant atteinte aux droits de tiers ou à la sécurité des personnes et des systèmes.' },
      { title:'8. Disponibilité et mises à jour', body:'KHE Booth peut être mis à jour, maintenu ou temporairement indisponible. Les utilisateurs peuvent recevoir des informations de maintenance, de sécurité et de mise à jour via la plateforme, l’application ou l’e-mail.' },
      { title:'9. Notifications', body:'Les notifications peuvent être réglées en silencieux, avec son ou vibration selon les capacités du navigateur, du système et de l’appareil. Les réglages système de l’appareil restent prioritaires.' },
      { title:'10. Acceptation et évolution', body:'L’utilisation de la plateforme nécessite l’acceptation de la révision en vigueur. Une nouvelle acceptation peut être demandée lorsque les conditions changent de manière significative.' },
    ]};
  }

  async acceptTerms(userId: string) {await this.prisma.$executeRaw`UPDATE "User" SET "termsAcceptedRevision" = ${WEB_TERMS_REVISION}, "termsAcceptedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${userId}::uuid`;return this.profile(userId);}
  async updateNotificationPreferences(userId: string, payload: unknown) {const preferences=normalizeNotificationPreferences(payload);await this.prisma.$executeRaw`UPDATE "User" SET "notificationPreferences" = ${JSON.stringify(preferences)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${userId}::uuid`;return preferences;}
}