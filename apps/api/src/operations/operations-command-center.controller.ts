import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OperationsCommandCenterService } from './operations-command-center.service';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('operations/command-center')
export class OperationsCommandCenterController{
  constructor(private readonly commandCenter:OperationsCommandCenterService){}
  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get()
  dashboard(@CurrentUser() user:AuthenticatedUser){return this.commandCenter.dashboard(user);}
}
