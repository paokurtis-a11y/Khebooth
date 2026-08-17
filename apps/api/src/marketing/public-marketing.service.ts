import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingService } from './marketing.service';

@Injectable()
export class PublicMarketingService{
  constructor(private readonly prisma:PrismaService,private readonly marketing:MarketingService){}
  async promotion(){
    const rows=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1`;
    if(!rows[0])return null;
    const campaign=await this.marketing.activePromotion(rows[0].id);
    if(!campaign)return null;
    return {id:campaign.id,name:campaign.name,planCode:campaign.planCode,discountPercent:campaign.discountPercent,startsAt:campaign.startsAt,endsAt:campaign.endsAt,messageTitle:campaign.messageTitle,messageBody:campaign.messageBody};
  }
}
