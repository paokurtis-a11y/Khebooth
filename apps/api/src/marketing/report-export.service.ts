import { BadRequestException, Injectable } from '@nestjs/common';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import sharp from 'sharp';
import { MarketingService } from './marketing.service';

export type MarketingReportFormat='pdf'|'jpeg'|'docx'|'xlsx';

type Dashboard=Awaited<ReturnType<MarketingService['dashboard']>>;
type ExcelJsModule=typeof import('@excel.js/exceljs');
const nativeImport=new Function('specifier','return import(specifier)') as (specifier:string)=>Promise<ExcelJsModule>;

@Injectable()
export class ReportExportService{
  constructor(private readonly marketing:MarketingService){}

  private safeDays(days:number){return Math.min(365,Math.max(7,Math.trunc(days)||30));}
  private fileBase(days:number){return `khe-booth-rapport-${this.safeDays(days)}j-${new Date().toISOString().slice(0,10)}`;}
  private money(cents:number){return `CHF ${(cents/100).toFixed(2)}`;}
  private escapeXml(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}

  async generate(organizationId:string,format:string,days=30){
    const normalized=format.toLowerCase() as MarketingReportFormat;
    if(!['pdf','jpeg','docx','xlsx'].includes(normalized))throw new BadRequestException('Format de rapport non supporté.');
    const report=await this.marketing.dashboard(organizationId,this.safeDays(days));
    if(normalized==='pdf')return{buffer:await this.marketing.reportPdf(organizationId,days),contentType:'application/pdf',filename:`${this.fileBase(days)}.pdf`};
    if(normalized==='jpeg')return{buffer:await this.jpeg(report),contentType:'image/jpeg',filename:`${this.fileBase(days)}.jpg`};
    if(normalized==='docx')return{buffer:await this.docx(report),contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',filename:`${this.fileBase(days)}.docx`};
    return{buffer:await this.xlsx(report),contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename:`${this.fileBase(days)}.xlsx`};
  }

  private async jpeg(report:Dashboard):Promise<Buffer>{
    const {summary}=report;
    const cards=[
      ['Visites',String(summary.visits)],['Choix d’offre',String(summary.planSelections)],['Checkouts',String(summary.checkoutStarts)],
      ['Paiements',String(summary.payments)],['Conversion',`${summary.conversionPercent}%`],['Revenus',this.money(summary.revenueCents)],['Téléchargements',String(summary.downloads)],
    ];
    const cardSvg=cards.map(([label,value],index)=>{const col=index%4,row=Math.floor(index/4);const x=100+col*360,y=310+row*180;return `<g><rect x="${x}" y="${y}" rx="26" width="320" height="140" fill="#171a1f" stroke="#40361e" stroke-width="2"/><text x="${x+24}" y="${y+42}" font-size="24" fill="#b7bdc8" font-weight="700">${this.escapeXml(label)}</text><text x="${x+24}" y="${y+96}" font-size="38" fill="#e7c767" font-weight="900">${this.escapeXml(value)}</text></g>`;}).join('');
    const max=Math.max(1,...report.daily.map((day)=>day.payments));
    const bars=report.daily.slice(-30).map((day,index)=>{const available=1320;const barWidth=Math.max(8,available/Math.max(1,Math.min(30,report.daily.length))-8);const height=Math.max(2,(day.payments/max)*185);const x=130+index*(available/Math.max(1,Math.min(30,report.daily.length)));const y=870-height;return `<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="4" fill="#b31520" opacity=".9"/>`;}).join('');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#090a0c"/><stop offset=".6" stop-color="#12151a"/><stop offset="1" stop-color="#21190b"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#bg)"/><text x="100" y="105" font-size="28" fill="#d2ad4f" font-weight="900" letter-spacing="5">KHE BOOTH</text><text x="100" y="178" font-size="54" fill="#ffffff" font-weight="900">Rapport Marketing &amp; Analytics</text><text x="100" y="225" font-size="24" fill="#aeb4bd">Période analysée : ${report.days} jours • Généré le ${new Date().toLocaleDateString('fr-CH')}</text>${cardSvg}<text x="100" y="670" font-size="30" fill="#ffffff" font-weight="800">Paiements quotidiens</text><line x1="110" y1="870" x2="1490" y2="870" stroke="#414751" stroke-width="2"/>${bars}<text x="100" y="955" font-size="20" fill="#8e949c">Kurtis Hypnotic Events • KHE Booth • Rapport confidentiel</text></svg>`;
    return sharp(Buffer.from(svg)).jpeg({quality:92,mozjpeg:true}).toBuffer();
  }

  private async docx(report:Dashboard):Promise<Buffer>{
    const summaryRows=[
      ['Visites',report.summary.visits],['Choix d’offre',report.summary.planSelections],['Checkouts',report.summary.checkoutStarts],['Paiements',report.summary.payments],
      ['Conversion',`${report.summary.conversionPercent}%`],['Revenus',this.money(report.summary.revenueCents)],['Téléchargements',report.summary.downloads],
    ];
    const table=(rows:Array<Array<string|number>>)=>new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:rows.map((row)=>new TableRow({children:row.map((cell)=>new TableCell({children:[new Paragraph({children:[new TextRun(String(cell))]})]}))}))});
    const sections=[
      new Paragraph({text:'KHE BOOTH',heading:HeadingLevel.TITLE,alignment:AlignmentType.CENTER}),
      new Paragraph({text:'Rapport Marketing & Analytics',heading:HeadingLevel.HEADING_1,alignment:AlignmentType.CENTER}),
      new Paragraph({text:`Période : ${report.days} jours • Généré le ${new Date().toLocaleString('fr-CH')}`,alignment:AlignmentType.CENTER}),
      new Paragraph({text:'Synthèse',heading:HeadingLevel.HEADING_2}),
      table([['Indicateur','Valeur'],...summaryRows]),
      new Paragraph({text:'Performance par offre',heading:HeadingLevel.HEADING_2}),
      table([['Offre','Choix','Checkouts','Paiements','Revenus'],...report.planPerformance.map((item)=>[item.planCode||'—',item.selections,item.checkouts,item.payments,this.money(item.revenueCents)])]),
      new Paragraph({text:'Détail quotidien',heading:HeadingLevel.HEADING_2}),
      table([['Date','Visites','Checkouts','Paiements','Revenus'],...report.daily.map((day)=>[new Date(day.day).toLocaleDateString('fr-CH'),day.visits,day.checkouts,day.payments,this.money(day.revenueCents)])]),
      new Paragraph({text:'Kurtis Hypnotic Events • KHE Booth • Document confidentiel',alignment:AlignmentType.CENTER}),
    ];
    const document=new Document({sections:[{children:sections}]});
    return Buffer.from(await Packer.toBuffer(document));
  }

  private async xlsx(report:Dashboard):Promise<Buffer>{
    const module=await nativeImport('@excel.js/exceljs');
    const ExcelJS=module.default;
    const workbook=new ExcelJS.Workbook();
    workbook.creator='KHE Booth';workbook.company='Kurtis Hypnotic Events';workbook.created=new Date();
    const summary=workbook.addWorksheet('Synthèse',{views:[{state:'frozen',ySplit:1}]});
    summary.columns=[{header:'Indicateur',key:'label',width:28},{header:'Valeur',key:'value',width:24}];
    [
      ['Période',`${report.days} jours`],['Visites',report.summary.visits],['Choix d’offre',report.summary.planSelections],['Checkouts',report.summary.checkoutStarts],['Paiements',report.summary.payments],['Conversion',`${report.summary.conversionPercent}%`],['Revenus',this.money(report.summary.revenueCents)],['Téléchargements',report.summary.downloads],
    ].forEach(([label,value])=>summary.addRow({label,value}));
    summary.getRow(1).font={bold:true};summary.getRow(1).alignment={vertical:'middle'};summary.autoFilter='A1:B1';

    const daily=workbook.addWorksheet('Quotidien',{views:[{state:'frozen',ySplit:1}]});
    daily.columns=[{header:'Date',key:'day',width:16},{header:'Visites',key:'visits',width:14},{header:'Checkouts',key:'checkouts',width:14},{header:'Paiements',key:'payments',width:14},{header:'Revenus CHF',key:'revenue',width:18}];
    report.daily.forEach((item)=>daily.addRow({day:new Date(item.day),visits:item.visits,checkouts:item.checkouts,payments:item.payments,revenue:item.revenueCents/100}));
    daily.getColumn('day').numFmt='dd.mm.yyyy';daily.getColumn('revenue').numFmt='#,##0.00 "CHF"';daily.getRow(1).font={bold:true};daily.autoFilter='A1:E1';

    const offers=workbook.addWorksheet('Offres',{views:[{state:'frozen',ySplit:1}]});
    offers.columns=[{header:'Offre',key:'plan',width:18},{header:'Choix',key:'selections',width:14},{header:'Checkouts',key:'checkouts',width:14},{header:'Paiements',key:'payments',width:14},{header:'Revenus CHF',key:'revenue',width:18}];
    report.planPerformance.forEach((item)=>offers.addRow({plan:item.planCode||'—',selections:item.selections,checkouts:item.checkouts,payments:item.payments,revenue:item.revenueCents/100}));
    offers.getColumn('revenue').numFmt='#,##0.00 "CHF"';offers.getRow(1).font={bold:true};offers.autoFilter='A1:E1';

    const buffer=await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
