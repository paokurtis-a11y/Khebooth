import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { HypnoticConceptionService } from './hypnotic-conception.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.OWNER)
@Controller('hypnotic-conception')
export class HypnoticConceptionController {
  constructor(private readonly hypnotic: HypnoticConceptionService) {}

  @Get('status') status(@CurrentUser() user: AuthenticatedUser) {
    return this.hypnotic.status(user);
  }

  @Get('messages') messages(@CurrentUser() user: AuthenticatedUser) {
    return this.hypnotic.messages(user);
  }

  @Post('chat') chat(@CurrentUser() user: AuthenticatedUser, @Body() body: { message?: unknown }) {
    return this.hypnotic.chat(user, body.message);
  }
}
