import { ClientEventWorkspaceService } from './client-event-workspace.service';

describe('ClientEventWorkspaceService design synchronization', () => {
  it('returns the exact event design to both CAPTURE and SHARING while enforcing entitlements', async () => {
    const updatedAt = new Date('2026-09-03T20:00:00.000Z');
    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{
          clientId: '00000000-0000-4000-8000-000000000010',
          subscriptionPlan: 'PRO',
          subscriptionStatus: 'ACTIVE',
          paymentStatus: 'PAID',
        }])
        .mockResolvedValueOnce([{
          eventId: '00000000-0000-4000-8000-000000000002',
          designConfig: { title: 'Design commun', showKheBranding: false },
          designReadyAt: updatedAt,
          updatedAt,
        }]),
      event: {
        findFirst: jest.fn(async () => ({ id: '00000000-0000-4000-8000-000000000002' })),
      },
    };
    const entitlements = {
      forEvent: jest.fn(async () => ({
        entitlements: { REMOVE_KHE_BRANDING: false },
      })),
    };
    const service = new ClientEventWorkspaceService(
      prisma as never,
      {} as never,
      {} as never,
      entitlements as never,
    );

    const result = await service.design({
      organizationId: '00000000-0000-4000-8000-000000000001',
      eventId: '00000000-0000-4000-8000-000000000002',
      mode: 'CAPTURE',
    } as never, '00000000-0000-4000-8000-000000000002');

    expect(result).toEqual({
      eventId: '00000000-0000-4000-8000-000000000002',
      designConfig: { title: 'Design commun', showKheBranding: true },
      designReadyAt: updatedAt,
      updatedAt,
    });
    expect(entitlements.forEvent).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    );
  });
});
