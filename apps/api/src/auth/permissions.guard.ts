import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from './auth.types';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { resolvedPermissions, type KhePermission } from './permissions';

interface AuthRequest extends Request { user?: AuthenticatedUser; }
interface AccessRow { role: string; permissions: unknown; isActive: boolean; }

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<KhePermission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.user) return false;
    const rows = await this.prisma.$queryRaw<AccessRow[]>`
      SELECT role::text AS role, permissions, "isActive" FROM "User" WHERE id = ${request.user.id}::uuid LIMIT 1
    `;
    const access = rows[0];
    if (!access?.isActive) return false;
    const permissions = resolvedPermissions(access.role, access.permissions);
    const allowed = required.every((permission) => permissions[permission]);
    if (!allowed) throw new ForbiddenException('Permission KHE insuffisante pour cette action');
    return true;
  }
}
