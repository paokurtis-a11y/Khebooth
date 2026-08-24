import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../src/auth/auth.types';
import { extractResponseText, HypnoticConceptionService } from '../src/hypnotic-conception/hypnotic-conception.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { SecurityCenterService } from '../src/security/security-center.service';

const rootOwner: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  organizationId: '00000000-0000-4000-8000-000000000002',
  email: 'owner@example.test',
  role: UserRole.OWNER,
};

describe('HypnoticConceptionService', () => {
  it('extracts every native Responses API text item safely', () => {
    expect(extractResponseText({ output: [
      { type: 'reasoning', content: [] },
      { type: 'message', content: [{ type: 'output_text', text: 'Bonjour' }, { type: 'output_text', text: 'KHE' }] },
    ] })).toBe('Bonjour\nKHE');
    expect(extractResponseText({ output: [{ content: [{ type: 'refusal', text: 'ignored' }] }] })).toBe('');
  });

  const prisma = { $queryRaw: jest.fn() } as unknown as PrismaService;
  const security = { status: jest.fn() } as unknown as SecurityCenterService;
  const service = new HypnoticConceptionService(prisma, security);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_HYPNOTIC_MODEL;
  });

  it('refuses an owner outside the KHE root tenant', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ tenantKind: 'ENTERPRISE_CLIENT' }]);
    await expect(service.status(rootOwner)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a restricted execution policy to the root owner', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ tenantKind: 'KHE_ROOT' }]);
    (security.status as jest.Mock).mockResolvedValue({ overall: 'HEALTHY', surfaces: [] });
    await expect(service.status(rootOwner)).resolves.toMatchObject({
      name: 'Hypnotic Conception', access: 'ROOT_OWNER_ONLY', executionPolicy: 'OWNER_APPROVAL_REQUIRED',
    });
  });

  it('fails closed when the server-side OpenAI configuration is absent', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ tenantKind: 'KHE_ROOT' }]);
    await expect(service.chat(rootOwner, 'État de la plateforme ?')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
