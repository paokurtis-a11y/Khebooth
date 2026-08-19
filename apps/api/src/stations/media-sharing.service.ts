import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StationMode } from '@prisma/client';
import { head, issueSignedToken, presignUrl } from '@vercel/blob';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

const DOWNLOAD_TICKET_TTL_MS = 10 * 60 * 1000;
const DEFAULT_PUBLIC_SHARE_BASE_URL = 'https://khebooth-rdvo.vercel.app';

interface ShareRow { id:string;createdAt:Date; }
interface MediaRow { id:string;syncState:string;acknowledgedAt:Date|null;displayName:string|null; }
interface PublicShareRow {
  id:string;organizationId:string;eventId:string;mediaAssetId:string;displayName:string|null;byteSize:number;mimeType:string;capturedAt:Date|null;acknowledgedAt:Date|null;eventName:string;
}

@Injectable()
export class MediaSharingService {
  constructor(private readonly prisma: PrismaService) {}

  async createShare(station:AuthenticatedStation,mediaId:string){
    this.assertSharing(station);
    const rows=await this.prisma.$queryRaw<MediaRow[]>`
      SELECT "id","syncState"::text AS "syncState","acknowledgedAt","displayName"
      FROM "MediaAsset"
      WHERE id=${mediaId}::uuid AND "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "trashedAt" IS NULL
      LIMIT 1
    `;
    const media=rows[0];
    if(!media)throw new NotFoundException('Media asset not found');
    if(media.syncState!=='SYNCED'||!media.acknowledgedAt)throw new BadRequestException('Only synchronized media can be shared');
    const token=randomBytes(32).toString('base64url');const tokenHash=this.hashToken(token);
    const shares=await this.prisma.$queryRaw<ShareRow[]>`
      INSERT INTO "MediaShareLink" ("organizationId","eventId","mediaAssetId","tokenHash")
      VALUES (${station.organizationId}::uuid,${station.eventId}::uuid,${media.id}::uuid,${tokenHash}) RETURNING "id","createdAt"
    `;
    const share=shares[0];if(!share)throw new ServiceUnavailableException('Unable to create media share');
    const baseUrl=(process.env.PUBLIC_SHARE_BASE_URL?.trim()||DEFAULT_PUBLIC_SHARE_BASE_URL).replace(/\/$/,'');
    return{id:share.id,mediaId:media.id,displayName:media.displayName,shareUrl:`${baseUrl}/m/${token}`,createdAt:share.createdAt};
  }

  async revokeShare(station:AuthenticatedStation,shareId:string){
    this.assertSharing(station);
    const updated=await this.prisma.$executeRaw`
      UPDATE "MediaShareLink" SET "revokedAt"=CURRENT_TIMESTAMP
      WHERE "id"=${shareId}::uuid AND "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "revokedAt" IS NULL
    `;
    if(updated===0)throw new NotFoundException('Active media share not found');return{id:shareId,revoked:true};
  }

  async resolvePublicShare(token:string){
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new NotFoundException('Media share not found');
    const tokenHash=this.hashToken(token);
    const rows=await this.prisma.$queryRaw<PublicShareRow[]>`
      SELECT s."id",s."organizationId",s."eventId",s."mediaAssetId",m."displayName",m."byteSize",m."mimeType",m."capturedAt",m."acknowledgedAt",e."name" AS "eventName"
      FROM "MediaShareLink" s INNER JOIN "MediaAsset" m ON m."id"=s."mediaAssetId" INNER JOIN "Event" e ON e."id"=s."eventId"
      WHERE s."tokenHash"=${tokenHash} AND s."revokedAt" IS NULL AND m."syncState"='SYNCED'::"MediaSyncState" AND m."acknowledgedAt" IS NOT NULL AND m."trashedAt" IS NULL LIMIT 1
    `;
    const share=rows[0];if(!share)throw new NotFoundException('Media share not found');
    const pathname=this.pathnameFor(share);
    try{
      const blob=await head(pathname);if(blob.size!==share.byteSize||blob.contentType!==share.mimeType)throw new BadRequestException('Stored media verification failed');
      const expiresAtMs=Date.now()+DOWNLOAD_TICKET_TTL_MS;const signedToken=await issueSignedToken({pathname,operations:['get'],validUntil:expiresAtMs});
      const{presignedUrl}=await presignUrl(signedToken,{access:'private',pathname,operation:'get',validUntil:expiresAtMs});
      return{shareId:share.id,mediaId:share.mediaAssetId,displayName:share.displayName??this.fallbackName(share),eventName:share.eventName,mimeType:share.mimeType,byteSize:share.byteSize,capturedAt:share.capturedAt,downloadUrl:presignedUrl,expiresAt:new Date(expiresAtMs)};
    }catch(error){if(error instanceof BadRequestException)throw error;const detail=error instanceof Error?error.message:'Blob access failed';console.error('[blob][guest-share] access failed:',detail);throw new ServiceUnavailableException(`Media storage unavailable: ${detail}`);}
  }

  private fallbackName(share:PublicShareRow){return`KHE ${share.eventName?.trim()?`${share.eventName.trim()} `:''}${share.mimeType.startsWith('image/')?'Photo':'Vidéo'}`.trim();}
  private assertSharing(station:AuthenticatedStation){if(station.mode!==StationMode.SHARING)throw new ForbiddenException('Only a Sharing station can manage guest links');}
  private hashToken(token:string){return createHash('sha256').update(token).digest('hex');}
  private pathnameFor(media:{organizationId:string;eventId:string;mediaAssetId:string;mimeType:string}){return`organizations/${media.organizationId}/events/${media.eventId}/media/${media.mediaAssetId}.${this.extensionForMimeType(media.mimeType)}`;}
  private extensionForMimeType(mimeType:string){switch(mimeType){case'image/jpeg':return'jpg';case'image/png':return'png';case'image/webp':return'webp';case'video/mp4':return'mp4';case'video/quicktime':return'mov';default:throw new BadRequestException(`Unsupported media type: ${mimeType}`);}}
}
