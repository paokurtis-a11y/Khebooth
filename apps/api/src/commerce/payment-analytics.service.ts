import { Injectable } from '@nestjs/common';
import { MarketingService } from '../marketing/marketing.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentAnalyticsService {
  constructor(private readonly prisma:PrismaService,private readonly marketing:MarketingService){}
  async completed(clientId:string,planCode:string|null,valueCents:number,metadata:Record<string,unknown>={}){
    const rows=await this.prisma.$queryRaw<Array<{organizationId:string}>>`SELECT "organizationId" FROM "Client" WHERE id=${clientId}::uuid LIMIT 1`;
    if(!rows[0])return;
    await this.marketing.trackServer(rows[0].organizationId,'CHECKOUT_COMPLETED',clientId,planCode,valueCents,metadata);
  }
}
