import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';
import type { UpdateStationProfileDto } from './dto/update-station-profile.dto';

export interface ProfileRow {
  organizationId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  company: string;
  role: string;
  email: string;
  phone: string;
  address: string;
  buildingNumber: string;
  postalCode: string;
  birthDate: Date | null;
  avatarPath: string | null;
  city: string;
  country: string;
  bio: string;
  updatedAt: Date;
}

type NotificationPreferences={enabled:boolean;soundEnabled:boolean;sound:string;soundVolume:number;vibrationEnabled:boolean;vibrationMode:string;vibrationIntensity:string};
const DEFAULT_NOTIFICATION_PREFERENCES:NotificationPreferences={enabled:true,soundEnabled:true,sound:'khe_chime',soundVolume:70,vibrationEnabled:true,vibrationMode:'double',vibrationIntensity:'medium'};
const SUPPORTED_SOUNDS=['default','khe_chime','khe_gold','khe_pulse','khe_flash','khe_velvet','khe_victory','khe_night','silent'];
const SUPPORTED_VIBRATIONS=['off','short','double','triple','heartbeat','long'];
const EMPTY = { firstName:'',lastName:'',displayName:'',company:'',role:'',email:'',phone:'',address:'',buildingNumber:'',postalCode:'',birthDate:null,avatarPath:null,city:'',country:'',bio:'' };

function normalizeNotificationPreferences(value:unknown):NotificationPreferences{
  const input=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const sound=SUPPORTED_SOUNDS.includes(String(input.sound))?String(input.sound):DEFAULT_NOTIFICATION_PREFERENCES.sound;
  const vibrationMode=SUPPORTED_VIBRATIONS.includes(String(input.vibrationMode))?String(input.vibrationMode):DEFAULT_NOTIFICATION_PREFERENCES.vibrationMode;
  const vibrationIntensity=['light','medium','strong'].includes(String(input.vibrationIntensity))?String(input.vibrationIntensity):DEFAULT_NOTIFICATION_PREFERENCES.vibrationIntensity;
  const rawVolume=Number(input.soundVolume??DEFAULT_NOTIFICATION_PREFERENCES.soundVolume);const soundVolume=Number.isFinite(rawVolume)?Math.max(0,Math.min(100,Math.round(rawVolume))):DEFAULT_NOTIFICATION_PREFERENCES.soundVolume;
  return{enabled:input.enabled!==false,soundEnabled:input.soundEnabled!==false&&sound!=='silent',sound,soundVolume,vibrationEnabled:input.vibrationEnabled!==false&&vibrationMode!=='off',vibrationMode,vibrationIntensity};
}

@Injectable()
export class StationProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensure(organizationId:string){await this.prisma.$executeRaw(Prisma.sql`INSERT INTO "OrganizationProfile" ("organizationId") VALUES (${organizationId}::uuid) ON CONFLICT ("organizationId") DO NOTHING`);}

  private async targetClient(station:AuthenticatedStation):Promise<{clientId:string;rootOrganizationId:string}|null>{
    const eventRows=await this.prisma.$queryRaw<Array<{clientId:string|null;rootOrganizationId:string|null}>>(Prisma.sql`
      SELECT e."clientId",c."organizationId" AS "rootOrganizationId" FROM "Event" e LEFT JOIN "Client" c ON c.id=e."clientId"
      WHERE e.id=${station.eventId}::uuid AND e."organizationId"=${station.organizationId}::uuid LIMIT 1`);
    if(eventRows[0]?.clientId&&eventRows[0]?.rootOrganizationId)return{clientId:eventRows[0].clientId,rootOrganizationId:eventRows[0].rootOrganizationId};
    const managed=await this.prisma.$queryRaw<Array<{clientId:string;rootOrganizationId:string}>>(Prisma.sql`
      SELECT u."managedClientId" AS "clientId",c."organizationId" AS "rootOrganizationId"
      FROM "User" u JOIN "Client" c ON c.id=u."managedClientId" JOIN "Organization" o ON o.id=u."organizationId"
      WHERE u."organizationId"=${station.organizationId}::uuid AND u."managedClientId" IS NOT NULL AND o."tenantKind"='ENTERPRISE_CLIENT' LIMIT 1`);
    return managed[0]??null;
  }

  private async syncClient(station:AuthenticatedStation,profile:ProfileRow){
    const target=await this.targetClient(station);if(!target)return;
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "ClientProfileSnapshot" ("clientId","organizationId","sourceOrganizationId",source,"firstName","lastName","displayName",company,role,email,phone,address,"buildingNumber","postalCode","birthDate","avatarPath",city,country,bio,"syncedAt","updatedAt")
      VALUES (${target.clientId}::uuid,${target.rootOrganizationId}::uuid,${station.organizationId}::uuid,${station.mode},${profile.firstName},${profile.lastName},${profile.displayName},${profile.company},${profile.role},${profile.email},${profile.phone},${profile.address},${profile.buildingNumber},${profile.postalCode},${profile.birthDate},${profile.avatarPath},${profile.city},${profile.country},${profile.bio},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT ("clientId") DO UPDATE SET "sourceOrganizationId"=EXCLUDED."sourceOrganizationId",source=EXCLUDED.source,"firstName"=EXCLUDED."firstName","lastName"=EXCLUDED."lastName","displayName"=EXCLUDED."displayName",company=EXCLUDED.company,role=EXCLUDED.role,email=EXCLUDED.email,phone=EXCLUDED.phone,address=EXCLUDED.address,"buildingNumber"=EXCLUDED."buildingNumber","postalCode"=EXCLUDED."postalCode","birthDate"=EXCLUDED."birthDate","avatarPath"=COALESCE(EXCLUDED."avatarPath","ClientProfileSnapshot"."avatarPath"),city=EXCLUDED.city,country=EXCLUDED.country,bio=EXCLUDED.bio,"syncedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`);
  }

  private async mirrorBestEffort(station:AuthenticatedStation,profile:ProfileRow){
    try{await this.syncClient(station,profile);}catch(error){
      const detail=error instanceof Error?error.message:String(error);
      console.error('[profile][snapshot] mirror failed:',detail);
      await this.prisma.auditLog.create({data:{organizationId:station.organizationId,action:'PROFILE_SNAPSHOT_SYNC_FAILED',entityType:'OrganizationProfile',entityId:station.organizationId,metadata:{eventId:station.eventId,mode:station.mode,detail:detail.slice(0,500)}}}).catch(()=>undefined);
    }
  }

  async get(station: AuthenticatedStation): Promise<ProfileRow> {
    await this.ensure(station.organizationId);
    const rows = await this.prisma.$queryRaw<ProfileRow[]>(Prisma.sql`
      SELECT "organizationId", "firstName", "lastName", "displayName", "company", "role", "email", "phone", "address", "buildingNumber", "postalCode", "birthDate", "avatarPath", "city", "country", "bio", "updatedAt"
      FROM "OrganizationProfile" WHERE "organizationId" = ${station.organizationId}::uuid LIMIT 1
    `);
    return rows[0] ?? { organizationId: station.organizationId, ...EMPTY, updatedAt: new Date() };
  }

  async update(station: AuthenticatedStation, dto: UpdateStationProfileDto): Promise<ProfileRow> {
    const current = await this.get(station);
    const birthDate = dto.birthDate === undefined ? current.birthDate : dto.birthDate ? new Date(dto.birthDate) : null;
    const next={
      firstName:(dto.firstName??current.firstName).trim(),lastName:(dto.lastName??current.lastName).trim(),displayName:(dto.displayName??current.displayName).trim(),company:(dto.company??current.company).trim(),role:(dto.role??current.role).trim(),email:(dto.email??current.email).trim().toLowerCase(),phone:(dto.phone??current.phone).trim(),address:(dto.address??current.address).trim(),buildingNumber:(dto.buildingNumber??current.buildingNumber).trim(),postalCode:(dto.postalCode??current.postalCode).trim(),birthDate,avatarPath:current.avatarPath,city:(dto.city??current.city).trim(),country:(dto.country??current.country).trim(),bio:(dto.bio??current.bio).trim(),
    };
    if(!next.firstName)throw new BadRequestException('Le prénom est obligatoire.');
    if(!next.lastName)throw new BadRequestException('Le nom est obligatoire.');
    if(!next.email)throw new BadRequestException('L’adresse e-mail est obligatoire.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))throw new BadRequestException('L’adresse e-mail est invalide.');
    if(!next.address)throw new BadRequestException('L’adresse de domiciliation est obligatoire.');
    if(!next.buildingNumber)throw new BadRequestException('Le numéro de bâtiment est obligatoire.');
    if(!next.postalCode)throw new BadRequestException('Le code postal est obligatoire.');
    if(!next.city)throw new BadRequestException('La ville est obligatoire.');
    if(!next.country)throw new BadRequestException('Le pays est obligatoire.');
    if(next.birthDate&&Number.isNaN(next.birthDate.getTime()))throw new BadRequestException('La date de naissance est invalide.');
    if(next.birthDate&&next.birthDate>new Date())throw new BadRequestException('La date de naissance ne peut pas être dans le futur.');
    if(!next.displayName)next.displayName=`${next.firstName} ${next.lastName}`.trim();
    const rows=await this.prisma.$queryRaw<ProfileRow[]>(Prisma.sql`
      INSERT INTO "OrganizationProfile" ("organizationId","firstName","lastName","displayName","company","role","email","phone","address","buildingNumber","postalCode","birthDate","city","country","bio","updatedAt")
      VALUES (${station.organizationId}::uuid,${next.firstName},${next.lastName},${next.displayName},${next.company},${next.role},${next.email},${next.phone},${next.address},${next.buildingNumber},${next.postalCode},${next.birthDate},${next.city},${next.country},${next.bio},CURRENT_TIMESTAMP)
      ON CONFLICT ("organizationId") DO UPDATE SET "firstName"=EXCLUDED."firstName","lastName"=EXCLUDED."lastName","displayName"=EXCLUDED."displayName","company"=EXCLUDED."company","role"=EXCLUDED."role","email"=EXCLUDED."email","phone"=EXCLUDED."phone","address"=EXCLUDED."address","buildingNumber"=EXCLUDED."buildingNumber","postalCode"=EXCLUDED."postalCode","birthDate"=EXCLUDED."birthDate","city"=EXCLUDED.city,"country"=EXCLUDED.country,"bio"=EXCLUDED.bio,"updatedAt"=CURRENT_TIMESTAMP
      RETURNING "organizationId","firstName","lastName","displayName","company","role","email","phone","address","buildingNumber","postalCode","birthDate","avatarPath","city","country","bio","updatedAt"`);
    const profile=rows[0]??{organizationId:station.organizationId,...next,updatedAt:new Date()};
    await this.mirrorBestEffort(station,profile);
    return profile;
  }

  async notificationPreferences(station:AuthenticatedStation):Promise<NotificationPreferences>{await this.ensure(station.organizationId);const rows=await this.prisma.$queryRaw<Array<{notificationPreferences:unknown}>>(Prisma.sql`SELECT "notificationPreferences" FROM "OrganizationProfile" WHERE "organizationId"=${station.organizationId}::uuid LIMIT 1`);return normalizeNotificationPreferences(rows[0]?.notificationPreferences);}
  async updateNotificationPreferences(station:AuthenticatedStation,payload:unknown):Promise<NotificationPreferences>{await this.ensure(station.organizationId);const preferences=normalizeNotificationPreferences(payload);await this.prisma.$executeRaw(Prisma.sql`UPDATE "OrganizationProfile" SET "notificationPreferences"=${JSON.stringify(preferences)}::jsonb,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${station.organizationId}::uuid`);return preferences;}
}
