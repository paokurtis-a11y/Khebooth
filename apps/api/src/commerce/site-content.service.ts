import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  async update(organizationId:string,payload:Record<string,unknown>){
    const media=payload.media&&typeof payload.media==='object'?payload.media:{};
    const seo=payload.seo&&typeof payload.seo==='object'?payload.seo:{};
    const socialLinks=payload.socialLinks&&typeof payload.socialLinks==='object'?payload.socialLinks:{};
    const announcement=payload.announcement&&typeof payload.announcement==='object'?payload.announcement:{};
    const contentBlocks=Array.isArray(payload.contentBlocks)?payload.contentBlocks:[];
    if(JSON.stringify(payload).length>100_000)throw new BadRequestException('Marketing configuration is too large');
    await this.prisma.$executeRaw`
      INSERT INTO "MarketingSiteConfig" ("organizationId") VALUES (${organizationId}::uuid)
      ON CONFLICT ("organizationId") DO NOTHING
    `;
    await this.prisma.$executeRaw`
      UPDATE "MarketingSiteConfig" SET media=${JSON.stringify(media)}::jsonb,seo=${JSON.stringify(seo)}::jsonb,
        "socialLinks"=${JSON.stringify(socialLinks)}::jsonb,announcement=${JSON.stringify(announcement)}::jsonb,
        "contentBlocks"=${JSON.stringify(contentBlocks)}::jsonb,"updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=${organizationId}::uuid
    `;
    return {saved:true};
  }
}
