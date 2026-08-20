import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { MediaSyncState, Prisma, StationMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMediaDto } from './dto/create-media.dto';
import type { AuthenticatedStation } from './station-auth.types';

type MediaRow={
  id:string;organizationId:string;eventId:string;localId:string;displayName:string|null;contentHash:string;byteSize:number;mimeType:string;syncState:MediaSyncState;capturedAt:Date|null;acknowledgedAt:Date|null;trashedAt:Date|null;trashExpiresAt:Date|null;createdAt:Date;updatedAt:Date;
};

@Injectable()
export class MediaCatalogService{
  constructor(private readonly prisma:PrismaService){}

  async list(station:AuthenticatedStation):Promise<MediaRow[]>{
    return this.prisma.$queryRaw<MediaRow[]>`
      SELECT m."id",m."organizationId",m."eventId",m."localId",m."displayName",m."contentHash",m."byteSize",m."mimeType",m."syncState",m."capturedAt",m."acknowledgedAt",m."trashedAt",m."trashExpiresAt",m."createdAt",m."updatedAt"
      FROM "MediaAsset" m
      WHERE m."organizationId"=${station.organizationId}::uuid
        AND m."eventId"=${station.eventId}::uuid
        AND m."trashedAt" IS NULL
        ${station.mode===StationMode.SHARING?Prisma.sql`AND m."syncState"='SYNCED'::"MediaSyncState"`:Prisma.empty}
      ORDER BY m."createdAt" ASC
    `;
  }

  async create(station:AuthenticatedStation,dto:CreateMediaDto):Promise<MediaRow>{
    if(station.mode!==StationMode.CAPTURE)throw new ForbiddenException('Only Capture stations can create media');
    const existing=await this.prisma.mediaAsset.findUnique({where:{organizationId_idempotencyKey:{organizationId:station.organizationId,idempotencyKey:dto.idempotencyKey}}});
    if(existing){
      if(existing.eventId!==station.eventId||existing.localId!==dto.localId||existing.contentHash!==dto.contentHash||existing.byteSize!==dto.byteSize||existing.mimeType!==dto.mimeType)throw new ConflictException('Idempotency key was already used for different media metadata');
      return this.ensureName(existing.id);
    }
    let created:{id:string};
    try{
      created=await this.prisma.mediaAsset.create({data:{organizationId:station.organizationId,eventId:station.eventId,createdBySessionId:station.sessionId,localId:dto.localId,idempotencyKey:dto.idempotencyKey,contentHash:dto.contentHash,byteSize:dto.byteSize,mimeType:dto.mimeType,capturedAt:dto.capturedAt?new Date(dto.capturedAt):undefined},select:{id:true}});
    }catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ConflictException('Media localId or idempotencyKey already exists');throw error;}
    return this.ensureName(created.id);
  }

  private async ensureName(mediaId:string):Promise<MediaRow>{
    const source=await this.prisma.$queryRaw<Array<{eventName:string;mimeType:string;createdAt:Date;eventId:string;displayName:string|null}>>`
      SELECT e."name" AS "eventName",m."mimeType",m."createdAt",m."eventId",m."displayName"
      FROM "MediaAsset" m INNER JOIN "Event" e ON e.id=m."eventId"
      WHERE m.id=${mediaId}::uuid LIMIT 1
    `;
    const item=source[0];
    if(!item)throw new ConflictException('Media asset unavailable');
    if(!item.displayName){
      const sequenceRows=await this.prisma.$queryRaw<Array<{sequence:bigint}>>`
        SELECT count(*)::bigint AS sequence FROM "MediaAsset"
        WHERE "eventId"=${item.eventId}::uuid
          AND ("createdAt"<${item.createdAt} OR ("createdAt"=${item.createdAt} AND id<=${mediaId}::uuid))
      `;
      const sequence=Number(sequenceRows[0]?.sequence??1n);
      const eventName=this.cleanEventName(item.eventName);
      const kind=item.mimeType.startsWith('image/')?'Photo':'Vidéo';
      const displayName=`KHE${eventName?` ${eventName}`:''} ${kind} ${String(sequence).padStart(3,'0')}`;
      await this.prisma.$executeRaw`UPDATE "MediaAsset" SET "displayName"=${displayName},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${mediaId}::uuid AND "displayName" IS NULL`;
    }
    const rows=await this.prisma.$queryRaw<MediaRow[]>`
      SELECT "id","organizationId","eventId","localId","displayName","contentHash","byteSize","mimeType","syncState","capturedAt","acknowledgedAt","trashedAt","trashExpiresAt","createdAt","updatedAt" FROM "MediaAsset" WHERE id=${mediaId}::uuid LIMIT 1
    `;
    if(!rows[0])throw new ConflictException('Media asset unavailable');return rows[0];
  }

  private cleanEventName(value:string):string{return value.normalize('NFKC').replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ').replace(/[<>:"/\\|?*]+/g,'').trim().slice(0,80);}
}
