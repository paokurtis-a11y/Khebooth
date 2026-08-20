import { NotFoundException } from '@nestjs/common';
import { NotificationKind, SupportConversationStatus, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { SupportService } from '../src/support/support.service';

describe('SupportService', () => {
  const user: AuthenticatedUser = {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'user@khe.test',
    role: UserRole.SHARE_HOST,
  };

  const agent: AuthenticatedUser = {
    id: '99999999-9999-9999-9999-999999999999',
    organizationId: user.organizationId,
    email: 'agent@khe.test',
    role: UserRole.OPERATOR,
  };

  const prisma = {
    user: { findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    appNotification: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    notificationRead: { upsert: jest.fn() },
    supportConversation: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    supportMessage: { create: jest.fn() },
    supportTask: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const service = new SupportService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('hands an unknown question to a human agent instead of inventing an answer', async () => {
    const created = { id: '22222222-2222-2222-2222-222222222222' };
    jest.spyOn(prisma.supportConversation, 'create').mockResolvedValue(created as never);

    await service.createConversation(user, 'Pourquoi mon accessoire externe très spécifique ne fonctionne-t-il pas ?');

    expect(prisma.supportConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: user.organizationId,
          requesterUserId: user.id,
          status: SupportConversationStatus.HANDOFF_REQUESTED,
          messages: {
            create: expect.arrayContaining([
              expect.objectContaining({ author: 'USER' }),
              expect.objectContaining({
                author: 'KHE',
                body: expect.stringContaining('pas encore une réponse assez fiable'),
              }),
            ]),
          },
        }),
      }),
    );
    expect(prisma.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: NotificationKind.SUPPORT,
          actionUrl: `/help?agentConversation=${created.id}`,
        }),
      }),
    );
  });

  it('does not duplicate a handoff request that is already waiting for an agent', async () => {
    const conversation = {
      id: '22222222-2222-2222-2222-222222222222',
      requesterUserId: user.id,
      status: SupportConversationStatus.HANDOFF_REQUESTED,
      subject: 'Besoin support',
      messages: [],
      tasks: [],
    };
    jest.spyOn(prisma.supportConversation, 'findFirst').mockResolvedValue(conversation as never);

    const result = await service.requestAgent(user, conversation.id);

    expect(result).toBe(conversation);
    expect(prisma.supportMessage.create).not.toHaveBeenCalled();
    expect(prisma.supportConversation.update).not.toHaveBeenCalled();
    expect(prisma.appNotification.create).not.toHaveBeenCalled();
  });

  it('shows agent-targeted handoff notifications only to support agents with inbox access', async () => {
    jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({
      notificationsEnabled: true,
      productUpdatesEnabled: true,
      supportNotificationsEnabled: true,
    } as never);
    jest.spyOn(prisma.supportConversation, 'findMany')
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ id: '44444444-4444-4444-4444-444444444444' }] as never);
    jest.spyOn(prisma.appNotification, 'findMany').mockResolvedValue([
      {
        id: '33333333-3333-3333-3333-333333333333',
        kind: NotificationKind.SUPPORT,
        actionUrl: '/help?agentConversation=44444444-4444-4444-4444-444444444444',
        reads: [],
      },
    ] as never);

    const result = await service.getNotifications(agent);

    expect(result.unreadCount).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it('does not allow a user to mark another user private support notification as read', async () => {
    jest.spyOn(prisma.appNotification, 'findFirst').mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      kind: NotificationKind.SUPPORT,
      actionUrl: '/help?conversation=44444444-4444-4444-4444-444444444444',
    } as never);
    jest.spyOn(prisma.supportConversation, 'findMany').mockResolvedValue([] as never);

    await expect(
      service.markNotificationRead(user, '33333333-3333-3333-3333-333333333333'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.notificationRead.upsert).not.toHaveBeenCalled();
  });
});
