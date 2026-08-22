import { StationMode } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { MediaSharingService } from '../src/stations/media-sharing.service';

const MEDIA_ID='11111111-1111-1111-1111-111111111111';
const ORGANIZATION_ID='22222222-2222-2222-2222-222222222222';
const EVENT_ID='33333333-3333-3333-3333-333333333333';
const SHARE_ID='44444444-4444-4444-4444-444444444444';

const queryRaw=jest.fn();
const txQueryRaw=jest.fn();
const txExecuteRaw=jest.fn();
const transaction=jest.fn(async(callback:(tx:{ $queryRaw:typeof txQueryRaw;$executeRaw:typeof txExecuteRaw })=>unknown)=>callback({$queryRaw:txQueryRaw,$executeRaw:txExecuteRaw}));
const prisma={
  $queryRaw:queryRaw,
  $transaction:transaction,
} as unknown as PrismaService;

const service=new MediaSharingService(prisma);
const station={
  sessionId:'55555555-5555-5555-5555-555555555555',
  organizationId:ORGANIZATION_ID,
  eventId:EVENT_ID,
  deviceId:'66666666-6666-6666-6666-666666666666',
  mode:StationMode.SHARING,
} as const;

function tokenFor(id:string){return (service as unknown as {tokenForShare:(shareId:string)=>string}).tokenForShare(id);}
function hashToken(token:string){return (service as unknown as {hashToken:(value:string)=>string}).hashToken(token);}

describe('MediaSharingService stable guest QR',()=>{
  beforeEach(()=>{
    jest.clearAllMocks();
    process.env.JWT_SECRET='khe-test-secret-that-is-long-enough-for-media-sharing';
    delete process.env.MEDIA_SHARE_SIGNING_SECRET;
  });

  it('derives the same 256-bit URL-safe token for the same share id',()=>{
    const first=tokenFor(SHARE_ID);
    const second=tokenFor(SHARE_ID);
    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenFor('77777777-7777-7777-7777-777777777777')).not.toBe(first);
  });

  it('changes the derived token when the signing secret is intentionally rotated',()=>{
    const before=tokenFor(SHARE_ID);
    process.env.MEDIA_SHARE_SIGNING_SECRET='another-khe-media-share-secret-long-enough-for-tests';
    const after=tokenFor(SHARE_ID);
    expect(after).not.toBe(before);
  });

  it('returns the existing active v2 share instead of creating a new QR',async()=>{
    const token=tokenFor(SHARE_ID);
    const createdAt=new Date('2026-08-22T04:00:00.000Z');
    queryRaw.mockResolvedValueOnce([{id:MEDIA_ID,syncState:'SYNCED',acknowledgedAt:new Date(),displayName:'KHE Moment'}]);
    txQueryRaw.mockResolvedValueOnce([{id:SHARE_ID,tokenHash:hashToken(token),tokenVersion:2,createdAt}]);

    const result=await service.createShare(station,MEDIA_ID);

    expect(result).toEqual(expect.objectContaining({
      id:SHARE_ID,
      mediaId:MEDIA_ID,
      shareUrl:`https://khebooth-rdvo.vercel.app/m/${token}`,
      createdAt,
      reused:true,
    }));
    expect(txExecuteRaw).not.toHaveBeenCalled();
    expect(txQueryRaw).toHaveBeenCalledTimes(1);
  });
});
