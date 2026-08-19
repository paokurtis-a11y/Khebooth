import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ClientRow={id:string;organizationId:string;name:string;email:string|null;kheCode:string|null;subscriptionPlan:string;billingCustomerId:string|null;billingSubscriptionId:string|null;marketingEmailsEnabled:boolean};
type PlanRow={code:string;name:string;features:unknown};
type BillingSettings={
  organizationId:string;automaticTaxEnabled:boolean;taxInclusive:boolean;stripeTaxCode:string|null;invoiceEmailEnabled:boolean;receiptEmailEnabled:boolean;remindersEnabled:boolean;reminderDelaysDays:unknown;reminderTitle:string;reminderBody:string;thankYouEnabled:boolean;thankYouTitle:string;thankYouBody:string;invoiceTitle:string;receiptTitle:string;companyLegalName:string;companyDetails:string;logoUrl:string|null;fontFamily:string;fontScale:number;documentStyle:string;accentColor:string;secondaryColor:string;backgroundColor:string;textColor:string;invoiceNote:string;receiptNote:string;footerText:string;updatedAt:Date;
};
type BillingDocument={id:string;organizationId:string;clientId:string;provider:string;providerDocumentId:string;providerPaymentId:string|null;documentType:string;documentNumber:string|null;status:string;billingReason:string|null;currency:string;subtotalCents:number;taxCents:number;totalCents:number;taxCountry:string|null;taxDetails:unknown;hostedUrl:string|null;pdfUrl:string|null;receiptUrl:string|null;periodStart:Date|null;periodEnd:Date|null;dueAt:Date|null;issuedAt:Date;failedAt:Date|null;paidAt:Date|null;metadata:Record<string,unknown>;createdAt:Date;updatedAt:Date};

type ReminderCandidate=BillingDocument&{clientName:string;clientEmail:string|null;clientPlan:string;clientMarketing:boolean};

@Injectable()
export class BillingAutomationService{
  constructor(private readonly prisma:PrismaService){}

  async settings(organizationId:string):Promise<BillingSettings>{
    await this.prisma.$executeRaw`INSERT INTO "BillingAutomationSettings" ("organizationId") VALUES (${organizationId}::uuid) ON CONFLICT ("organizationId") DO NOTHING`;
    const rows=await this.prisma.$queryRaw<BillingSettings[]>`SELECT * FROM "BillingAutomationSettings" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;
    if(!rows[0])throw new ServiceUnavailableException('Billing settings unavailable');
    return rows[0];
  }

  async updateSettings(organizationId:string,payload:Record<string,unknown>){
    const current=await this.settings(organizationId);
    const color=(value:unknown,fallback:string)=>{const text=String(value??fallback).trim();return /^#[0-9a-fA-F]{6}$/.test(text)?text:fallback;};
    const short=(value:unknown,fallback:string,max=180)=>String(value??fallback).trim().slice(0,max)||fallback;
    const long=(value:unknown,fallback:string,max=3000)=>String(value??fallback).trim().slice(0,max)||fallback;
    const delaysSource=Array.isArray(payload.reminderDelaysDays)?payload.reminderDelaysDays:current.reminderDelaysDays;
    const delays=[...new Set((Array.isArray(delaysSource)?delaysSource:[1,3,7]).map((value)=>Math.trunc(Number(value))).filter((value)=>Number.isFinite(value)&&value>=1&&value<=60))].sort((a,b)=>a-b).slice(0,8);
    if(!delays.length)delays.push(1,3,7);
    const scale=Math.min(1.6,Math.max(.75,Number(payload.fontScale??current.fontScale??1)));
    const style=['ELEGANT','MODERN','CLASSIC','MINIMAL'].includes(String(payload.documentStyle??current.documentStyle).toUpperCase())?String(payload.documentStyle??current.documentStyle).toUpperCase():'ELEGANT';
    const logoValue=payload.logoUrl===null||payload.logoUrl===''?null:String(payload.logoUrl??current.logoUrl??'').trim().slice(0,1000)||null;
    if(logoValue){let parsed:URL;try{parsed=new URL(logoValue);}catch{throw new BadRequestException('Le logo doit être une URL HTTPS valide.');}if(parsed.protocol!=='https:')throw new BadRequestException('Le logo doit utiliser HTTPS.');}
    const taxCode=payload.stripeTaxCode===null||payload.stripeTaxCode===''?null:String(payload.stripeTaxCode??current.stripeTaxCode??'').trim().slice(0,80)||null;
    const next={
      automaticTaxEnabled:payload.automaticTaxEnabled===undefined?current.automaticTaxEnabled:payload.automaticTaxEnabled!==false,
      taxInclusive:payload.taxInclusive===undefined?current.taxInclusive:payload.taxInclusive!==false,
      stripeTaxCode:taxCode,
      invoiceEmailEnabled:payload.invoiceEmailEnabled===undefined?current.invoiceEmailEnabled:payload.invoiceEmailEnabled!==false,
      receiptEmailEnabled:payload.receiptEmailEnabled===undefined?current.receiptEmailEnabled:payload.receiptEmailEnabled!==false,
      remindersEnabled:payload.remindersEnabled===undefined?current.remindersEnabled:payload.remindersEnabled!==false,
      reminderDelaysDays:delays,
      reminderTitle:short(payload.reminderTitle,current.reminderTitle,240),reminderBody:long(payload.reminderBody,current.reminderBody),
      thankYouEnabled:payload.thankYouEnabled===undefined?current.thankYouEnabled:payload.thankYouEnabled!==false,
      thankYouTitle:short(payload.thankYouTitle,current.thankYouTitle,240),thankYouBody:long(payload.thankYouBody,current.thankYouBody),
      invoiceTitle:short(payload.invoiceTitle,current.invoiceTitle,180),receiptTitle:short(payload.receiptTitle,current.receiptTitle,180),companyLegalName:short(payload.companyLegalName,current.companyLegalName,180),companyDetails:long(payload.companyDetails,current.companyDetails,1200),logoUrl:logoValue,fontFamily:short(payload.fontFamily,current.fontFamily,80),fontScale:scale,documentStyle:style,accentColor:color(payload.accentColor,current.accentColor),secondaryColor:color(payload.secondaryColor,current.secondaryColor),backgroundColor:color(payload.backgroundColor,current.backgroundColor),textColor:color(payload.textColor,current.textColor),invoiceNote:long(payload.invoiceNote,current.invoiceNote,1200),receiptNote:long(payload.receiptNote,current.receiptNote,1200),footerText:long(payload.footerText,current.footerText,1200),
    };
    await this.prisma.$executeRaw`
      UPDATE "BillingAutomationSettings" SET
        "automaticTaxEnabled"=${next.automaticTaxEnabled},"taxInclusive"=${next.taxInclusive},"stripeTaxCode"=${next.stripeTaxCode},
        "invoiceEmailEnabled"=${next.invoiceEmailEnabled},"receiptEmailEnabled"=${next.receiptEmailEnabled},"remindersEnabled"=${next.remindersEnabled},"reminderDelaysDays"=${JSON.stringify(next.reminderDelaysDays)}::jsonb,
        "reminderTitle"=${next.reminderTitle},"reminderBody"=${next.reminderBody},"thankYouEnabled"=${next.thankYouEnabled},"thankYouTitle"=${next.thankYouTitle},"thankYouBody"=${next.thankYouBody},
        "invoiceTitle"=${next.invoiceTitle},"receiptTitle"=${next.receiptTitle},"companyLegalName"=${next.companyLegalName},"companyDetails"=${next.companyDetails},"logoUrl"=${next.logoUrl},"fontFamily"=${next.fontFamily},"fontScale"=${next.fontScale},"documentStyle"=${next.documentStyle},"accentColor"=${next.accentColor},"secondaryColor"=${next.secondaryColor},"backgroundColor"=${next.backgroundColor},"textColor"=${next.textColor},"invoiceNote"=${next.invoiceNote},"receiptNote"=${next.receiptNote},"footerText"=${next.footerText},"updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=${organizationId}::uuid
    `;
    return this.settings(organizationId);
  }

  async handleStripeEvent(event:any){
    const type=String(event?.type??'');const object=event?.data?.object??{};
    if(type.startsWith('invoice.')){
      const client=await this.resolveClient(object);if(!client)return{processed:false,reason:'client_not_found'};
      const document=await this.upsertInvoice(client,object,type);
      if(type==='invoice.finalized')await this.sendInvoice(client,document);
      if(type==='invoice.paid')await this.sendReceiptAndThanks(client,document);
      if(type==='invoice.payment_failed')await this.sendPaymentFailureNotice(client,document);
      return{processed:true,documentId:document.id};
    }
    if(type==='checkout.session.completed'&&object?.payment_status==='paid'&&String(object?.mode??'')==='payment'){
      const client=await this.resolveClient(object);if(!client)return{processed:false,reason:'client_not_found'};
      const document=await this.upsertOneTimeReceipt(client,object);
      await this.sendReceiptAndThanks(client,document);
      return{processed:true,documentId:document.id};
    }
    if(type==='charge.refunded'){
      const paymentId=String(object?.payment_intent??object?.id??'');if(paymentId)await this.prisma.$executeRaw`UPDATE "BillingDocument" SET status='REFUNDED',"updatedAt"=CURRENT_TIMESTAMP WHERE "providerPaymentId"=${paymentId}`;
      return{processed:true};
    }
    return{processed:false,reason:'event_not_used'};
  }

  async documentsForClient(clientId:string){
    return this.prisma.$queryRaw<BillingDocument[]>`
      SELECT * FROM "BillingDocument" WHERE "clientId"=${clientId}::uuid ORDER BY "issuedAt" DESC LIMIT 36
    `;
  }

  async runReminders(){
    const rows=await this.prisma.$queryRaw<ReminderCandidate[]>`
      SELECT d.*,c.name AS "clientName",c.email AS "clientEmail",c."subscriptionPlan" AS "clientPlan",c."marketingEmailsEnabled" AS "clientMarketing"
      FROM "BillingDocument" d JOIN "Client" c ON c.id=d."clientId"
      WHERE d.status IN ('OPEN','PAST_DUE') AND d."failedAt" IS NOT NULL
      ORDER BY d."failedAt" ASC LIMIT 500
    `;
    let sent=0;
    for(const document of rows){
      const settings=await this.settings(document.organizationId);if(!settings.remindersEnabled)continue;
      const delays=this.reminderDelays(settings.reminderDelaysDays);
      for(const delay of delays){
        const due=new Date(document.failedAt!.getTime()+delay*86_400_000);if(Date.now()<due.getTime())continue;
        const client:ClientRow={id:document.clientId,organizationId:document.organizationId,name:document.clientName,email:document.clientEmail,kheCode:null,subscriptionPlan:document.clientPlan,billingCustomerId:null,billingSubscriptionId:null,marketingEmailsEnabled:document.clientMarketing};
        const plan=await this.plan(document.organizationId,document.clientPlan);
        const vars=this.variables(client,plan,document);
        const title=this.template(settings.reminderTitle,vars);const body=this.template(settings.reminderBody,vars);
        const key=`REMINDER:${document.id}:${delay}`;
        const app=await this.deliverAppOnce(client,document,key,title,body,'PAYMENT','/account');
        const email=client.email?await this.deliverEmailOnce(client,document,key,title,this.emailHtml(settings,title,body,document,'PAYMENT')):false;
        if(app||email)sent+=1;
      }
    }
    return{checked:rows.length,sent};
  }

  private async resolveClient(object:any):Promise<ClientRow|null>{
    const clientId=object?.metadata?.clientId?String(object.metadata.clientId):null;
    if(clientId){const rows=await this.prisma.$queryRaw<ClientRow[]>`SELECT * FROM "Client" WHERE id=${clientId}::uuid LIMIT 1`;if(rows[0])return rows[0];}
    const customerId=typeof object?.customer==='string'?object.customer:null;
    const subscriptionId=typeof object?.subscription==='string'?object.subscription:null;
    if(!customerId&&!subscriptionId)return null;
    const rows=await this.prisma.$queryRaw<ClientRow[]>`
      SELECT * FROM "Client" WHERE (${customerId}::text IS NOT NULL AND "billingCustomerId"=${customerId}) OR (${subscriptionId}::text IS NOT NULL AND "billingSubscriptionId"=${subscriptionId}) LIMIT 1
    `;
    return rows[0]??null;
  }

  private async plan(organizationId:string,code:string):Promise<PlanRow|null>{
    const rows=await this.prisma.$queryRaw<PlanRow[]>`SELECT code,name,features FROM "SubscriptionPlanConfig" WHERE "organizationId"=${organizationId}::uuid AND code=${code} LIMIT 1`;
    return rows[0]??null;
  }

  private sumTaxes(object:any):number{
    const sources=[object?.total_taxes,object?.total_tax_amounts,object?.tax_amounts];
    for(const source of sources){if(Array.isArray(source))return source.reduce((sum:number,item:any)=>sum+Math.max(0,Number(item?.amount??0)||0),0);}
    return Math.max(0,Number(object?.total_details?.amount_tax??0)||0);
  }

  private timestamp(value:unknown):Date|null{const n=Number(value);return Number.isFinite(n)&&n>0?new Date(n*1000):null;}

  private async upsertInvoice(client:ClientRow,invoice:any,eventType:string):Promise<BillingDocument>{
    const providerDocumentId=String(invoice?.id??'');if(!providerDocumentId)throw new BadRequestException('Stripe invoice id missing');
    const taxDetails=Array.isArray(invoice?.total_taxes)?invoice.total_taxes:Array.isArray(invoice?.total_tax_amounts)?invoice.total_tax_amounts:[];
    const line=invoice?.lines?.data?.[0]??{};const periodStart=this.timestamp(line?.period?.start);const periodEnd=this.timestamp(line?.period?.end);
    const status=eventType==='invoice.paid'?'PAID':eventType==='invoice.payment_failed'?'PAST_DUE':String(invoice?.status??'OPEN').toUpperCase();
    const paidAt=this.timestamp(invoice?.status_transitions?.paid_at)??(eventType==='invoice.paid'?new Date():null);
    const failedAt=eventType==='invoice.payment_failed'?new Date():null;
    const metadata={...(invoice?.metadata&&typeof invoice.metadata==='object'?invoice.metadata:{}),planCode:invoice?.metadata?.planCode??client.subscriptionPlan};
    const rows=await this.prisma.$queryRaw<BillingDocument[]>`
      INSERT INTO "BillingDocument" ("organizationId","clientId",provider,"providerDocumentId","providerPaymentId","documentType","documentNumber",status,"billingReason",currency,"subtotalCents","taxCents","totalCents","taxCountry","taxDetails","hostedUrl","pdfUrl","receiptUrl","periodStart","periodEnd","dueAt","issuedAt","failedAt","paidAt",metadata,"updatedAt")
      VALUES (${client.organizationId}::uuid,${client.id}::uuid,'stripe',${providerDocumentId},${typeof invoice?.payment_intent==='string'?invoice.payment_intent:null},${eventType==='invoice.paid'?'INVOICE_RECEIPT':'INVOICE'},${invoice?.number?String(invoice.number):null},${status},${invoice?.billing_reason?String(invoice.billing_reason):null},${String(invoice?.currency??'chf').toUpperCase()},${Math.max(0,Number(invoice?.subtotal??0)||0)},${this.sumTaxes(invoice)},${Math.max(0,Number(invoice?.total??invoice?.amount_due??0)||0)},${invoice?.customer_address?.country?String(invoice.customer_address.country).toUpperCase():null},${JSON.stringify(taxDetails)}::jsonb,${invoice?.hosted_invoice_url?String(invoice.hosted_invoice_url):null},${invoice?.invoice_pdf?String(invoice.invoice_pdf):null},NULL,${periodStart},${periodEnd},${this.timestamp(invoice?.due_date)},${this.timestamp(invoice?.created)??new Date()},${failedAt},${paidAt},${JSON.stringify(metadata)}::jsonb,CURRENT_TIMESTAMP)
      ON CONFLICT (provider,"providerDocumentId") DO UPDATE SET
        "providerPaymentId"=COALESCE(EXCLUDED."providerPaymentId","BillingDocument"."providerPaymentId"),"documentType"=EXCLUDED."documentType","documentNumber"=COALESCE(EXCLUDED."documentNumber","BillingDocument"."documentNumber"),status=EXCLUDED.status,"billingReason"=COALESCE(EXCLUDED."billingReason","BillingDocument"."billingReason"),currency=EXCLUDED.currency,"subtotalCents"=EXCLUDED."subtotalCents","taxCents"=EXCLUDED."taxCents","totalCents"=EXCLUDED."totalCents","taxCountry"=COALESCE(EXCLUDED."taxCountry","BillingDocument"."taxCountry"),"taxDetails"=EXCLUDED."taxDetails","hostedUrl"=COALESCE(EXCLUDED."hostedUrl","BillingDocument"."hostedUrl"),"pdfUrl"=COALESCE(EXCLUDED."pdfUrl","BillingDocument"."pdfUrl"),"periodStart"=COALESCE(EXCLUDED."periodStart","BillingDocument"."periodStart"),"periodEnd"=COALESCE(EXCLUDED."periodEnd","BillingDocument"."periodEnd"),"dueAt"=COALESCE(EXCLUDED."dueAt","BillingDocument"."dueAt"),"failedAt"=COALESCE(EXCLUDED."failedAt","BillingDocument"."failedAt"),"paidAt"=COALESCE(EXCLUDED."paidAt","BillingDocument"."paidAt"),metadata=EXCLUDED.metadata,"updatedAt"=CURRENT_TIMESTAMP
      RETURNING *
    `;
    return rows[0];
  }

  private async upsertOneTimeReceipt(client:ClientRow,session:any):Promise<BillingDocument>{
    const providerDocumentId=`checkout:${String(session?.id??'')}`;const paymentIntent=typeof session?.payment_intent==='string'?session.payment_intent:null;
    const receiptUrl=paymentIntent?await this.receiptForPaymentIntent(paymentIntent):null;
    const metadata={...(session?.metadata&&typeof session.metadata==='object'?session.metadata:{}),planCode:session?.metadata?.planCode??client.subscriptionPlan};
    const rows=await this.prisma.$queryRaw<BillingDocument[]>`
      INSERT INTO "BillingDocument" ("organizationId","clientId",provider,"providerDocumentId","providerPaymentId","documentType",status,currency,"subtotalCents","taxCents","totalCents","taxCountry","taxDetails","receiptUrl","issuedAt","paidAt",metadata,"updatedAt")
      VALUES (${client.organizationId}::uuid,${client.id}::uuid,'stripe',${providerDocumentId},${paymentIntent},'RECEIPT','PAID',${String(session?.currency??session?.metadata?.currency??'chf').toUpperCase()},${Math.max(0,Number(session?.amount_subtotal??session?.amount_total??0)||0)},${Math.max(0,Number(session?.total_details?.amount_tax??0)||0)},${Math.max(0,Number(session?.amount_total??0)||0)},${session?.customer_details?.address?.country?String(session.customer_details.address.country).toUpperCase():null},${JSON.stringify(session?.total_details??{})}::jsonb,${receiptUrl},${this.timestamp(session?.created)??new Date()},CURRENT_TIMESTAMP,${JSON.stringify(metadata)}::jsonb,CURRENT_TIMESTAMP)
      ON CONFLICT (provider,"providerDocumentId") DO UPDATE SET "providerPaymentId"=COALESCE(EXCLUDED."providerPaymentId","BillingDocument"."providerPaymentId"),status='PAID',"receiptUrl"=COALESCE(EXCLUDED."receiptUrl","BillingDocument"."receiptUrl"),"paidAt"=COALESCE("BillingDocument"."paidAt",CURRENT_TIMESTAMP),metadata=EXCLUDED.metadata,"updatedAt"=CURRENT_TIMESTAMP RETURNING *
    `;
    return rows[0];
  }

  private async receiptForPaymentIntent(paymentIntentId:string):Promise<string|null>{
    try{
      const intent=await this.stripeGet(`/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`) as any;
      const charge=intent?.latest_charge;if(charge&&typeof charge==='object'&&charge.receipt_url)return String(charge.receipt_url);
      const chargeId=typeof charge==='string'?charge:null;if(!chargeId)return null;
      const detail=await this.stripeGet(`/v1/charges/${encodeURIComponent(chargeId)}`) as any;return detail?.receipt_url?String(detail.receipt_url):null;
    }catch{return null;}
  }

  private async stripeGet(path:string){const key=process.env.STRIPE_SECRET_KEY?.trim();if(!key)throw new ServiceUnavailableException('Stripe is not configured');const response=await fetch(`https://api.stripe.com${path}`,{headers:{Authorization:`Bearer ${key}`}});const body=await response.json();if(!response.ok)throw new ServiceUnavailableException((body as any)?.error?.message||'Stripe request failed');return body;}

  private async sendInvoice(client:ClientRow,document:BillingDocument){
    const settings=await this.settings(client.organizationId);if(!settings.invoiceEmailEnabled)return;
    const plan=await this.plan(client.organizationId,String(document.metadata?.planCode??client.subscriptionPlan));const vars=this.variables(client,plan,document);
    const title=`${settings.invoiceTitle} • ${vars.amount}`;const body=`Bonjour ${client.name}, votre facture ${plan?.name??client.subscriptionPlan} est disponible. Le montant inclut les taxes applicables calculées pour votre transaction.`;
    await this.deliverAppOnce(client,document,`INVOICE:${document.id}`,title,body,'INVOICE',document.hostedUrl||document.pdfUrl||'/account');
    if(client.email)await this.deliverEmailOnce(client,document,`INVOICE:${document.id}`,title,this.emailHtml(settings,title,body,document,'INVOICE'));
  }

  private async sendReceiptAndThanks(client:ClientRow,document:BillingDocument){
    const settings=await this.settings(client.organizationId);const plan=await this.plan(client.organizationId,String(document.metadata?.planCode??client.subscriptionPlan));const vars=this.variables(client,plan,document);
    const title=this.template(settings.thankYouEnabled?settings.thankYouTitle:settings.receiptTitle,vars);
    const thankYou=settings.thankYouEnabled?this.template(settings.thankYouBody,vars):settings.receiptNote;
    const body=`${thankYou} Paiement reçu : ${vars.amount}${document.taxCents>0?` dont ${this.money(document.taxCents,document.currency)} de taxes incluses`:''}.`;
    await this.deliverAppOnce(client,document,`RECEIPT:${document.id}`,title,body,'PAYMENT',document.receiptUrl||document.hostedUrl||document.pdfUrl||'/account');
    if(settings.receiptEmailEnabled&&client.email)await this.deliverEmailOnce(client,document,`RECEIPT:${document.id}`,title,this.emailHtml(settings,title,body,document,'RECEIPT'));
  }

  private async sendPaymentFailureNotice(client:ClientRow,document:BillingDocument){
    const title='Paiement KHE Booth non abouti';const body='Votre paiement n’a pas pu être confirmé. KHE Booth continue de protéger vos données et vous guidera pour régulariser la situation. Des rappels pourront être envoyés selon les paramètres de facturation.';
    await this.deliverAppOnce(client,document,`FAILED:${document.id}`,title,body,'PAYMENT','/account');
    if(client.email){const settings=await this.settings(client.organizationId);await this.deliverEmailOnce(client,document,`FAILED:${document.id}`,title,this.emailHtml(settings,title,body,document,'PAYMENT'));}
  }

  private variables(client:ClientRow,plan:PlanRow|null,document:BillingDocument){
    const features=Array.isArray(plan?.features)?plan!.features.map(String).filter(Boolean).slice(0,8).join(' • '):'vos fonctionnalités KHE Booth';
    return{clientName:client.name,planName:plan?.name??client.subscriptionPlan,features,amount:this.money(document.totalCents,document.currency),currency:document.currency,tax:this.money(document.taxCents,document.currency),documentNumber:document.documentNumber??document.providerDocumentId};
  }

  private template(value:string,vars:Record<string,string>){return value.replace(/{{\s*(clientName|planName|features|amount|currency|tax|documentNumber)\s*}}/g,(_,key:string)=>vars[key]??'');}
  private money(cents:number,currency:string){try{return new Intl.NumberFormat('fr-CH',{style:'currency',currency}).format(cents/100);}catch{return`${(cents/100).toFixed(2)} ${currency}`;}}
  private reminderDelays(value:unknown){const source=Array.isArray(value)?value:[1,3,7];return [...new Set(source.map((item)=>Math.trunc(Number(item))).filter((item)=>Number.isFinite(item)&&item>=1&&item<=60))].sort((a,b)=>a-b);}
  private escape(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

  private emailHtml(settings:BillingSettings,title:string,body:string,document:BillingDocument,kind:string){
    const buttonUrl=document.receiptUrl||document.hostedUrl||document.pdfUrl;const font=this.escape(settings.fontFamily||'Arial');const scale=Math.min(1.6,Math.max(.75,Number(settings.fontScale)||1));const logo=settings.logoUrl?`<img src="${this.escape(settings.logoUrl)}" alt="KHE Booth" style="max-height:66px;max-width:190px;object-fit:contain;margin-bottom:18px">`:`<div style="font-size:${Math.round(22*scale)}px;font-weight:900;letter-spacing:4px;color:${settings.accentColor};margin-bottom:12px">KHE BOOTH</div>`;
    const note=kind==='INVOICE'?settings.invoiceNote:kind==='RECEIPT'?settings.receiptNote:'';
    return `<div style="margin:0;padding:30px;background:#f2f3f5;font-family:${font},Arial,sans-serif"><div style="max-width:680px;margin:auto;background:${settings.backgroundColor};color:${settings.textColor};border-radius:24px;overflow:hidden;border:1px solid #2a2a2a"><div style="padding:30px;background:linear-gradient(135deg,${settings.backgroundColor},#16181d)">${logo}<div style="font-size:${Math.round(12*scale)}px;font-weight:800;letter-spacing:2px;color:${settings.accentColor}">${this.escape(settings.companyLegalName)}</div><h1 style="font-size:${Math.round(30*scale)}px;line-height:1.15;margin:8px 0 12px;color:${settings.textColor}">${this.escape(title)}</h1><p style="font-size:${Math.round(15*scale)}px;line-height:1.65;color:${settings.textColor};opacity:.88">${this.escape(body)}</p></div><div style="padding:24px 30px;background:#fff;color:#151515"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;color:#666">Document</td><td style="padding:8px 0;text-align:right;font-weight:800">${this.escape(document.documentNumber??document.providerDocumentId)}</td></tr><tr><td style="padding:8px 0;color:#666">Montant</td><td style="padding:8px 0;text-align:right;font-weight:900">${this.escape(this.money(document.totalCents,document.currency))}</td></tr><tr><td style="padding:8px 0;color:#666">Taxes incluses</td><td style="padding:8px 0;text-align:right;font-weight:800">${this.escape(this.money(document.taxCents,document.currency))}${document.taxCountry?` · ${this.escape(document.taxCountry)}`:''}</td></tr><tr><td style="padding:8px 0;color:#666">Statut</td><td style="padding:8px 0;text-align:right;font-weight:900;color:${document.status==='PAID'?'#167344':'#a06400'}">${this.escape(document.status)}</td></tr></table>${buttonUrl?`<a href="${this.escape(buttonUrl)}" style="display:block;margin-top:22px;padding:15px 18px;border-radius:12px;text-align:center;background:${settings.accentColor};color:#111;text-decoration:none;font-weight:900">Ouvrir le document sécurisé</a>`:''}<p style="margin:22px 0 0;color:#555;line-height:1.6">${this.escape(note)}</p></div><div style="padding:18px 30px;color:${settings.textColor};font-size:12px;opacity:.7">${this.escape(settings.companyDetails)}<br>${this.escape(settings.footerText)}</div></div></div>`;
  }

  private async deliverAppOnce(client:ClientRow,document:BillingDocument,key:string,title:string,body:string,kind:string,actionUrl:string|null){
    const started=await this.beginDelivery(client,document,key,'APP');if(!started)return false;
    try{await this.prisma.$executeRaw`INSERT INTO "ClientMessage" (id,"organizationId","clientId",kind,title,body,"actionUrl","emailRequested") VALUES (gen_random_uuid(),${client.organizationId}::uuid,${client.id}::uuid,${kind},${title},${body},${actionUrl},FALSE)`;await this.finishDelivery(started,'SENT',null,null);return true;}catch(error){await this.finishDelivery(started,'FAILED',null,error instanceof Error?error.message:'App delivery failed');return false;}
  }

  private async deliverEmailOnce(client:ClientRow,document:BillingDocument,key:string,subject:string,html:string){
    if(!client.email)return false;const started=await this.beginDelivery(client,document,key,'EMAIL');if(!started)return false;
    const apiKey=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!apiKey||!from){await this.finishDelivery(started,'FAILED',null,'Email provider not configured');return false;}
    try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[client.email],subject,html})});const payload=await response.json() as{id?:string;message?:string};if(!response.ok)throw new Error(payload.message||`Email HTTP ${response.status}`);await this.finishDelivery(started,'SENT',payload.id??null,null);return true;}catch(error){await this.finishDelivery(started,'FAILED',null,error instanceof Error?error.message:'Email failed');return false;}
  }

  private async beginDelivery(client:ClientRow,document:BillingDocument,key:string,channel:string):Promise<string|null>{
    const existing=await this.prisma.$queryRaw<Array<{id:string;status:string}>>`SELECT id,status FROM "BillingDeliveryLog" WHERE "clientId"=${client.id}::uuid AND "deliveryKey"=${key} AND channel=${channel} LIMIT 1`;
    if(existing[0]?.status==='SENT'||existing[0]?.status==='PENDING')return null;
    if(existing[0]){await this.prisma.$executeRaw`UPDATE "BillingDeliveryLog" SET status='PENDING',error=NULL,"sentAt"=CURRENT_TIMESTAMP WHERE id=${existing[0].id}::uuid`;return existing[0].id;}
    const rows=await this.prisma.$queryRaw<Array<{id:string}>>`INSERT INTO "BillingDeliveryLog" ("organizationId","clientId","billingDocumentId","deliveryKey",channel,status) VALUES (${client.organizationId}::uuid,${client.id}::uuid,${document.id}::uuid,${key},${channel},'PENDING') RETURNING id`;
    return rows[0]?.id??null;
  }
  private async finishDelivery(id:string,status:string,providerMessageId:string|null,error:string|null){await this.prisma.$executeRaw`UPDATE "BillingDeliveryLog" SET status=${status},"providerMessageId"=${providerMessageId},error=${error},"sentAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid`;}
}
