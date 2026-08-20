import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ShiftHandoverService } from './shift-handover.service';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('operations/workforce/handover')
export class ShiftHandoverController{
  constructor(private readonly handover:ShiftHandoverService){}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Get('me') mine(@CurrentUser() user:AuthenticatedUser){return this.handover.mine(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Patch('items/:id/note') updateNote(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.handover.updateNote(user,id,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('team') team(@CurrentUser() user:AuthenticatedUser){return this.handover.team(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('items/:id/candidates') candidates(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.handover.candidates(user,id);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('items/:id/apply') applyItem(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.handover.applyItem(user,id,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('items/:id/skip') skipItem(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.handover.skipItem(user,id,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('batches/:id/refresh') refreshBatch(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.handover.refreshBatch(user,id);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('batches/:id/apply-safe') applySafe(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.handover.applySafe(user,id);}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Post('pulse') pulse(@CurrentUser() user:AuthenticatedUser){return this.handover.pulse(user);}
}
