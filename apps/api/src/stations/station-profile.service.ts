import { Injectable } from '@nestjs/common';
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
  city: string;
  country: string;
  bio: string;
  updatedAt: Date;
}

type NotificationPreferences={enabled:boolean;soundEnabled:boolean;sound:string;soundVolume:number;vibrationEnabled:boolean;vibrationMode:string;vibrationIntensity:string};
const DEFAULT_NOTIFICATION_PREFERENCES:NotificationPreferences={enabled:true,soundEnabled:true,sound:'khe_chime',soundVolume:70,vibrationEnabled:true,vibrationMode:'double',vibrationIntensity:'medium'};
const EMPTY = { firstName:'',lastName:'',displayName:'',company:'',role:'',email:'',phone:'',city:'',country:'',bio:'' };

function normalizeNotificationPreferences(value:unknown):NotificationPreferences{
  const input=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const sound=['default','khe_chime','khe_gold','khe_pulse','silent'].includes(String(input.sound))?String(input.sound):DEFAULT_NOTIFICATION_PREFERENCES.sound;
  const vibrationMode=['off','short','double','triple','long'].includes(String(input.vibrationMode))?String(input.vibrationMode):DEFAULT_NOTIFICATION_PREFERENCES.vibrationMode;
  const vibrationIntensity=['light','medium','strong'].includes(String(input.vibrationIntensity))?String(input.vibrationIntensity):DEFAULT_NOTIFICATION_PREFERENCES.vibrationIntensity;
  const rawVolume=Number(input.soundVolume??DEFAULT_NOTIFICATION_PREFERENCES.soundVolume);const soundVolume=Number.isFinite(rawVolume)?Math.max(0,Math.min(100,Math.round(rawVolume))):DEFAULT_NOTIFICATION_PREFERENCES.soundVolume;
  return{enabled:input.enabled!==false,soundEnabled:input.soundEnabled!==false&&sound!=='silent',sound,soundVolume,vibrationEnabled:input.vibrationEnabled!==false&&vibrationMode!=='off',vibrationMode,vibrationIntensity};
}

@Injectable()
export class StationProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensure(organizationId:string){await this.prisma.$executeRaw(Prisma.sql`INSERT INTO "OrganizationProfile" ("organizationId") VALUES (${organizationId}::uuid) ON CONFLICT ("organizationId") DO NOTHING`);}

  async get(station: AuthenticatedStation): Promise<ProfileRow> {
    await this.ensure(station.organizationId);
    const rows = await this.prisma.$queryRaw<ProfileRow[]>(Prisma.sql`
      SELECT "organizationId", "firstName", "lastName", "displayName", "company", "role", "email", "phone", "city", "country", "bio", "updatedAt"
      FROM "OrganizationProfile" WHERE "organizationId" = ${station.organizationId}::uuid LIMIT 1
    `);
    return rows[0] ?? { organizationId: station.organizationId, ...EMPTY, updatedAt: new Date() };
  }

  async update(station: AuthenticatedStation, dto: UpdateStationProfileDto): Promise<ProfileRow> {
    const current = await this.get(station);
    const next={firstName:dto.firstName??current.firstName,lastName:dto.lastName??current.lastName,displayName:dto.displayName??current.displayName,company:dto.company??current.company,role:dto.role??current.role,email:dto.email??current.email,phone:dto.phone??current.phone,city:dto.city??current.city,country:dto.country??current.country,bio:dto.bio??current.bio};
    const rows=await this.prisma.$queryRaw<ProfileRow[]>(Prisma.sql`
      INSERT INTO "OrganizationProfile" ("organizationId","firstName","lastName","displayName","company","role","email","phone","city","country","bio","updatedAt")
      VALUES (${station.organizationId}::uuid,${next.firstName},${next.lastName},${next.displayName},${next.company},${next.role},${next.email},${next.phone},${next.city},${next.country},${next.bio},CURRENT_TIMESTAMP)
      ON CONFLICT ("organizationId") DO UPDATE SET "firstName"=EXCLUDED."firstName","lastName"=EXCLUDED."lastName","displayName"=EXCLUDED."displayName","company"=EXCLUDED."company","role"=EXCLUDED."role","email"=EXCLUDED."email","phone"=EXCLUDED."phone","city"=EXCLUDED."city","country"=EXCLUDED."country","bio"=EXCLUDED."bio","updatedAt"=CURRENT_TIMESTAMP
      RETURNING "organizationId","firstName","lastName","displayName","company","role","email","phone","city","country","bio","updatedAt"
    `);
    return rows[0]??{organizationId:station.organizationId,...next,updatedAt:new Date()};
  }

  async notificationPreferences(station:AuthenticatedStation):Promise<NotificationPreferences>{
    await this.ensure(station.organizationId);
    const rows=await this.prisma.$queryRaw<Array<{notificationPreferences:unknown}>>(Prisma.sql`SELECT "notificationPreferences" FROM "OrganizationProfile" WHERE "organizationId"=${station.organizationId}::uuid LIMIT 1`);
    return normalizeNotificationPreferences(rows[0]?.notificationPreferences);
  }

  async updateNotificationPreferences(station:AuthenticatedStation,payload:unknown):Promise<NotificationPreferences>{
    await this.ensure(station.organizationId);const preferences=normalizeNotificationPreferences(payload);
    await this.prisma.$executeRaw(Prisma.sql`UPDATE "OrganizationProfile" SET "notificationPreferences"=${JSON.stringify(preferences)}::jsonb,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${station.organizationId}::uuid`);
    return preferences;
  }
}
