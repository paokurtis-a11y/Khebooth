import { Controller, Get, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok'; database: 'ok' }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'ok' };
  }

  // Temporary preview-only diagnostic. Never exposes the OIDC token itself.
  @Get('vercel-oidc-probe-8d2f6e1c')
  async vercelOidcProbe() {
    if (process.env.VERCEL_ENV === 'production') throw new NotFoundException();
    const token = process.env.VERCEL_OIDC_TOKEN?.trim();
    if (!token) return { oidcPresent: false, managementStatus: null };

    const response = await fetch(
      'https://api.vercel.com/v9/projects/prj_JPOuwZN7jdjKckRvMt43fr0F2vcl?teamId=team_46YGpJ5ftgDtha3NfX3AISSD',
      { headers: { authorization: `Bearer ${token}` } },
    );

    return {
      oidcPresent: true,
      managementStatus: response.status,
      managementOk: response.ok,
    };
  }
}
