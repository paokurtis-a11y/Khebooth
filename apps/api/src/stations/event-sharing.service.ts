import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { StationMode } from '@prisma/client';
import { head, issueSignedToken, presignUrl } from '@vercel/blob';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

const DOWNLOAD_TTL_MS=10*60*1000;
const PUBLIC_BASE=(process.env.PUBLIC_SHARE_BASE_URL?.trim()||'https://khebooth-rdvo.vercel.app').replace(/\/$/,'');
const TOKEN_VERSION=1;
type ShareRow={id:string;tokenHash:string;tokenVersion:number;createdAt:Date};
type EventRow={eventId:string;eventName:string;startsAt:Date;endsAt:Date|null};
type MediaRow={id:string;organizationId:string;eventId:string;displayName:string|null;byteSize:number;mimeType:string;capturedAt:Date|null};

@Injectable()
export class EventSharingService{
  constructor(private readonly prisma:PrismaService){}
  async create(station:AuthenticatedStation){
    this.assertSharing(station);
    const event=await this.prisma.event.findFirst({where:{id:station.eventId,organizationId:station.organizationId},select:{id:true,name:true}});if(!event)throw new NotFoundException('Event not found');
    return this.prisma.$transaction(async tx=>{
      const rows=await tx.$queryRaw<ShareRow[]>`SELECT "id","tokenHash","tokenVersion","createdAt" FROM "EventShareLink" WHERE "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "revokedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE`;
      const active=rows[0];if(active?.tokenVersion===TOKEN_VERSION){const token=this.tokenFor(active.id);if(this.hash(token)===active.tokenHash)return{id:active.id,eventId:station.eventId,eventName:event.name,shareUrl:`${PUBLIC_BASE}/e/${token}`,createdAt:active.createdAt,reused:true};}
      if(active)await tx.$executeRaw`UPDATE "EventShareLink" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "revokedAt" IS NULL`;
      const id=randomUUID(),token=this.tokenFor(id),tokenHash=this.hash(token);const inserted=await tx.$queryRaw<Array<{id:string;createdAt:Date}>>`INSERT INTO "EventShareLink" ("id","organizationId","eventId","tokenHash","tokenVersion") VALUES (${id}::uuid,${station.organizationId}::uuid,${station.eventId}::uuid,${tokenHash},${TOKEN_VERSION}) RETURNING "id","createdAt"`;
      return{id,eventId:station.eventId,eventName:event.name,shareUrl:`${PUBLIC_BASE}/e/${token}`,createdAt:inserted[0]?.createdAt??new Date(),reused:false};
    });
  }
  async revoke(station:AuthenticatedStation,id:string){this.assertSharing(station);const count=await this.prisma.$executeRaw`UPDATE "EventShareLink" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}::uuid AND "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "revokedAt" IS NULL`;if(!count)throw new NotFoundException('Active event share not found');return{id,revoked:true};}
  async resolve(token:string){
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new NotFoundException('Event gallery not found');const tokenHash=this.hash(token);
    const events=await this.prisma.$queryRaw<EventRow[]>`SELECT e.id AS "eventId",e.name AS "eventName",e."startsAt",e."endsAt" FROM "EventShareLink" s INNER JOIN "Event" e ON e.id=s."eventId" WHERE s."tokenHash"=${tokenHash} AND s."revokedAt" IS NULL LIMIT 1`;
    const event=events[0];if(!event)throw new NotFoundException('Event gallery not found');
    const media=await this.prisma.$queryRaw<MediaRow[]>`SELECT m.id,m."organizationId",m."eventId",m."displayName",m."byteSize",m."mimeType",m."capturedAt" FROM "MediaAsset" m WHERE m."eventId"=${event.eventId}::uuid AND m."syncState"='SYNCED'::"MediaSyncState" AND m."acknowledgedAt" IS NOT NULL AND m."trashedAt" IS NULL ORDER BY COALESCE(m."capturedAt",m."createdAt") DESC LIMIT 120`;
    const items=[] as Array<Record<string,unknown>>;const expiresAtMs=Date.now()+DOWNLOAD_TTL_MS;
    for(const item of media){try{const pathname=this.pathnameFor(item);const blob=await head(pathname);if(blob.size!==item.byteSize||blob.contentType!==item.mimeType)continue;const signedToken=await issueSignedToken({pathname,operations:['get'],validUntil:expiresAtMs});const{presignedUrl}=await presignUrl(signedToken,{access:'private',pathname,operation:'get',validUntil:expiresAtMs});items.push({id:item.id,displayName:item.displayName??this.fallbackName(event.eventName,item.mimeType),mimeType:item.mimeType,byteSize:item.byteSize,capturedAt:item.capturedAt,downloadUrl:presignedUrl});}catch(error){console.warn('[event-gallery] skipped media',item.id,error instanceof Error?error.message:'blob error');}}
    return{eventId:event.eventId,eventName:event.eventName,startsAt:event.startsAt,endsAt:event.endsAt,updatedAt:new Date(),expiresAt:new Date(expiresAtMs),media:items};
  }
  private assertSharing(station:AuthenticatedStation){if(station.mode!==StationMode.SHARING)throw new ForbiddenException('Only SHARING can manage the permanent event QR');}
  private hash(token:string){return createHash('sha256').update(token).digest('hex');}
  private tokenFor(id:string){return createHmac('sha256',this.key()).update(`event-share:${id}`,'utf8').digest('base64url');}
  private key(){const source=process.env.MEDIA_SHARE_SIGNING_SECRET?.trim()||process.env.JWT_SECRET?.trim();if(!source||source.length<24)throw new InternalServerErrorException('KHE event share signing is not configured');return createHash('sha256').update(`khe-event-share-v1:${source}`,'utf8').digest();}
  private fallbackName(eventName:string,mime:string){return`KHE ${eventName} ${mime.startsWith('image/')?'Photo':'Vidéo'}`;}
  private pathnameFor(media:{organizationId:string;eventId:string;id:string;mimeType:string}){return`organizations/${media.organizationId}/events/${media.eventId}/media/${media.id}.${this.extension(media.mimeType)}`;}
  private extension(mime:string){if(mime==='image/jpeg')return'jpg';if(mime==='image/png')return'png';if(mime==='image/webp')return'webp';if(mime==='video/mp4')return'mp4';if(mime==='video/quicktime')return'mov';throw new ServiceUnavailableException(`Unsupported stored media type: ${mime}`);}
}
