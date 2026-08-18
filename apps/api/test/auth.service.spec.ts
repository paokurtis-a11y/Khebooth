import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from '../src/auth/auth.service';
import { ProfilePhotoService } from '../src/auth/profile-photo.service';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2', () => ({ verify: jest.fn() }));

describe('AuthService', () => {
  const user = {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: '22222222-2222-2222-2222-222222222222',
    email: 'owner@example.com',
    passwordHash: 'argon-hash',
    firstName: 'Kurtis',
    lastName: null,
    role: UserRole.OWNER,
    isActive: true,
    notificationsEnabled: true,
    productUpdatesEnabled: true,
    supportNotificationsEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileRow = {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    role: UserRole.OWNER,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: null,
    avatarPath: null,
    permissions: {},
    termsAcceptedRevision: null,
    termsAcceptedAt: null,
    notificationPreferences: {},
    isActive: true,
  };

  const prisma = {
    user: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;

  const jwt = {
    signAsync: jest.fn().mockResolvedValue('signed-jwt'),
  } as unknown as JwtService;

  const photos = {
    download: jest.fn().mockResolvedValue({ avatarUrl: null, expiresAt: null }),
  } as unknown as ProfilePhotoService;

  const service = new AuthService(prisma, jwt, photos);
  const verifyMock = argon2.verify as jest.MockedFunction<typeof argon2.verify>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(prisma, '$queryRaw').mockResolvedValue([profileRow] as never);
    jest.spyOn(photos, 'download').mockResolvedValue({ avatarUrl: null, expiresAt: null });
  });

  it('normalizes email, verifies Argon2 and returns a JWT without passwordHash', async () => {
    jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(user);
    verifyMock.mockResolvedValue(true);
    jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      organizationId: user.organizationId,
      userId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
      metadata: null,
      createdAt: new Date(),
    });

    const result = await service.login({ email: ' OWNER@EXAMPLE.COM ', password: 'correct-password' });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'owner@example.com', isActive: true },
    });
    expect(verifyMock).toHaveBeenCalledWith(user.passwordHash, 'correct-password');
    expect(result.accessToken).toBe('signed-jwt');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.role).toBe(UserRole.OWNER);
  });

  it('rejects an invalid password', async () => {
    jest.spyOn(prisma.user, 'findFirst').mockResolvedValue(user);
    verifyMock.mockResolvedValue(false);

    await expect(service.login({ email: user.email, password: 'wrong-password' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});
