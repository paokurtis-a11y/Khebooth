import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { WorkforceScheduleOptimizerService } from './workforce-schedule-optimizer.service';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Roles(UserRole.OWNER,UserRole.ADMIN)
@Controller('operations/workforce/optimizer')
export class WorkforceScheduleOptimizerController{
  constructor(private readonly optimizer:WorkforceScheduleOptimizerService){}

  @Get('proposals') list(@CurrentUser() user:AuthenticatedUser){return this.optimizer.list(user);}
  @Get('proposals/:id') proposal(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.optimizer.proposal(user,id);}
  @Post('proposals') generate(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.optimizer.generate(user,body);}
  @Patch('proposals/:proposalId/shifts/:shiftId') updateShift(@CurrentUser() user:AuthenticatedUser,@Param('proposalId',new ParseUUIDPipe()) proposalId:string,@Param('shiftId',new ParseUUIDPipe()) shiftId:string,@Body() body:Record<string,unknown>){return this.optimizer.updateShift(user,proposalId,shiftId,body);}
  @Post('proposals/:id/approve') approve(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.optimizer.approve(user,id);}
  @Post('proposals/:id/reopen') reopen(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.optimizer.reopen(user,id);}
  @Post('proposals/:id/apply') apply(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.optimizer.apply(user,id);}
  @Post('proposals/:id/reject') reject(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.optimizer.reject(user,id);}
}
