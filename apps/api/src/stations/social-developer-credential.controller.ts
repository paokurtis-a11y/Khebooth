import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SocialDeveloperCredentialService } from './social-developer-credential.service';

@UseGuards(AuthGuard('jwt'))
@Controller('settings/social-developer')
export class SocialDeveloperCredentialController{
  constructor(private readonly credentials:SocialDeveloperCredentialService){}
  @Get() list(@CurrentUser() user:AuthenticatedUser){return this.credentials.list(user);}
  @Patch(':provider') save(@CurrentUser() user:AuthenticatedUser,@Param('provider') provider:string,@Body() body:Record<string,unknown>){return this.credentials.save(user,provider,body);}
  @Delete(':provider') remove(@CurrentUser() user:AuthenticatedUser,@Param('provider') provider:string){return this.credentials.remove(user,provider);}
}
