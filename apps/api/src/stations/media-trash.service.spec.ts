import { StationMode } from '@prisma/client';
import { del } from '@vercel/blob';

import { MediaTrashService } from './media-trash.service';

jest.mock('@vercel/blob', () => ({ del: jest.fn() }));

describe('MediaTrashService permanent deletion', () => {
  const station = {
    mode: StationMode.SHARING,
    organizationId: '00000000-0000-4000-8000-000000000001',
    eventId: '00000000-0000-4000-8000-000000000002',
  } as never;

  beforeEach(() => jest.clearAllMocks());

  it('deletes the Cloud blob before removing a trashed media row', async () => {
    const prisma = {
      $queryRaw: jest.fn(async () => [{
        id: '00000000-0000-4000-8000-000000000003',
        organizationId: '00000000-0000-4000-8000-000000000001',
        eventId: '00000000-0000-4000-8000-000000000002',
        mimeType: 'video/mp4',
      }]),
      $executeRaw: jest.fn(async () => 1),
    };
    const service = new MediaTrashService(prisma as never);

    await expect(service.permanentlyDelete(
      station,
      '00000000-0000-4000-8000-000000000003',
    )).resolves.toEqual({
      id: '00000000-0000-4000-8000-000000000003',
      deleted: true,
    });
    expect(del).toHaveBeenCalledWith(
      'organizations/00000000-0000-4000-8000-000000000001/events/00000000-0000-4000-8000-000000000002/media/00000000-0000-4000-8000-000000000003.mp4',
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('keeps successful batch deletions and reports individual failures', async () => {
    const service = new MediaTrashService({} as never);
    jest.spyOn(service, 'permanentlyDelete')
      .mockResolvedValueOnce({ id: '00000000-0000-4000-8000-000000000003', deleted: true })
      .mockRejectedValueOnce(new Error('storage offline'));

    const result = await service.permanentlyDeleteMany(station, [
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000004',
    ]);

    expect(result.deletedIds).toEqual(['00000000-0000-4000-8000-000000000003']);
    expect(result.failed).toEqual([{
      id: '00000000-0000-4000-8000-000000000004',
      error: 'storage offline',
    }]);
  });
});
