import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email: normalizedEmail, isActive: true } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = { sub: user.id, organizationId: user.organizationId, email: user.email, role: user.role };
    await this.prisma.auditLog.create({ data: { organizationId: user.organizationId, userId: user.id, action: 'AUTH_LOGIN', entityType: 'User', entityId: user.id } });

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, organizationId: user.organizationId, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('User unavailable');
    return { id: user.id, organizationId: user.organizationId, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const email = dto.email.trim().toLowerCase();
    if (!firstName || !lastName) throw new BadRequestException('First name and last name are required');

    const existing = await this.prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
    if (existing) throw new BadRequestException('Email already in use');

    const user = await this.prisma.user.update({ where: { id: userId }, data: { firstName, lastName, email } });
    await this.prisma.auditLog.create({ data: { organizationId: user.organizationId, userId: user.id, action: 'USER_PROFILE_UPDATED', entityType: 'User', entityId: user.id } });
    return { id: user.id, organizationId: user.organizationId, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName };
  }
}
