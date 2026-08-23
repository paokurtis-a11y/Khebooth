import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OperationsService, type GeoContext } from './operations.service';

function decoded(value:string|undefined){if(!value)return null;try{return decodeURIComponent(value).slice(0,160);}catch{return value.slice(0,160);}}
function geo(request:Request):GeoContext{
  const latitude=Number(request.headers['x-vercel-ip-latitude']);const longitude=Number(request.headers['x-vercel-ip-longitude']);
  return{
    countryCode:decoded(request.headers['x-vercel-ip-country'] as string|undefined),
    regionCode:decoded(request.headers['x-vercel-ip-country-region'] as string|undefined),
    municipality:decoded(request.headers['x-vercel-ip-city'] as string|undefined),
    latitude:Number.isFinite(latitude)?latitude:null,
    longitude:Number.isFinite(longitude)?longitude:null,
    timezone:decoded(request.headers['x-vercel-ip-timezone'] as string|undefined),
  };
}

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('operations')
export class OperationsController{
  constructor(private readonly operations:OperationsService){}

  @Get('presence/me') presence(@CurrentUser() user:AuthenticatedUser){return this.operations.presenceMe(user);}

  @Get('geo/me') currentGeo(@CurrentUser() user:AuthenticatedUser,@Req() request:Request){
    const current=geo(request);
    return{
      isOwner:user.role===UserRole.OWNER,
      countryCode:current.countryCode?.toUpperCase()??null,
    };
  }

  @Post('presence/heartbeat') heartbeat(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>,@Req() request:Request,@Headers('user-agent') userAgent?:string){
    return this.operations.heartbeat(user,body,geo(request),userAgent??null);
  }

  @Post('presence/availability') availability(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>,@Req() request:Request){
    return this.operations.setAvailability(user,body,geo(request));
  }

  @Post('session/end') end(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.operations.endSession(user,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('agents') agents(@CurrentUser() user:AuthenticatedUser){return this.operations.listAgents(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('agents/:id/history') agentHistory(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.operations.agentHistory(user,id);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('clients') clients(@CurrentUser() user:AuthenticatedUser){return this.operations.clientsOverview(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('visitors') visitors(@CurrentUser() user:AuthenticatedUser){return this.operations.visitorsOverview(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('strategy') strategy(@CurrentUser() user:AuthenticatedUser){return this.operations.getStrategy(user.organizationId);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('strategy') updateStrategy(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.operations.updateStrategy(user.organizationId,body);}
}
