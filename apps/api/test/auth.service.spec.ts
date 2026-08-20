import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from '../src/auth/auth.service';
import { ProfilePhotoService } from '../src/auth/profile-photo.service';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2', () => ({ verify: jest.fn(), hash: jest.fn() }));

describe('AuthService', () => {
  const user = {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: '22222222-2222-2222-2222-222222222222',
    email: 'owner@example.com',
    passwordHash: 'argon-hash',
    role: UserRole.OWNER,
    authVersion: 1,
    failedLoginAttempts: 0,
    passwordResetRequired: false,
    loginLockedAt: null,
    isActive: true,
  };

  const profileRow = {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    role: UserRole.OWNER,
    firstName: 'Kurtis',
    lastName: null,
    phone: null,
    avatarPath: null,
    permissions: {},
    termsAcceptedRevision: null,
    termsAcceptedAt: null,
    notificationPreferences: {},
    isActive: true,
    tenantKind: 'KHE_ROOT',
    managedByOrganizationId: null,
    isPlatformManaged: false,
  };

  const prisma = {
    user: { findFirst: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-jwt') } as unknown as JwtService;
  const photos = { download: jest.fn().mockResolvedValue({ avatarUrl: null, expiresAt: null }) } as unknown as ProfilePhotoService;
  const service = new AuthService(prisma, jwt, photos);
  const verifyMock = argon2.verify as jest.MockedFunction<typeof argon2.verify>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(prisma, '$executeRaw').mockResolvedValue(1 as never);
    jest.spyOn(photos, 'download').mockResolvedValue({ avatarUrl: null, expiresAt: null });
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
  });

  it('normalizes email, verifies Argon2 and returns a versioned JWT without passwordHash', async () => {
    jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([user] as never)
      .mockResolvedValueOnce([profileRow] as never);
    verifyMock.mockResolvedValue(true);

    const result = await service.login({ email: ' OWNER@EXAMPLE.COM ', password: 'correct-password' });

    expect(verifyMock).toHaveBeenCalledWith(user.passwordHash, 'correct-password');
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: UserRole.OWNER,
      authVersion: 1,
    }));
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(result.accessToken).toBe('signed-jwt');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.user.role).toBe(UserRole.OWNER);
    expect(result.user.securityDetailsAllowed).toBe(true);
  });

  it('increments the failed-login counter and rejects an invalid password', async () => {
    jest.spyOn(prisma, '$queryRaw')
      .mockResolvedValueOnce([user] as never)
      .mockResolvedValueOnce([{ failedLoginThreshold: 5 }] as never);
    verifyMock.mockResolvedValue(false);

    await expect(service.login({ email: user.email, password: 'wrong-password' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('requires password reset when the account is already marked for reset', async () => {
    jest.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ ...user, passwordResetRequired: true }] as never);

    await expect(service.login({ email: user.email, password: 'anything' })).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'PASSWORD_RESET_REQUIRED' }),
    });
    expect(verifyMock).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
});