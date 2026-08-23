import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { GlobeIntelligenceService } from './globe-intelligence.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('operations/globe')
export class GlobeIntelligenceController {
  constructor(private readonly globe: GlobeIntelligenceService) {}

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.globe.overview(user);
  }
}
