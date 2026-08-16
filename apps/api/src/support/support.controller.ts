import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationKind, SupportTaskStatus, UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupportService } from './support.service';

class NotificationPreferencesDto {
  @IsOptional() @IsBoolean() notificationsEnabled?: boolean;
  @IsOptional() @IsBoolean() productUpdatesEnabled?: boolean;
  @IsOptional() @IsBoolean() supportNotificationsEnabled?: boolean;
}

class PublishNotificationDto {
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(2) @MaxLength(1200) body!: string;
  @IsOptional() @IsEnum(NotificationKind) kind?: NotificationKind;
  @IsOptional() @IsString() @MaxLength(300) actionUrl?: string;
}

class MessageDto {
  @IsString() @MinLength(1) @MaxLength(3000) message!: string;
}

class AssignConversationDto {
  @IsUUID() userId!: string;
}

class CreateTaskDto {
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsOptional() @IsUUID() assignedToUserId?: string;
}

class UpdateTaskDto {
  @IsEnum(SupportTaskStatus) status!: SupportTaskStatus;
}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('notifications')
  notifications(@CurrentUser() user: AuthenticatedUser) {
    return this.support.getNotifications(user);
  }

  @Patch('notifications/preferences')
  preferences(@CurrentUser() user: AuthenticatedUser, @Body() dto: NotificationPreferencesDto) {
    return this.support.updatePreferences(user, dto);
  }

  @Post('notifications/:id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.support.markNotificationRead(user, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post('notifications')
  publish(@CurrentUser() user: AuthenticatedUser, @Body() dto: PublishNotificationDto) {
    return this.support.publishNotification(user, dto);
  }

  @Post('conversations')
  createConversation(@CurrentUser() user: AuthenticatedUser, @Body() dto: MessageDto) {
    return this.support.createConversation(user, dto.message);
  }

  @Get('conversations/me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listMine(user);
  }

  @Get('conversations/:id')
  conversation(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.support.getConversation(user, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: MessageDto,
  ) {
    return this.support.sendMessage(user, id, dto.message);
  }

  @Post('conversations/:id/request-agent')
  requestAgent(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.support.requestAgent(user, id);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Get('inbox')
  inbox(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listInbox(user);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Get('agents')
  agents(@CurrentUser() user: AuthenticatedUser) {
    return this.support.listAgents(user);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Patch('conversations/:id/assign')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignConversationDto,
  ) {
    return this.support.assignConversation(user, id, dto.userId);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Post('conversations/:id/tasks')
  createTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.support.createTask(user, id, dto.title, dto.assignedToUserId);
  }

  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Patch('tasks/:id')
  updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.support.updateTask(user, id, dto.status);
  }
}
