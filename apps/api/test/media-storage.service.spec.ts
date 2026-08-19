import { StationMode } from '@prisma/client';
import { head, issueSignedToken, presignUrl } from '@vercel/blob';
import { PrismaService } from '../src/prisma/prisma.service';
import { MediaStorageService } from '../src/stations/media-storage.service';

jest.mock('@vercel/blob', () => ({
  head: jest.fn(),
  issueSignedToken: jest.fn(),
  presignUrl: jest.fn(),
}));

const mockedHead = head as jest.MockedFunction<typeof head>;
const mockedIssueSignedToken = issueSignedToken as jest.MockedFunction<typeof issueSignedToken>;
const mockedPresignUrl = presignUrl as jest.MockedFunction<typeof presignUrl>;

const media = {
  id: '11111111-1111-1111-1111-111111111111',
  organizationId: '22222222-2222-2222-2222-222222222222',
  eventId: '33333333-3333-3333-3333-333333333333',
  createdBySessionId: '44444444-4444-4444-4444-444444444444',
  byteSize: 1024,
  mimeType: 'image/jpeg',
};

const findFirst = jest.fn();
const upsert = jest.fn();
const prisma = {
  mediaAsset: { findFirst },
  uploadSession: { upsert },
} as unknown as PrismaService;

const service = new MediaStorageService(prisma);
const station = {
  sessionId: media.createdBySessionId,
  organizationId: media.organizationId,
  eventId: media.eventId,
  deviceId: '55555555-5555-5555-5555-555555555555',
  mode: StationMode.CAPTURE,
} as const;

describe('MediaStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findFirst.mockResolvedValue(media);
    upsert.mockResolvedValue({});
    mockedHead.mockRejectedValue(new Error('not found'));
    mockedIssueSignedToken.mockResolvedValue({
      delegationToken: 'delegation',
      clientSigningToken: 'signing',
      validUntil: Date.now() + 60_000,
    });
    mockedPresignUrl.mockResolvedValue({ presignedUrl: 'https://blob.example/upload' });
  });

  it('presigns media PUT without a random suffix so finalize HEAD checks the same pathname', async () => {
    const ticket = await service.prepareUpload(station, media.id);

    expect(ticket.pathname).toBe(
      `organizations/${media.organizationId}/events/${media.eventId}/media/${media.id}.jpg`,
    );
    expect(mockedPresignUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: 'put',
        pathname: ticket.pathname,
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
    );
  });
});
