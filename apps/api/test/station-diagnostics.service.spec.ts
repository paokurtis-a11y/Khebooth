import { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedStation } from '../src/stations/station-auth.types';
import { StationDiagnosticsService } from '../src/stations/station-diagnostics.service';

const auditFindFirst = jest.fn();
const auditCount = jest.fn();
const auditCreate = jest.fn();
const userFindFirst = jest.fn();
const userFindMany = jest.fn();
const conversationFindFirst = jest.fn();
const conversationCreate = jest.fn();
const conversationUpdate = jest.fn();
const messageCreate = jest.fn();
const notificationCreate = jest.fn();

const prisma = {
  auditLog: { findFirst: auditFindFirst, count: auditCount, create: auditCreate },
  user: { findFirst: userFindFirst, findMany: userFindMany },
  supportConversation: { findFirst: conversationFindFirst, create: conversationCreate, update: conversationUpdate },
  supportMessage: { create: messageCreate },
  appNotification: { create: notificationCreate },
} as unknown as PrismaService;

const station: AuthenticatedStation = {
  sessionId: 'session-1',
  organizationId: 'organization-1',
  eventId: 'event-1',
  deviceId: 'device-123456789',
  mode: 'CAPTURE',
};

describe('StationDiagnosticsService', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'resend-test-key';
    process.env.KHE_EMAIL_FROM = 'KHE Support <support@khe.example>';
    process.env.KHE_DIAGNOSTIC_EMAIL = 'diagnostic@khe.example';
    auditFindFirst.mockResolvedValue(null);
    auditCount.mockResolvedValue(0);
    auditCreate.mockResolvedValue({ id: 'audit-1' });
    userFindFirst.mockResolvedValue({ id: 'owner-1' });
    userFindMany.mockResolvedValue([]);
    conversationFindFirst.mockResolvedValue(null);
    conversationCreate.mockResolvedValue({ id: 'conversation-1' });
    conversationUpdate.mockResolvedValue({ id: 'conversation-1' });
    messageCreate.mockResolvedValue({ id: 'message-1' });
    notificationCreate.mockResolvedValue({ id: 'notification-1' });
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...previousEnv };
  });

  it('creates a KHE support message, notification and filtered email for a new incident', async () => {
    const service = new StationDiagnosticsService(prisma);
    const result = await service.report(station, {
      reportId: 'report-1',
      fingerprint: 'camera-preview',
      severity: 'ERROR',
      source: 'capture.camera',
      message: 'password=hunter2 preview unavailable for owner@example.com',
      appVersion: '0.3.9',
      platform: 'android-35',
      occurredAt: '2026-09-03T10:00:00.000Z',
    });

    expect(result).toEqual({ accepted: true, deduplicated: false, rateLimited: false, conversationId: 'conversation-1', emailSent: true });
    expect(messageCreate).toHaveBeenCalledTimes(2);
    expect(messageCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ author: 'SYSTEM' }),
    }));
    expect(messageCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        author: 'KHE',
        body: expect.stringContaining('Incident détecté automatiquement par KHE Booth'),
      }),
    }));
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const emailRequest = (global.fetch as jest.Mock).mock.calls[0]?.[1] as RequestInit;
    const emailBody = String(emailRequest.body);
    expect(emailBody).not.toContain('hunter2');
    expect(emailBody).not.toContain('owner@example.com');
    expect(emailBody).toContain('conversation-1');
  });

  it('deduplicates the same fingerprint for fifteen minutes without sending another alert', async () => {
    auditFindFirst.mockResolvedValue({ id: 'audit-existing', metadata: { conversationId: 'conversation-existing' } });
    const service = new StationDiagnosticsService(prisma);

    const result = await service.report(station, {
      fingerprint: 'same-camera-error',
      source: 'capture.camera',
      message: 'preview unavailable',
      appVersion: '0.3.9',
      platform: 'android-35',
    });

    expect(result).toEqual({ accepted: true, deduplicated: true, rateLimited: false, conversationId: 'conversation-existing', emailSent: false });
    expect(messageCreate).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
