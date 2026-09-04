import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { StationMode } from '@prisma/client';
import { del } from '@vercel/blob';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

const TRASH_RETENTION_MS=30*24*60*60*1000;

type TrashRow={id:string;organizationId:string;eventId:string;displayName:string|null;mimeType:string;byteSize:number;capturedAt:Date|null;trashedAt:Date;trashExpiresAt:Date};
type PurgeRow={id:string;organizationId:string;eventId:string;mimeType:string};

@Injectable()
export class MediaTrashService{
  constructor(private readonly prisma:PrismaService){}

  async list(station:AuthenticatedStation):Promise<TrashRow[]>{
    this.assertSharing(station);
    return this.prisma.$queryRaw<TrashRow[]>`
      SELECT "id","organizationId","eventId","displayName","mimeType","byteSize","capturedAt","trashedAt","trashExpiresAt"
      FROM "MediaAsset"
      WHERE "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "trashedAt" IS NOT NULL
      ORDER BY "trashedAt" DESC
    `;
  }

  async trash(station:AuthenticatedStation,mediaId:string){
    this.assertSharing(station);this.assertUuid(mediaId);
    const expiresAt=new Date(Date.now()+TRASH_RETENTION_MS);
    const rows=await this.prisma.$queryRaw<TrashRow[]>`
      UPDATE "MediaAsset"
      SET "trashedAt"=COALESCE("trashedAt",CURRENT_TIMESTAMP),"trashExpiresAt"=COALESCE("trashExpiresAt",${expiresAt}),"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${mediaId}::uuid AND "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid
      RETURNING "id","organizationId","eventId","displayName","mimeType","byteSize","capturedAt","trashedAt","trashExpiresAt"
    `;
    if(!rows[0])throw new NotFoundException('Média introuvable');
    return{...rows[0],trashed:true,retentionDays:30};
  }

  async trashMany(station:AuthenticatedStation,value:unknown){
    this.assertSharing(station);
    if(!Array.isArray(value)||value.length===0||value.length>100)throw new BadRequestException('Sélection invalide');
    const ids=[...new Set(value.map((item)=>String(item)))];ids.forEach((id)=>this.assertUuid(id));
    const results=[];for(const id of ids)results.push(await this.trash(station,id));
    return{count:results.length,items:results,retentionDays:30};
  }

  async restore(station:AuthenticatedStation,mediaId:string){
    this.assertSharing(station);this.assertUuid(mediaId);
    const rows=await this.prisma.$queryRaw<Array<{id:string;displayName:string|null}>>`
      UPDATE "MediaAsset" SET "trashedAt"=NULL,"trashExpiresAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${mediaId}::uuid AND "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "trashedAt" IS NOT NULL
      RETURNING "id","displayName"
    `;
    if(!rows[0])throw new NotFoundException('Média absent de la corbeille');return{...rows[0],restored:true};
  }

  async permanentlyDelete(station:AuthenticatedStation,mediaId:string){
    this.assertSharing(station);this.assertUuid(mediaId);
    const rows=await this.prisma.$queryRaw<PurgeRow[]>`
      SELECT "id","organizationId","eventId","mimeType" FROM "MediaAsset"
      WHERE id=${mediaId}::uuid AND "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "trashedAt" IS NOT NULL LIMIT 1
    `;
    const media=rows[0];if(!media)throw new NotFoundException('Média absent de la corbeille');
    try{await del(this.pathnameFor(media));const deleted=await this.prisma.$executeRaw`DELETE FROM "MediaAsset" WHERE id=${mediaId}::uuid AND "organizationId"=${station.organizationId}::uuid AND "eventId"=${station.eventId}::uuid AND "trashedAt" IS NOT NULL`;if(deleted!==1)throw new Error('Le média a changé pendant la suppression.');return{id:mediaId,deleted:true};}
    catch(error){throw new ServiceUnavailableException(`Suppression définitive impossible : ${error instanceof Error?error.message:'stockage indisponible'}`);}
  }

  async permanentlyDeleteMany(station:AuthenticatedStation,value:unknown){
    this.assertSharing(station);if(!Array.isArray(value)||value.length===0||value.length>100)throw new BadRequestException('Sélection invalide');
    const ids=[...new Set(value.map((item)=>String(item)))];ids.forEach((id)=>this.assertUuid(id));const deleted:string[]=[];const failed:Array<{id:string;error:string}>=[];
    for(const id of ids){try{await this.permanentlyDelete(station,id);deleted.push(id);}catch(error){failed.push({id,error:error instanceof Error?error.message:'Suppression impossible'});}}
    return{requested:ids.length,deleted:deleted.length,deletedIds:deleted,failed};
  }

  async empty(station:AuthenticatedStation){
    const rows=await this.list(station);if(rows.length===0)return{requested:0,deleted:0,deletedIds:[],failed:[]};const deleted:string[]=[];const failed:Array<{id:string;error:string}>=[];
    for(const media of rows){try{await this.permanentlyDelete(station,media.id);deleted.push(media.id);}catch(error){failed.push({id:media.id,error:error instanceof Error?error.message:'Suppression impossible'});}}
    return{requested:rows.length,deleted:deleted.length,deletedIds:deleted,failed};
  }

  async purgeExpiredTrash(limit=200){
    const rows=await this.prisma.$queryRaw<PurgeRow[]>`
      SELECT "id","organizationId","eventId","mimeType" FROM "MediaAsset"
      WHERE "trashedAt" IS NOT NULL AND "trashExpiresAt"<=CURRENT_TIMESTAMP
      ORDER BY "trashExpiresAt" ASC LIMIT ${Math.max(1,Math.min(500,limit))}
    `;
    let deleted=0;const failed:Array<{id:string;error:string}>=[];
    for(const media of rows){
      try{await del(this.pathnameFor(media));await this.prisma.$executeRaw`DELETE FROM "MediaAsset" WHERE id=${media.id}::uuid AND "trashExpiresAt"<=CURRENT_TIMESTAMP`;deleted+=1;}
      catch(error){failed.push({id:media.id,error:error instanceof Error?error.message:'Blob deletion failed'});}
    }
    return{checked:rows.length,deleted,failed};
  }

  private assertSharing(station:AuthenticatedStation){if(station.mode!==StationMode.SHARING)throw new ForbiddenException('La corbeille est gérée depuis SHARING.');}
  private assertUuid(value:string){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new BadRequestException('Identifiant média invalide');}
  private pathnameFor(media:PurgeRow){return`organizations/${media.organizationId}/events/${media.eventId}/media/${media.id}.${this.extension(media.mimeType)}`;}
  private extension(mime:string){switch(mime){case'image/jpeg':return'jpg';case'image/png':return'png';case'image/webp':return'webp';case'video/mp4':return'mp4';case'video/quicktime':return'mov';default:throw new BadRequestException(`Unsupported media type: ${mime}`);}}
}
