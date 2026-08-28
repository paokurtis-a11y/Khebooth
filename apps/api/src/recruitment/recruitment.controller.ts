import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AgentContractExportService } from './agent-contract-export.service';
import { RecruitmentService } from './recruitment.service';

@Controller('agent-recruitment')
export class RecruitmentController {
  constructor(private readonly recruitment:RecruitmentService,private readonly exports:AgentContractExportService){}

  @Post('public/applications') submit(@Body() body:Record<string,unknown>){return this.recruitment.submit(body);}
  @Get('public/applications/:token') publicContext(@Param('token') token:string){return this.recruitment.publicContext(token);}
  @Post('public/applications/:token/documents/upload') prepareDocument(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.recruitment.prepareDocument(token,body);}
  @Post('public/applications/:token/documents/confirm') confirmDocument(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.recruitment.confirmDocument(token,body);}
  @Post('public/applications/:token/contract/sign') sign(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.recruitment.signContract(token,body);}
  @Get('public/applications/:token/contract/export/:format') async publicExport(@Param('token') token:string,@Param('format') format:string,@Res() response:Response){const file=await this.exports.publicExport(token,format);this.send(response,file);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('applications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('applications') list(@CurrentUser() user:AuthenticatedUser,@Query('status') status?:string,@Query('search') search?:string){return this.recruitment.list(user,status,search);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('applications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('applications/:id') context(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.recruitment.staffContext(user,id);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('applications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('applications/:id/review') review(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.recruitment.updateReview(user,id,body);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('applications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('applications/:applicationId/documents/:documentId') reviewDocument(@CurrentUser() user:AuthenticatedUser,@Param('applicationId',new ParseUUIDPipe()) applicationId:string,@Param('documentId',new ParseUUIDPipe()) documentId:string,@Body() body:Record<string,unknown>){return this.recruitment.reviewDocument(user,applicationId,documentId,body);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('applications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('applications/:applicationId/documents/:documentId/download') async documentTicket(@CurrentUser() user:AuthenticatedUser,@Param('applicationId',new ParseUUIDPipe()) applicationId:string,@Param('documentId',new ParseUUIDPipe()) documentId:string){return this.recruitment.documentTicket(user,applicationId,documentId);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('applications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('applications/:id/decision') decide(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.recruitment.decide(user,id,body);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('applications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('applications/:id/legal-review') confirmLegalReview(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.recruitment.confirmLegalReview(user,id,body);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('applications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('applications/:id/activate') activate(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.recruitment.activate(user,id);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('applications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('applications/:id/contract/export/:format') async staffExport(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Param('format') format:string,@Res() response:Response){const file=await this.exports.staffExport(user.organizationId,id,format);this.send(response,file);}

  private send(response:Response,file:{buffer:Buffer;contentType:string;filename:string}){response.setHeader('Content-Type',file.contentType);response.setHeader('Content-Disposition',`attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g,'-')}"`);response.setHeader('Cache-Control','private, no-store');response.send(file.buffer);}
}
