import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_EVENTS = new Set([
  'PAGE_VIEW','PLAN_VIEW','PLAN_SELECTED','CHECKOUT_STARTED','CHECKOUT_COMPLETED','APP_DOWNLOAD','MESSAGE_OPENED','CTA_CLICKED',
]);

type AutomationConfig = {
  organizationId:string; enabled:boolean; maxDiscountPercent:number; minCheckoutSample:number;
  lowConversionThresholdPercent:number; campaignDurationDays:number; cooldownDays:number;
  targetDiscovery:boolean; targetPaymentPending:boolean; ownerReportsEnabled:boolean; lastEvaluatedAt:Date|null;
};

type Campaign = {
  id:string; organizationId:string; name:string; planCode:string|null; segment:string; discountPercent:number;
  startsAt:Date; endsAt:Date; active:boolean; automatic:boolean; reason:string|null; messageTitle:string|null; messageBody:string|null;
  createdAt:Date; updatedAt:Date;
};

@Injectable()
export class MarketingService {
  constructor(private readonly prisma:PrismaService) {}

  private async firstOrganizationId():Promise<string>{
    const rows=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1`;
    if(!rows[0])throw new BadRequestException('Organization not initialized');
    return rows[0].id;
  }

  async trackPublic(payload:Record<string,unknown>){
    const organizationId=await this.firstOrganizationId();
    const eventType=String(payload.eventType??'').trim().toUpperCase();
    if(!PUBLIC_EVENTS.has(eventType))throw new BadRequestException('Unsupported analytics event');
    const anonymousId=payload.anonymousId?String(payload.anonymousId).slice(0,120):null;
    const planCode=payload.planCode?String(payload.planCode).slice(0,40).toUpperCase():null;
    const valueCents=payload.valueCents===undefined||payload.valueCents===null?null:Number(payload.valueCents);
    const metadata=payload.metadata&&typeof payload.metadata==='object'?payload.metadata:{};
    await this.prisma.$executeRaw`
      INSERT INTO "MarketingAnalyticsEvent" (id,"organizationId","anonymousId","eventType","planCode","valueCents",metadata)
      VALUES (gen_random_uuid(),${organizationId}::uuid,${anonymousId},${eventType},${planCode},${Number.isFinite(valueCents as number)?valueCents:null},${JSON.stringify(metadata)}::jsonb)
    `;
    return {tracked:true};
  }

  async trackServer(organizationId:string,eventType:string,clientId:string|null,planCode:string|null,valueCents:number|null,metadata:Record<string,unknown>={}){
    await this.prisma.$executeRaw`
      INSERT INTO "MarketingAnalyticsEvent" (id,"organizationId","clientId","eventType","planCode","valueCents",metadata)
      VALUES (gen_random_uuid(),${organizationId}::uuid,${clientId}::uuid,${eventType},${planCode},${valueCents},${JSON.stringify(metadata)}::jsonb)
    `;
  }

  async dashboard(organizationId:string,days=30){
    const safeDays=Math.min(365,Math.max(7,Math.trunc(days)||30));
    const summaryRows=await this.prisma.$queryRaw<Array<{visits:bigint;planSelections:bigint;checkoutStarts:bigint;payments:bigint;downloads:bigint;revenueCents:bigint}>>`
      SELECT
        count(*) FILTER (WHERE "eventType"='PAGE_VIEW') AS visits,
        count(*) FILTER (WHERE "eventType"='PLAN_SELECTED') AS "planSelections",
        count(*) FILTER (WHERE "eventType"='CHECKOUT_STARTED') AS "checkoutStarts",
        count(*) FILTER (WHERE "eventType"='CHECKOUT_COMPLETED') AS payments,
        count(*) FILTER (WHERE "eventType"='APP_DOWNLOAD') AS downloads,
        COALESCE(sum("valueCents") FILTER (WHERE "eventType"='CHECKOUT_COMPLETED'),0) AS "revenueCents"
      FROM "MarketingAnalyticsEvent"
      WHERE "organizationId"=${organizationId}::uuid AND "createdAt">=CURRENT_TIMESTAMP-${safeDays}*INTERVAL '1 day'
    `;
    const daily=await this.prisma.$queryRaw<Array<{day:Date;visits:bigint;checkouts:bigint;payments:bigint;revenueCents:bigint}>>`
      WITH days AS (SELECT generate_series(CURRENT_DATE-(${safeDays-1})::int,CURRENT_DATE,INTERVAL '1 day')::date AS day)
      SELECT d.day,
        count(e.id) FILTER (WHERE e."eventType"='PAGE_VIEW') AS visits,
        count(e.id) FILTER (WHERE e."eventType"='CHECKOUT_STARTED') AS checkouts,
        count(e.id) FILTER (WHERE e."eventType"='CHECKOUT_COMPLETED') AS payments,
        COALESCE(sum(e."valueCents") FILTER (WHERE e."eventType"='CHECKOUT_COMPLETED'),0) AS "revenueCents"
      FROM days d LEFT JOIN "MarketingAnalyticsEvent" e ON e."organizationId"=${organizationId}::uuid AND e."createdAt"::date=d.day
      GROUP BY d.day ORDER BY d.day ASC
    `;
    const planPerformance=await this.prisma.$queryRaw<Array<{planCode:string|null;selections:bigint;checkouts:bigint;payments:bigint;revenueCents:bigint}>>`
      SELECT "planCode",count(*) FILTER(WHERE "eventType"='PLAN_SELECTED') AS selections,
        count(*) FILTER(WHERE "eventType"='CHECKOUT_STARTED') AS checkouts,
        count(*) FILTER(WHERE "eventType"='CHECKOUT_COMPLETED') AS payments,
        COALESCE(sum("valueCents") FILTER(WHERE "eventType"='CHECKOUT_COMPLETED'),0) AS "revenueCents"
      FROM "MarketingAnalyticsEvent" WHERE "organizationId"=${organizationId}::uuid AND "createdAt">=CURRENT_TIMESTAMP-${safeDays}*INTERVAL '1 day'
      GROUP BY "planCode" ORDER BY payments DESC,selections DESC
    `;
    const summary=summaryRows[0]??{visits:0n,planSelections:0n,checkoutStarts:0n,payments:0n,downloads:0n,revenueCents:0n};
    const n=(value:bigint|number)=>Number(value);
    const checkoutStarts=n(summary.checkoutStarts); const payments=n(summary.payments); const visits=n(summary.visits);
    return {
      days:safeDays,
      summary:{visits,planSelections:n(summary.planSelections),checkoutStarts,payments,downloads:n(summary.downloads),revenueCents:n(summary.revenueCents),conversionPercent:checkoutStarts?Math.round((payments/checkoutStarts)*1000)/10:0,visitToPaymentPercent:visits?Math.round((payments/visits)*1000)/10:0},
      daily:daily.map((row)=>({day:row.day,visits:n(row.visits),checkouts:n(row.checkouts),payments:n(row.payments),revenueCents:n(row.revenueCents)})),
      planPerformance:planPerformance.map((row)=>({planCode:row.planCode,selections:n(row.selections),checkouts:n(row.checkouts),payments:n(row.payments),revenueCents:n(row.revenueCents)})),
      campaigns:await this.listCampaigns(organizationId),
      automation:await this.getAutomation(organizationId),
    };
  }

  async getAutomation(organizationId:string):Promise<AutomationConfig>{
    await this.prisma.$executeRaw`INSERT INTO "MarketingAutomationConfig" ("organizationId") VALUES (${organizationId}::uuid) ON CONFLICT ("organizationId") DO NOTHING`;
    const rows=await this.prisma.$queryRaw<AutomationConfig[]>`SELECT * FROM "MarketingAutomationConfig" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;
    return rows[0];
  }

  async updateAutomation(organizationId:string,payload:Record<string,unknown>){
    const maxDiscountPercent=Math.min(30,Math.max(0,Number(payload.maxDiscountPercent??15)));
    const minCheckoutSample=Math.min(1000,Math.max(5,Number(payload.minCheckoutSample??20)));
    const threshold=Math.min(80,Math.max(1,Number(payload.lowConversionThresholdPercent??10)));
    const duration=Math.min(30,Math.max(1,Number(payload.campaignDurationDays??7)));
    const cooldown=Math.min(90,Math.max(1,Number(payload.cooldownDays??21)));
    await this.getAutomation(organizationId);
    await this.prisma.$executeRaw`
      UPDATE "MarketingAutomationConfig" SET enabled=${payload.enabled!==false},"maxDiscountPercent"=${Math.trunc(maxDiscountPercent)},
      "minCheckoutSample"=${Math.trunc(minCheckoutSample)},"lowConversionThresholdPercent"=${Math.trunc(threshold)},
      "campaignDurationDays"=${Math.trunc(duration)},"cooldownDays"=${Math.trunc(cooldown)},
      "targetDiscovery"=${payload.targetDiscovery!==false},"targetPaymentPending"=${payload.targetPaymentPending!==false},
      "ownerReportsEnabled"=${payload.ownerReportsEnabled!==false},"updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=${organizationId}::uuid
    `;
    return this.getAutomation(organizationId);
  }

  async listCampaigns(organizationId:string){
    return this.prisma.$queryRaw<Campaign[]>`SELECT * FROM "MarketingCampaign" WHERE "organizationId"=${organizationId}::uuid ORDER BY "createdAt" DESC LIMIT 100`;
  }

  async createCampaign(organizationId:string,payload:Record<string,unknown>,automatic=false){
    const name=String(payload.name??'Campagne KHE').trim();
    const planCode=payload.planCode?String(payload.planCode).trim().toUpperCase():null;
    const segment=String(payload.segment??'ALL').trim().toUpperCase();
    const discountPercent=Math.min(30,Math.max(0,Math.trunc(Number(payload.discountPercent??0))));
    const startsAt=payload.startsAt?new Date(String(payload.startsAt)):new Date();
    const endsAt=payload.endsAt?new Date(String(payload.endsAt)):new Date(Date.now()+7*86400000);
    if(!name||Number.isNaN(startsAt.getTime())||Number.isNaN(endsAt.getTime())||endsAt<=startsAt)throw new BadRequestException('Invalid campaign');
    const reason=payload.reason?String(payload.reason):null; const messageTitle=payload.messageTitle?String(payload.messageTitle):null; const messageBody=payload.messageBody?String(payload.messageBody):null;
    const rows=await this.prisma.$queryRaw<Campaign[]>`
      INSERT INTO "MarketingCampaign" (id,"organizationId",name,"planCode",segment,"discountPercent","startsAt","endsAt",active,automatic,reason,"messageTitle","messageBody")
      VALUES (gen_random_uuid(),${organizationId}::uuid,${name},${planCode},${segment},${discountPercent},${startsAt},${endsAt},TRUE,${automatic},${reason},${messageTitle},${messageBody}) RETURNING *
    `;
    return rows[0];
  }

  async updateCampaign(organizationId:string,id:string,payload:Record<string,unknown>){
    const active=payload.active!==false;
    const discountPercent=Math.min(30,Math.max(0,Math.trunc(Number(payload.discountPercent??0))));
    const endsAt=payload.endsAt?new Date(String(payload.endsAt)):null;
    await this.prisma.$executeRaw`
      UPDATE "MarketingCampaign" SET active=${active},"discountPercent"=${discountPercent},
        "endsAt"=COALESCE(${endsAt},"endsAt"),"updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${id}::uuid AND "organizationId"=${organizationId}::uuid
    `;
    return this.listCampaigns(organizationId);
  }

  async activePromotion(organizationId:string){
    await this.evaluateAutomation(organizationId);
    const rows=await this.prisma.$queryRaw<Campaign[]>`
      SELECT * FROM "MarketingCampaign" WHERE "organizationId"=${organizationId}::uuid AND active=TRUE AND "startsAt"<=CURRENT_TIMESTAMP AND "endsAt">CURRENT_TIMESTAMP
      ORDER BY automatic ASC,"discountPercent" DESC,"createdAt" DESC LIMIT 1
    `;
    return rows[0]??null;
  }

  async evaluateAutomation(organizationId:string){
    const config=await this.getAutomation(organizationId);
    if(!config.enabled)return {evaluated:false,reason:'disabled'};
    if(config.lastEvaluatedAt&&Date.now()-new Date(config.lastEvaluatedAt).getTime()<60*60*1000)return {evaluated:false,reason:'recent'};
    await this.prisma.$executeRaw`UPDATE "MarketingAutomationConfig" SET "lastEvaluatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${organizationId}::uuid`;

    const active=await this.prisma.$queryRaw<Campaign[]>`SELECT * FROM "MarketingCampaign" WHERE "organizationId"=${organizationId}::uuid AND active=TRUE AND "startsAt"<=CURRENT_TIMESTAMP AND "endsAt">CURRENT_TIMESTAMP LIMIT 1`;
    if(active[0])return {evaluated:true,reason:'campaign_active'};
    const recent=await this.prisma.$queryRaw<Campaign[]>`
      SELECT * FROM "MarketingCampaign" WHERE "organizationId"=${organizationId}::uuid AND automatic=TRUE AND "createdAt">=CURRENT_TIMESTAMP-${config.cooldownDays}*INTERVAL '1 day' LIMIT 1
    `;
    if(recent[0])return {evaluated:true,reason:'cooldown'};
    const rows=await this.prisma.$queryRaw<Array<{checkouts:bigint;payments:bigint}>>`
      SELECT count(*) FILTER(WHERE "eventType"='CHECKOUT_STARTED') AS checkouts,count(*) FILTER(WHERE "eventType"='CHECKOUT_COMPLETED') AS payments
      FROM "MarketingAnalyticsEvent" WHERE "organizationId"=${organizationId}::uuid AND "createdAt">=CURRENT_TIMESTAMP-INTERVAL '30 day'
    `;
    const checkouts=Number(rows[0]?.checkouts??0); const payments=Number(rows[0]?.payments??0); const conversion=checkouts?payments/checkouts*100:100;
    if(checkouts<config.minCheckoutSample||conversion>=config.lowConversionThresholdPercent)return {evaluated:true,reason:'performance_ok',checkouts,payments,conversion};
    const deficit=Math.max(1,config.lowConversionThresholdPercent-conversion);
    const discount=Math.min(config.maxDiscountPercent,Math.max(5,Math.ceil(deficit/5)*5));
    const campaign=await this.createCampaign(organizationId,{name:`Boost conversion ${new Date().toISOString().slice(0,10)}`,planCode:'PRO',segment:'ALL',discountPercent:discount,startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+config.campaignDurationDays*86400000).toISOString(),reason:`Conversion checkout ${conversion.toFixed(1)}% sur ${checkouts} checkouts, sous le seuil ${config.lowConversionThresholdPercent}%.`,messageTitle:`Offre KHE Booth Pro -${discount}%`,messageBody:`Une offre limitée de ${discount}% est active pendant ${config.campaignDurationDays} jours.`},true);
    if(config.ownerReportsEnabled)await this.notifyOwner(organizationId,`Campagne automatique KHE : -${discount}%`,`KHE Booth a activé une promotion publique sur Pro. Motif : ${campaign.reason??'performance commerciale'}.`);
    return {evaluated:true,reason:'campaign_created',campaign};
  }

  private async notifyOwner(organizationId:string,title:string,body:string){
    await this.prisma.$executeRaw`
      INSERT INTO "AppNotification" (id,"organizationId",kind,title,body,"publishedAt","createdAt")
      VALUES (gen_random_uuid(),${organizationId}::uuid,'NEWS',${title},${body},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `;
    const owners=await this.prisma.$queryRaw<Array<{email:string}>>`SELECT email FROM "User" WHERE "organizationId"=${organizationId}::uuid AND role='OWNER' AND "isActive"=TRUE LIMIT 3`;
    const key=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!key||!from)return;
    for(const owner of owners){await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[owner.email],subject:title,html:`<h2>${title}</h2><p>${body}</p><p>Rapport disponible dans KHE Booth → Marketing.</p>`})});}
  }

  async reportPdf(organizationId:string,days=30):Promise<Buffer>{
    const report=await this.dashboard(organizationId,days);
    const lines=[
      'KHE Booth - Rapport Marketing & Analytics',
      `Période: ${report.days} jours`,
      `Visites: ${report.summary.visits}`,
      `Choix d offre: ${report.summary.planSelections}`,
      `Checkouts: ${report.summary.checkoutStarts}`,
      `Paiements: ${report.summary.payments}`,
      `Conversion checkout: ${report.summary.conversionPercent}%`,
      `Revenus suivis: CHF ${(report.summary.revenueCents/100).toFixed(2)}`,
      `Téléchargements application: ${report.summary.downloads}`,
    ];
    return this.simplePdf(lines,report.daily.map((d)=>d.payments));
  }

  private simplePdf(lines:string[],series:number[]):Buffer{
    const esc=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7E]/g,'?');
    const content:string[]=['BT','/F1 18 Tf','50 790 Td',`(${esc(lines[0])}) Tj`,'/F1 11 Tf'];
    for(let i=1;i<lines.length;i+=1){content.push(`0 -22 Td (${esc(lines[i])}) Tj`);}content.push('ET');
    const chartX=50,chartY=430,chartW=500,chartH=180;content.push('0.7 w',`${chartX} ${chartY} m ${chartX} ${chartY+chartH} l ${chartX+chartW} ${chartY+chartH} l S`);
    const max=Math.max(1,...series);if(series.length>1){const points=series.map((v,i)=>[chartX+i*(chartW/(series.length-1)),chartY+(v/max)*chartH]);content.push('1.5 w',`${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)} m`,...points.slice(1).map(([x,y])=>`${x.toFixed(1)} ${y.toFixed(1)} l`),'S');}
    content.push('BT','/F1 10 Tf',`50 405 Td (${esc('Courbe des paiements quotidiens')}) Tj`,'ET');
    const stream=content.join('\n');
    const objects=[
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf='%PDF-1.4\n';const offsets:number[]=[0];objects.forEach((obj,index)=>{offsets[index+1]=Buffer.byteLength(pdf);pdf+=`${index+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i+=1)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf,'binary');
  }
}
