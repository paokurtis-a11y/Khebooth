import { Injectable } from '@nestjs/common';
import { MediaSyncState, StationMode, SupportMessageAuthor } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { kheSupportAnswer, type SupportLanguage } from './khe-support-language';

@Injectable()
export class KheSupportContextService {
  constructor(private readonly prisma: PrismaService) {}

  async enrich<T>(user: AuthenticatedUser, conversation: T, conversationId: string, question: string): Promise<T> {
    const { language } = kheSupportAnswer(question);
    const context = await this.contextText(user, language);
    if (!context) return conversation;
    const latest = await this.prisma.supportMessage.findFirst({
      where: { conversationId, author: SupportMessageAuthor.KHE },
      orderBy: { createdAt: 'desc' },
      select: { id: true, body: true },
    });
    if (!latest || latest.body.includes('KHE CONTEXT')) return conversation;
    const body = `${latest.body}\n\n${context}`;
    await this.prisma.supportMessage.update({ where: { id: latest.id }, data: { body } });
    this.patchConversation(conversation, latest.id, body);
    return conversation;
  }

  private patchConversation(value: unknown, messageId: string, body: string) {
    if (!value || typeof value !== 'object') return;
    const messages = (value as { messages?: Array<{ id?: string; body?: string }> }).messages;
    if (!Array.isArray(messages)) return;
    const item = messages.find((message) => message.id === messageId);
    if (item) item.body = body;
  }

  private async contextText(user: AuthenticatedUser, language: SupportLanguage) {
    const now = new Date();
    const event = await this.prisma.event.findFirst({
      where: { organizationId: user.organizationId, startsAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) }, status: { not: 'ARCHIVED' } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, name: true, startsAt: true, status: true },
    });
    if (!event) return this.copy(language, { role: user.role, event: null, capture: 'UNKNOWN', sharing: 'UNKNOWN', pending: 0, failed: 0 });
    const [sessions, queued, uploading, failed] = await Promise.all([
      this.prisma.stationSession.findMany({ where: { organizationId: user.organizationId, eventId: event.id, revokedAt: null, expiresAt: { gt: now } }, select: { mode: true, lastSeenAt: true } }),
      this.prisma.mediaAsset.count({ where: { organizationId: user.organizationId, eventId: event.id, syncState: MediaSyncState.QUEUED } }),
      this.prisma.mediaAsset.count({ where: { organizationId: user.organizationId, eventId: event.id, syncState: MediaSyncState.UPLOADING } }),
      this.prisma.mediaAsset.count({ where: { organizationId: user.organizationId, eventId: event.id, syncState: MediaSyncState.FAILED } }),
    ]);
    const state=(mode:StationMode)=>{const session=sessions.find(item=>item.mode===mode);if(!session)return'MISSING';const age=now.getTime()-session.lastSeenAt.getTime();return age<=30_000?'ONLINE':age<=180_000?'QUIET':'STALE';};
    return this.copy(language,{role:user.role,event:{name:event.name,startsAt:event.startsAt},capture:state(StationMode.CAPTURE),sharing:state(StationMode.SHARING),pending:queued+uploading+failed,failed});
  }

  private copy(language:SupportLanguage,data:{role:string;event:{name:string;startsAt:Date}|null;capture:string;sharing:string;pending:number;failed:number}) {
    const date = data.event ? new Intl.DateTimeFormat(language === 'fr' ? 'fr-CH' : language, { dateStyle: 'medium', timeStyle: 'short' }).format(data.event.startsAt) : '';
    const station=(value:string)=>value==='ONLINE'?'online':value==='QUIET'?'quiet':value==='STALE'?'stale':value==='MISSING'?'missing':'unknown';
    const lines:Record<SupportLanguage,string>={
      fr:data.event?`KHE CONTEXT — Contexte réel : prochain événement « ${data.event.name} » le ${date}. CAPTURE : ${station(data.capture)}. SHARING : ${station(data.sharing)}. Synchronisation : ${data.pending} en attente, ${data.failed} en échec. Votre rôle : ${data.role}.`:`KHE CONTEXT — Aucun événement à venir n’est actuellement détecté pour votre organisation. Votre rôle : ${data.role}.`,
      en:data.event?`KHE CONTEXT — Live context: next event “${data.event.name}” on ${date}. CAPTURE: ${station(data.capture)}. SHARING: ${station(data.sharing)}. Sync: ${data.pending} pending, ${data.failed} failed. Your role: ${data.role}.`:`KHE CONTEXT — No upcoming event is currently detected for your organization. Your role: ${data.role}.`,
      de:data.event?`KHE CONTEXT — Realkontext: nächstes Event „${data.event.name}“ am ${date}. CAPTURE: ${station(data.capture)}. SHARING: ${station(data.sharing)}. Synchronisierung: ${data.pending} ausstehend, ${data.failed} fehlgeschlagen. Rolle: ${data.role}.`:`KHE CONTEXT — Derzeit wurde kein bevorstehendes Event erkannt. Rolle: ${data.role}.`,
      it:data.event?`KHE CONTEXT — Contesto reale: prossimo evento “${data.event.name}” il ${date}. CAPTURE: ${station(data.capture)}. SHARING: ${station(data.sharing)}. Sincronizzazione: ${data.pending} in attesa, ${data.failed} in errore. Ruolo: ${data.role}.`:`KHE CONTEXT — Al momento non è rilevato alcun evento imminente. Ruolo: ${data.role}.`,
      es:data.event?`KHE CONTEXT — Contexto real: próximo evento “${data.event.name}” el ${date}. CAPTURE: ${station(data.capture)}. SHARING: ${station(data.sharing)}. Sincronización: ${data.pending} pendientes, ${data.failed} con error. Rol: ${data.role}.`:`KHE CONTEXT — No se detecta ningún próximo evento para tu organización. Rol: ${data.role}.`,
      pt:data.event?`KHE CONTEXT — Contexto real: próximo evento “${data.event.name}” em ${date}. CAPTURE: ${station(data.capture)}. SHARING: ${station(data.sharing)}. Sincronização: ${data.pending} pendentes, ${data.failed} com erro. Função: ${data.role}.`:`KHE CONTEXT — Não existe atualmente nenhum próximo evento detetado. Função: ${data.role}.`,
    };
    return lines[language];
  }
}
