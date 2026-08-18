import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './auth.types';
import { resolvedPermissions } from './permissions';
import { ProfilePhotoService } from './profile-photo.service';

export const WEB_TERMS_REVISION = '2026-08-18.1';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  enabled: true,
  soundEnabled: true,
  sound: 'khe_chime',
  vibrationEnabled: true,
  vibrationMode: 'double',
  vibrationIntensity: 'medium',
};

interface UserProfileRow {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarPath: string | null;
  permissions: unknown;
  termsAcceptedRevision: string | null;
  termsAcceptedAt: Date | null;
  notificationPreferences: unknown;
  isActive: boolean;
}

function normalizeNotificationPreferences(value: unknown) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const sound = ['default', 'khe_chime', 'khe_gold', 'khe_pulse', 'silent'].includes(String(input.sound)) ? String(input.sound) : DEFAULT_NOTIFICATION_PREFERENCES.sound;
  const vibrationMode = ['off', 'short', 'double', 'triple', 'long'].includes(String(input.vibrationMode)) ? String(input.vibrationMode) : DEFAULT_NOTIFICATION_PREFERENCES.vibrationMode;
  const vibrationIntensity = ['light', 'medium', 'strong'].includes(String(input.vibrationIntensity)) ? String(input.vibrationIntensity) : DEFAULT_NOTIFICATION_PREFERENCES.vibrationIntensity;
  return {
    enabled: input.enabled !== false,
    soundEnabled: input.soundEnabled !== false && sound !== 'silent',
    sound,
    vibrationEnabled: input.vibrationEnabled !== false && vibrationMode !== 'off',
    vibrationMode,
    vibrationIntensity,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly photos: ProfilePhotoService,
  ) {}

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email: normalizedEmail, isActive: true } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = { sub: user.id, organizationId: user.organizationId, email: user.email, role: user.role };
    await this.prisma.auditLog.create({ data: { organizationId: user.organizationId, userId: user.id, action: 'AUTH_LOGIN', entityType: 'User', entityId: user.id } });

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: await this.profile(user.id),
    };
  }

  private async row(userId: string): Promise<UserProfileRow> {
    const rows = await this.prisma.$queryRaw<UserProfileRow[]>`
      SELECT id, "organizationId", email, role::text AS role, "firstName", "lastName", phone, "avatarPath", permissions,
             "termsAcceptedRevision", "termsAcceptedAt", "notificationPreferences", "isActive"
      FROM "User" WHERE id = ${userId}::uuid LIMIT 1
    `;
    const user = rows[0];
    if (!user || !user.isActive) throw new UnauthorizedException('User unavailable');
    return user;
  }

  async profile(userId: string) {
    const user = await this.row(userId);
    const avatar = await this.photos.download(user.avatarPath);
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: avatar.avatarUrl,
      avatarExpiresAt: avatar.expiresAt,
      permissions: resolvedPermissions(user.role, user.permissions),
      termsRevision: WEB_TERMS_REVISION,
      termsAccepted: user.termsAcceptedRevision === WEB_TERMS_REVISION,
      termsAcceptedRevision: user.termsAcceptedRevision,
      termsAcceptedAt: user.termsAcceptedAt,
      notificationPreferences: normalizeNotificationPreferences(user.notificationPreferences),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.trim() || null;
    if (!firstName || !lastName) throw new BadRequestException('First name and last name are required');

    const existing = await this.prisma.user.findFirst({ where: { email, NOT: { id: userId } }, select: { id: true } });
    if (existing) throw new BadRequestException('Email already in use');

    await this.prisma.user.update({ where: { id: userId }, data: { firstName, lastName, email } });
    await this.prisma.$executeRaw`UPDATE "User" SET phone = ${phone}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${userId}::uuid`;
    const user = await this.row(userId);
    await this.prisma.auditLog.create({ data: { organizationId: user.organizationId, userId: user.id, action: 'USER_PROFILE_UPDATED', entityType: 'User', entityId: user.id } });
    return this.profile(userId);
  }

  terms() {
    return {
      revision: WEB_TERMS_REVISION,
      title: 'Conditions générales d’utilisation — KHE Booth',
      sections: [
        { title: '1. Objet', body: 'KHE Booth est une plateforme et une application de capture, création, synchronisation, gestion, impression et partage de contenus photo et vidéo pour des événements.' },
        { title: '2. Compte et sécurité', body: 'Chaque utilisateur doit protéger ses identifiants, utiliser uniquement les droits qui lui sont attribués et signaler sans délai tout accès non autorisé. Les rôles et permissions sont gérés par l’organisation.' },
        { title: '3. Captation et droit à l’image', body: 'L’organisateur et les utilisateurs sont responsables d’obtenir les autorisations nécessaires avant de photographier, filmer, imprimer ou partager des contenus et doivent respecter les règles locales applicables.' },
        { title: '4. Données et confidentialité', body: 'Les utilisateurs doivent traiter les données personnelles conformément aux lois applicables, notamment la LPD en Suisse et, lorsque pertinent, le RGPD dans l’Union européenne ou l’EEE.' },
        { title: '5. Cloud, appareils et services tiers', body: 'Certaines fonctions dépendent d’Internet, de Vercel, de services de paiement, de stockage, d’e-mail, d’Android, iOS ou du navigateur. Leur disponibilité peut varier selon le pays, l’appareil et le fournisseur.' },
        { title: '6. Abonnements et paiements', body: 'Les fonctionnalités disponibles dépendent du niveau d’abonnement. Les abonnements récurrents sont renouvelés selon les conditions présentées au paiement jusqu’à résiliation par le client. Les moyens de paiement disponibles peuvent varier selon le pays.' },
        { title: '7. Contenus interdits', body: 'Il est interdit d’utiliser KHE Booth pour des contenus ou activités illicites, abusifs, trompeurs, portant atteinte aux droits de tiers ou à la sécurité des personnes et des systèmes.' },
        { title: '8. Disponibilité et mises à jour', body: 'KHE Booth peut être mis à jour, maintenu ou temporairement indisponible. Les utilisateurs peuvent recevoir des informations de maintenance, de sécurité et de mise à jour via la plateforme, l’application ou l’e-mail.' },
        { title: '9. Notifications', body: 'Les notifications peuvent être réglées en silencieux, avec son ou vibration selon les capacités du navigateur, du système et de l’appareil. Les réglages système de l’appareil restent prioritaires.' },
        { title: '10. Acceptation et évolution', body: 'L’utilisation de la plateforme nécessite l’acceptation de la révision en vigueur. Une nouvelle acceptation peut être demandée lorsque les conditions changent de manière significative.' },
      ],
    };
  }

  async acceptTerms(userId: string) {
    await this.prisma.$executeRaw`
      UPDATE "User" SET "termsAcceptedRevision" = ${WEB_TERMS_REVISION}, "termsAcceptedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}::uuid
    `;
    return this.profile(userId);
  }

  async updateNotificationPreferences(userId: string, payload: unknown) {
    const preferences = normalizeNotificationPreferences(payload);
    await this.prisma.$executeRaw`
      UPDATE "User" SET "notificationPreferences" = ${JSON.stringify(preferences)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}::uuid
    `;
    return preferences;
  }
}
