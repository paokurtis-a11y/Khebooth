import { Body, Controller, Get, Headers, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilePhotoService } from './profile-photo.service';

interface AuthRequest extends Request { user: AuthenticatedUser; }

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly photos: ProfilePhotoService) {}

  @Post('login') login(@Body() dto: LoginDto,@Req() request:Request,@Headers('user-agent') userAgent?:string) {
    return this.authService.login(dto,{ipAddress:request.ip,userAgent:userAgent??null});
  }

  @Get('username-availability') usernameAvailability(@Query('username') username='') {
    return this.authService.usernameAvailability(username);
  }

  @Post('password-reset/request') requestReset(@Body() body:Record<string,unknown>,@Req() request:Request,@Headers('user-agent') userAgent?:string){
    return this.authService.requestPasswordReset(String(body.email??''),{ipAddress:request.ip,userAgent:userAgent??null});
  }

  @Get('password-reset/context') resetContext(@Query('token') token='') {
    return this.authService.passwordResetContext(token);
  }

  @Post('password-reset/complete') completeReset(@Body() body:Record<string,unknown>,@Req() request:Request,@Headers('user-agent') userAgent?:string){
    return this.authService.completePasswordReset(String(body.token??''),String(body.password??''),String(body.username??''),{ipAddress:request.ip,userAgent:userAgent??null});
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me') me(@Req() request: AuthRequest) { return this.authService.profile(request.user.id); }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile') updateProfile(@Req() request: AuthRequest, @Body() dto: UpdateProfileDto) { return this.authService.updateProfile(request.user.id, dto); }

  @UseGuards(AuthGuard('jwt'))
  @Post('profile/photo-upload') prepareProfilePhoto(@Req() request: AuthRequest, @Body() body: Record<string, unknown>) { return this.photos.prepare(request.user, body); }

  @UseGuards(AuthGuard('jwt'))
  @Post('profile/photo-finalize') finalizeProfilePhoto(@Req() request: AuthRequest) { return this.photos.finalize(request.user); }

  @UseGuards(AuthGuard('jwt'))
  @Get('terms') terms() { return this.authService.terms(); }

  @UseGuards(AuthGuard('jwt'))
  @Post('terms/accept') acceptTerms(@Req() request: AuthRequest) { return this.authService.acceptTerms(request.user.id); }

  @UseGuards(AuthGuard('jwt'))
  @Patch('notification-preferences') updateNotificationPreferences(@Req() request: AuthRequest, @Body() body: Record<string, unknown>) {
    return this.authService.updateNotificationPreferences(request.user.id, body);
  }
}