import { Injectable } from '@nestjs/common';
import { NotificationKind, SupportConversationStatus, SupportMessageAuthor, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';
import { normalizeStationDiagnosticReport, scrubDiagnosticText, type StationDiagnosticReport } from './station-diagnostics.sanitizer';

export interface StationDiagnosticReceipt {
  accepted: true;
  deduplicated: boolean;
  rateLimited: boolean;
  conversationId: string | null;
  emailSent: boolean;
}

const DIAGNOSTIC_ACTION = 'MOBILE_DIAGNOSTIC_RECEIVED';
const DEFAULT_DIAGNOSTIC_EMAIL = 'khebooth@gmail.com';
const DEDUPLICATION_WINDOW_MS = 15 * 60 * 1_000;
const MAX_REPORTS_PER_ORGANIZATION_PER_HOUR = 30;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

@Injectable()
export class StationDiagnosticsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(station: AuthenticatedStation, input: unknown): Promise<StationDiagnosticReceipt> {
    const report = normalizeStationDiagnosticReport(input);
    const deduplicated = await this.prisma.auditLog.findFirst({
      where: {
        organizationId: station.organizationId,
        action: DIAGNOSTIC_ACTION,
        entityType: 'MobileDiagnostic',
        entityId: report.fingerprint,
        createdAt: { gte: new Date(Date.now() - DEDUPLICATION_WINDOW_MS) },
      },
      select: { id: true, metadata: true },
    });
    if (deduplicated) {
      const metadata = deduplicated.metadata as Record<string, unknown> | null;
      return {
        accepted: true,
        deduplicated: true,
        rateLimited: false,
        conversationId: typeof metadata?.conversationId === 'string' ? metadata.conversationId : null,
        emailSent: false,
      };
    }

    const reportsLastHour = await this.prisma.auditLog.count({
      where: {
        organizationId: station.organizationId,
        action: DIAGNOSTIC_ACTION,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1_000) },
      },
    });
    if (reportsLastHour >= MAX_REPORTS_PER_ORGANIZATION_PER_HOUR) {
      return { accepted: true, deduplicated: false, rateLimited: true, conversationId: null, emailSent: false };
    }

    const requester = await this.findRequester(station.organizationId);
    let conversationId: string | null = null;
    if (requester) {
      const subject = `Diagnostic automatique · ${station.mode} · ${station.deviceId.slice(0, 8)}`;
      const existing = await this.prisma.supportConversation.findFirst({
        where: {
          organizationId: station.organizationId,
          requesterUserId: requester.id,
          subject,
          status: { not: SupportConversationStatus.RESOLVED },
        },
        orderBy: { lastMessageAt: 'desc' },
        select: { id: true },
      });
      if (existing) conversationId = existing.id;
      else {
        const created = await this.prisma.supportConversation.create({
          data: {
            organizationId: station.organizationId,
            requesterUserId: requester.id,
            subject,
            status: SupportConversationStatus.HANDOFF_REQUESTED,
          },
          select: { id: true },
        });
        conversationId = created.id;
      }
    }

    const body = this.messageBody(station, report);
    const reportedAt = new Date();
    await this.prisma.auditLog.create({
      data: {
        organizationId: station.organizationId,
        userId: null,
        action: DIAGNOSTIC_ACTION,
        entityType: 'MobileDiagnostic',
        entityId: report.fingerprint,
        metadata: {
          ...report,
          stationSessionId: station.sessionId,
          eventId: station.eventId,
          deviceId: station.deviceId,
          mode: station.mode,
          conversationId,
          reportedAt: reportedAt.toISOString(),
        },
      },
    });
    if (conversationId) {
      const chatbotAlert = this.chatbotAlertBody(station, report);
      await this.prisma.supportMessage.create({
        data: { conversationId, author: SupportMessageAuthor.SYSTEM, body },
      });
      await Promise.all([
        this.prisma.supportMessage.create({
          data: { conversationId, author: SupportMessageAuthor.KHE, body: chatbotAlert },
        }),
        this.prisma.supportConversation.update({
          where: { id: conversationId },
          data: { status: SupportConversationStatus.HANDOFF_REQUESTED, lastMessageAt: reportedAt },
        }),
        this.prisma.appNotification.create({
          data: {
            organizationId: station.organizationId,
            kind: NotificationKind.SUPPORT,
            title: `${report.severity === 'FATAL' ? 'Crash' : 'Erreur'} ${station.mode} · ${report.appVersion}`,
            body: `${report.source} — ${report.message}`.slice(0, 800),
            actionUrl: `/help?agentConversation=${conversationId}`,
          },
        }),
      ]);
    }

    const recipients = this.diagnosticRecipients();
    const emailSent = recipients.length > 0 && await this.sendEmail(recipients, station, report, body, conversationId);
    await this.prisma.auditLog.create({
      data: {
        organizationId: station.organizationId,
        userId: null,
        action: emailSent ? 'MOBILE_DIAGNOSTIC_EMAIL_SENT' : 'MOBILE_DIAGNOSTIC_EMAIL_SKIPPED',
        entityType: 'MobileDiagnostic',
        entityId: report.fingerprint,
        metadata: { reportId: report.reportId, recipientCount: recipients.length, conversationId },
      },
    });

    return { accepted: true, deduplicated: false, rateLimited: false, conversationId, emailSent };
  }

  private async findRequester(organizationId: string): Promise<{ id: string } | null> {
    for (const role of [UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR]) {
      const user = await this.prisma.user.findFirst({
        where: { organizationId, role, isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (user) return user;
    }
    return null;
  }

  private diagnosticRecipients(): string[] {
    const configured = (process.env.KHE_DIAGNOSTIC_EMAIL?.trim() || DEFAULT_DIAGNOSTIC_EMAIL)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.includes('@'));
    return [...new Set(configured)].slice(0, 5);
  }

  private messageBody(station: AuthenticatedStation, report: StationDiagnosticReport): string {
    const context = Object.entries(report.context ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join('\n') || 'Aucun contexte supplémentaire';
    return [
      `Rapport automatique ${report.severity} — ${report.reportId}`,
      `Version : ${report.appVersion} · Plateforme : ${report.platform}`,
      `Station : ${station.mode} · Appareil : ${station.deviceId.slice(0, 12)} · Événement : ${station.eventId}`,
      `Source : ${report.source}`,
      `Date : ${new Date(report.occurredAt).toISOString()}`,
      '',
      `Erreur : ${report.message}`,
      '',
      `Contexte :\n${context}`,
      '',
      `Trace filtrée :\n${report.stack || 'Non disponible'}`,
      '',
      `Empreinte : ${report.fingerprint}`,
      'Les mots de passe, jetons, clés, cookies et adresses e-mail ont été masqués automatiquement. Aucun média photo ou vidéo n’est joint.',
    ].join('\n').slice(0, 12_000);
  }

  private chatbotAlertBody(station: AuthenticatedStation, report: StationDiagnosticReport): string {
    const alert = report.severity === 'FATAL' ? '🚨 Incident critique détecté' : '⚠️ Incident détecté';
    return [
      `${alert} automatiquement par KHE Booth.`,
      `Station : ${station.mode} · Version : ${report.appVersion} · Appareil : ${station.deviceId.slice(0, 12)}`,
      `Problème : ${report.message}`,
      'Le journal technique filtré a été transmis à l’équipe KHE. Ne désinstallez pas l’application et n’effacez pas ses données : les prochaines informations apparaîtront dans cette conversation.',
    ].join('\n').slice(0, 1_500);
  }

  private async sendEmail(
    recipients: string[],
    station: AuthenticatedStation,
    report: StationDiagnosticReport,
    body: string,
    conversationId: string | null,
  ): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.KHE_EMAIL_FROM?.trim();
    if (!apiKey || !from) return false;
    const origin = (process.env.WEB_ORIGIN?.split(',')[0] ?? 'https://khebooth.vercel.app').trim().replace(/\/$/, '');
    const supportUrl = conversationId ? `${origin}/help?agentConversation=${encodeURIComponent(conversationId)}` : origin;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: recipients,
          subject: `[KHE Diagnostic] ${report.severity} ${station.mode} · v${report.appVersion}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:760px;margin:auto"><h2 style="color:#b58a27">KHE BOOTH · Diagnostic automatique</h2><pre style="white-space:pre-wrap;background:#111;color:#f3f3f3;padding:18px;border-radius:12px">${escapeHtml(scrubDiagnosticText(body, 12_000))}</pre><p><a href="${escapeHtml(supportUrl)}">Ouvrir le dossier dans KHE Booth</a></p><p style="font-size:12px;color:#666">Rapport technique filtré. Aucun mot de passe, jeton ou média n’est transmis.</p></div>`,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
