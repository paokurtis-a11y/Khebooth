import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingService } from './marketing.service';

type PeriodType='WEEKLY'|'MONTHLY'|'QUARTERLY'|'SEMIANNUAL'|'ANNUAL';
type Channel='GOOGLE'|'YOUTUBE'|'INSTAGRAM'|'FACEBOOK'|'TIKTOK'|'X'|'TELEGRAM'|'OTHER';

const PERIOD_DAYS:Record<PeriodType,number>={WEEKLY:7,MONTHLY:30,QUARTERLY:90,SEMIANNUAL:182,ANNUAL:365};
const CHANNELS:Channel[]=['GOOGLE','YOUTUBE','INSTAGRAM','FACEBOOK','TIKTOK','X'];

@Injectable()
export class GrowthIntelligenceService{
  constructor(private readonly prisma:PrismaService,private readonly marketing:MarketingService){}

  private async rootOwnerOrganization(organizationId:string){
    const rows=await this.prisma.$queryRaw<Array<{id:string;tenantKind:string;managedByOrganizationId:string|null}>>`
      SELECT id,"tenantKind","managedByOrganizationId" FROM "Organization" WHERE id=${organizationId}::uuid LIMIT 1
    `;
    return rows[0]??null;
  }

  async overview(organizationId:string,days=30){
    const data=await this.marketing.dashboard(organizationId,days);
    const paid=await this.prisma.$queryRaw<any[]>`
      SELECT id,channel,name,objective,audience,creative,"budgetCurrency","proposedBudgetCents",status,analysis,
             "projectedRevenueCents","projectedRoas","spentCents","attributedRevenueCents","startsAt","endsAt","createdAt","updatedAt"
      FROM "PaidMarketingCampaign" WHERE "organizationId"=${organizationId}::uuid ORDER BY "createdAt" DESC LIMIT 100
    `;
    const strategies=await this.prisma.$queryRaw<any[]>`
      SELECT id,"periodType","periodStart","periodEnd",summary,analysis,recommendations,projections,urgent,"createdAt"
      FROM "MarketingStrategyReport" WHERE "organizationId"=${organizationId}::uuid ORDER BY "createdAt" DESC LIMIT 30
    `;
    const spend=paid.reduce((sum,row)=>sum+Number(row.spentCents||0),0);
    const attributed=paid.reduce((sum,row)=>sum+Number(row.attributedRevenueCents||0),0);
    const grossProfit=Math.max(0,attributed-spend);
    const roas=spend>0?Math.round((attributed/spend)*100)/100:null;
    const roi=spend>0?Math.round(((attributed-spend)/spend)*1000)/10:null;
    const root=await this.rootOwnerOrganization(organizationId);
    return {
      ...data,
      stripe:{
        dashboardUrl:process.env.STRIPE_DASHBOARD_URL?.trim()||'https://dashboard.stripe.com/',
        accountLabel:'KHE Booth / Kurtis Hypnotic Events',
        sourceOfTruth:'Stripe Billing',
      },
      paidMarketing:{campaigns:paid,spendCents:spend,attributedRevenueCents:attributed,grossProfitCents:grossProfit,roas,roiPercent:roi,paymentGate:'OWNER_APPROVAL_REQUIRED'},
      strategies,
      connectors:{
        google:{connected:Boolean(process.env.GOOGLE_ADS_CUSTOMER_ID),spendEnabled:false},
        youtube:{connected:Boolean(process.env.YOUTUBE_CHANNEL_ID),spendEnabled:false},
        meta:{connected:Boolean(process.env.META_AD_ACCOUNT_ID),spendEnabled:false},
        tiktok:{connected:Boolean(process.env.TIKTOK_ADVERTISER_ID),spendEnabled:false},
        x:{connected:Boolean(process.env.X_ADS_ACCOUNT_ID),spendEnabled:false},
      },
      tenancy:{tenantKind:root?.tenantKind??'UNKNOWN',managedByOrganizationId:root?.managedByOrganizationId??null},
    };
  }

  private projection(summary:{visits:number;checkoutStarts:number;payments:number;revenueCents:number},budgetCents:number){
    const currentRevenue=Math.max(0,summary.revenueCents);
    const paymentRate=summary.checkoutStarts>0?summary.payments/summary.checkoutStarts:0;
    const averageOrder=summary.payments>0?currentRevenue/summary.payments:5900;
    const conservativeLift=Math.max(.03,Math.min(.18,paymentRate*.4+.04));
    const projectedIncrementalRevenue=Math.round(Math.max(budgetCents*1.5,currentRevenue*conservativeLift));
    const projectedRoas=budgetCents>0?Math.round((projectedIncrementalRevenue/budgetCents)*100)/100:0;
    return {paymentRate,averageOrderCents:Math.round(averageOrder),projectedIncrementalRevenueCents:projectedIncrementalRevenue,projectedRoas,projectedProfitCents:projectedIncrementalRevenue-budgetCents};
  }

  async generateStrategy(organizationId:string,periodTypeValue:string){
    const periodType=String(periodTypeValue||'WEEKLY').toUpperCase() as PeriodType;
    if(!(periodType in PERIOD_DAYS))throw new BadRequestException('Unsupported strategy period');
    const days=PERIOD_DAYS[periodType];
    const dashboard=await this.marketing.dashboard(organizationId,days);
    const suggestedBudget=Math.max(5000,Math.min(250000,Math.round(Math.max(dashboard.summary.revenueCents*.12,10000))));
    const projections=this.projection(dashboard.summary,suggestedBudget);
    const conversion=dashboard.summary.conversionPercent;
    const urgent=dashboard.summary.checkoutStarts>=20&&conversion<7;
    const recommendations=[
      conversion<10?'Renforcer la preuve sociale et simplifier le passage offre → paiement.':'Conserver le parcours de conversion actuel et tester une variante créative.',
      dashboard.summary.visits<100?'Augmenter la portée avec une campagne ciblée à faible budget soumise à validation.':'Segmenter les visiteurs selon l’offre consultée et recibler les abandons checkout.',
      'Séparer les créations Google, YouTube, Instagram/Facebook, TikTok et X afin de mesurer chaque canal sans mélanger les signaux.',
      'Ne publier aucune campagne payante avant validation explicite du propriétaire KHE.',
    ];
    const summary=`${periodType}: ${dashboard.summary.visits} visites, ${dashboard.summary.checkoutStarts} checkouts, ${dashboard.summary.payments} paiements, conversion ${conversion}%, revenus suivis CHF ${(dashboard.summary.revenueCents/100).toFixed(2)}.`;
    const analysis={dashboard:dashboard.summary,planPerformance:dashboard.planPerformance,generatedAt:new Date().toISOString(),method:'KHE growth heuristic v1'};
    const start=new Date(Date.now()-(days-1)*86400000);const end=new Date();
    const rows=await this.prisma.$queryRaw<any[]>`
      INSERT INTO "MarketingStrategyReport" (id,"organizationId","periodType","periodStart","periodEnd",summary,analysis,recommendations,projections,urgent)
      VALUES (gen_random_uuid(),${organizationId}::uuid,${periodType},${start.toISOString().slice(0,10)}::date,${end.toISOString().slice(0,10)}::date,
              ${summary},${JSON.stringify(analysis)}::jsonb,${JSON.stringify(recommendations)}::jsonb,${JSON.stringify({suggestedBudgetCents:suggestedBudget,...projections})}::jsonb,${urgent})
      ON CONFLICT ("organizationId","periodType","periodStart","periodEnd") DO UPDATE SET
        summary=EXCLUDED.summary,analysis=EXCLUDED.analysis,recommendations=EXCLUDED.recommendations,projections=EXCLUDED.projections,urgent=EXCLUDED.urgent,"createdAt"=CURRENT_TIMESTAMP
      RETURNING *
    `;
    if(urgent)await this.notifyOwner(organizationId,'⚠ Analyse marketing KHE prioritaire',`${summary} Une recommandation prioritaire vient d’être générée. Ouvrez Marketing & Analytics → Growth Lab.`,'/marketing/growth');
    return rows[0];
  }

  async generatePaidDrafts(organizationId:string,payload:Record<string,unknown>){
    const channelsRaw=Array.isArray(payload.channels)?payload.channels.map((value)=>String(value).toUpperCase()):CHANNELS;
    const channels=channelsRaw.filter((value):value is Channel=>CHANNELS.includes(value as Channel));
    if(!channels.length)throw new BadRequestException('Select at least one supported channel');
    const days=Math.min(90,Math.max(7,Number(payload.days??30)));
    const dashboard=await this.marketing.dashboard(organizationId,days);
    const totalBudget=Math.min(1000000,Math.max(0,Math.round(Number(payload.totalBudgetCents??30000))));
    const perChannel=Math.floor(totalBudget/channels.length);
    const projection=this.projection(dashboard.summary,perChannel);
    const country=String(payload.country??'CH').toUpperCase().slice(0,2);
    const offer=String(payload.offer??'PRO').toUpperCase();
    const created=[];
    for(const channel of channels){
      const audience={country,offer,segment:'PROSPECTS_AND_CHECKOUT_ABANDONERS',age:'25-54',notes:'À affiner manuellement avant approbation propriétaire'};
      const creative={format:channel==='YOUTUBE'?'VIDEO_16_9_AND_9_16':channel==='GOOGLE'?'SEARCH_AND_DISPLAY':channel==='INSTAGRAM'||channel==='TIKTOK'?'VERTICAL_9_16':'FEED_AND_VIDEO',headline:`KHE Booth ${offer} — créez, synchronisez et partagez vos événements`,cta:'Découvrir KHE Booth',status:'DRAFT'};
      const rows=await this.prisma.$queryRaw<any[]>`
        INSERT INTO "PaidMarketingCampaign" (id,"organizationId",channel,name,objective,audience,creative,"budgetCurrency","proposedBudgetCents",status,analysis,"projectedRevenueCents","projectedRoas")
        VALUES (gen_random_uuid(),${organizationId}::uuid,${channel},${`KHE ${offer} ${channel} ${new Date().toISOString().slice(0,10)}`},'CONVERSIONS',${JSON.stringify(audience)}::jsonb,${JSON.stringify(creative)}::jsonb,'CHF',${perChannel},'READY_FOR_APPROVAL',
                ${`Proposition générée automatiquement à partir des ${days} derniers jours. Aucune dépense ne peut être engagée sans approbation OWNER.`},${projection.projectedIncrementalRevenueCents},${projection.projectedRoas})
        RETURNING *
      `;
      created.push(rows[0]);
    }
    await this.notifyOwner(organizationId,'Nouvelles campagnes publicitaires à valider',`${created.length} brouillon(s) ont été préparés. Budget total proposé CHF ${(totalBudget/100).toFixed(2)}. Aucun paiement ni lancement n’a été effectué.`,'/marketing/growth');
    return {created,paymentExecuted:false,providerLaunchExecuted:false};
  }

  async approvePaidCampaign(organizationId:string,userId:string,userRole:string,id:string,approved:boolean){
    if(userRole!=='OWNER')throw new ForbiddenException('Only the KHE OWNER can approve paid advertising');
    const status=approved?'APPROVED':'REJECTED';
    const rows=await this.prisma.$queryRaw<any[]>`
      UPDATE "PaidMarketingCampaign" SET status=${status},"ownerApprovedAt"=${approved?new Date():null},"ownerApprovedByUserId"=${approved?userId:null}::uuid,"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${id}::uuid AND "organizationId"=${organizationId}::uuid AND status IN ('DRAFT','READY_FOR_APPROVAL','APPROVED')
      RETURNING *
    `;
    if(!rows[0])throw new BadRequestException('Campaign not found or cannot be changed');
    return {...rows[0],paymentExecuted:false,providerLaunchExecuted:false,nextStep:approved?'CONNECT_PROVIDER_AND_CONFIRM_SPEND':'NONE'};
  }

  async updatePaidCampaign(organizationId:string,id:string,payload:Record<string,unknown>){
    const budget=Math.min(1000000,Math.max(0,Math.round(Number(payload.proposedBudgetCents??0))));
    const audience=payload.audience&&typeof payload.audience==='object'?payload.audience:{};
    const creative=payload.creative&&typeof payload.creative==='object'?payload.creative:{};
    const analysis=payload.analysis?String(payload.analysis):null;
    const rows=await this.prisma.$queryRaw<any[]>`
      UPDATE "PaidMarketingCampaign" SET "proposedBudgetCents"=${budget},audience=${JSON.stringify(audience)}::jsonb,creative=${JSON.stringify(creative)}::jsonb,analysis=COALESCE(${analysis},analysis),status='READY_FOR_APPROVAL',"ownerApprovedAt"=NULL,"ownerApprovedByUserId"=NULL,"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${id}::uuid AND "organizationId"=${organizationId}::uuid AND status NOT IN ('ACTIVE','COMPLETED') RETURNING *
    `;
    if(!rows[0])throw new BadRequestException('Campaign not found or locked');
    return rows[0];
  }

  private async notifyOwner(organizationId:string,title:string,body:string,actionUrl:string){
    await this.prisma.$executeRaw`
      INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"actionUrl","publishedAt","createdAt")
      VALUES (gen_random_uuid(),${organizationId}::uuid,'NEWS',${title},${body},${actionUrl},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `;
    const owners=await this.prisma.$queryRaw<Array<{email:string}>>`SELECT email FROM "User" WHERE "organizationId"=${organizationId}::uuid AND role='OWNER' AND "isActive"=TRUE`;
    const key=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!key||!from)return;
    for(const owner of owners){await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[owner.email],subject:title,html:`<div style="font-family:Arial,sans-serif"><h2>${title}</h2><p>${body}</p><p><strong>KHE Booth</strong> · Marketing & Analytics</p></div>`})}).catch(()=>undefined);}
  }
}
