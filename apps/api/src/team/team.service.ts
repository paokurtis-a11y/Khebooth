import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { KHE_PERMISSIONS, resolvedPermissions, type PermissionOverrides } from '../auth/permissions';
import type { AuthenticatedUser } from '../auth/auth.types';

export interface MemberRow {
  id: string;
  organizationId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  permissions: unknown;
  createdAt: Date;
}
export interface InvitationRow {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  permissions: unknown;
  expiresAt: Date;
  acceptedAt: Date | null;
  invitedByUserId: string;
  createdAt: Date;
}

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizePermissions(value: unknown): PermissionOverrides {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const input = value as Record<string, unknown>;
    const output: PermissionOverrides = {};
    for (const permission of KHE_PERMISSIONS) {
      if (typeof input[permission] === 'boolean') output[permission] = input[permission] as boolean;
    }
    return output;
  }

  private async actor(userId: string): Promise<MemberRow> {
    const rows = await this.prisma.$queryRaw<MemberRow[]>`
      SELECT id, "organizationId", email, "firstName", "lastName", phone, role::text AS role, "isActive", permissions, "createdAt"
      FROM "User" WHERE id = ${userId}::uuid LIMIT 1
    `;
    if (!rows[0]?.isActive) throw new ForbiddenException('Compte indisponible');
    return rows[0];
  }

  private assertCanManage(actorRole: string, targetRole: string) {
    if (actorRole === 'OWNER') return;
    if (actorRole !== 'ADMIN') throw new ForbiddenException('Gestion d’équipe réservée aux administrateurs');
    if (targetRole === 'OWNER' || targetRole === 'ADMIN') throw new ForbiddenException('Un administrateur ne peut pas gérer un Owner ou un autre Admin');
  }

  async list(user: AuthenticatedUser) {
    const actor = await this.actor(user.id);
    const members = await this.prisma.$queryRaw<MemberRow[]>`
      SELECT id, "organizationId", email, "firstName", "lastName", phone, role::text AS role, "isActive", permissions, "createdAt"
      FROM "User" WHERE "organizationId" = ${actor.organizationId}::uuid ORDER BY "createdAt" ASC
    `;
    const invitations = await this.prisma.$queryRaw<InvitationRow[]>`
      SELECT id, "organizationId", email, role::text AS role, permissions, "expiresAt", "acceptedAt", "invitedByUserId", "createdAt"
      FROM "TeamInvitation"
      WHERE "organizationId" = ${actor.organizationId}::uuid AND "acceptedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP
      ORDER BY "createdAt" DESC
    `;
    return {
      availablePermissions: KHE_PERMISSIONS,
      members: members.map((member) => ({ ...member, permissions: resolvedPermissions(member.role, member.permissions), permissionOverrides: this.sanitizePermissions(member.permissions) })),
      invitations: invitations.map((invitation) => ({ ...invitation, permissions: resolvedPermissions(invitation.role, invitation.permissions), permissionOverrides: this.sanitizePermissions(invitation.permissions) })),
    };
  }

  async invite(user: AuthenticatedUser, body: Record<string, unknown>) {
    const actor = await this.actor(user.id);
    const email = String(body.email ?? '').trim().toLowerCase();
    const role = String(body.role ?? 'OPERATOR').toUpperCase();
    if (!email.includes('@')) throw new BadRequestException('Adresse e-mail invalide');
    if (!(Object.values(UserRole) as string[]).includes(role)) throw new BadRequestException('Rôle invalide');
    this.assertCanManage(actor.role, role);
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE lower(email) = ${email} LIMIT 1`;
    if (existing[0]) throw new BadRequestException('Un utilisateur existe déjà avec cette adresse e-mail');

    const permissions = this.sanitizePermissions(body.permissions);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.$executeRaw`
      DELETE FROM "TeamInvitation" WHERE "organizationId" = ${actor.organizationId}::uuid AND lower(email) = ${email} AND "acceptedAt" IS NULL
    `;
    const rows = await this.prisma.$queryRaw<InvitationRow[]>`
      INSERT INTO "TeamInvitation" (id, "organizationId", email, role, permissions, "tokenHash", "expiresAt", "invitedByUserId", "createdAt")
      VALUES (gen_random_uuid(), ${actor.organizationId}::uuid, ${email}, ${role}::"UserRole", ${JSON.stringify(permissions)}::jsonb, ${tokenHash}, ${expiresAt}, ${actor.id}::uuid, CURRENT_TIMESTAMP)
      RETURNING id, "organizationId", email, role::text AS role, permissions, "expiresAt", "acceptedAt", "invitedByUserId", "createdAt"
    `;
    const origin = (process.env.WEB_ORIGIN || 'https://khebooth-rdvo.vercel.app').split(',')[0].trim().replace(/\/$/, '');
    const inviteUrl = `${origin}/invite/${token}`;
    const emailSent = await this.sendInvitationEmail(email, role, inviteUrl);
    await this.prisma.auditLog.create({ data: { organizationId: actor.organizationId, userId: actor.id, action: 'TEAM_INVITATION_CREATED', entityType: 'TeamInvitation', entityId: rows[0]?.id ?? email } });
    return { invitation: rows[0], inviteUrl, emailSent };
  }

  private async sendInvitationEmail(email: string, role: string, inviteUrl: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim();
    if (!apiKey || !from) return false;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject: 'Invitation KHE Booth', html: `<p>Vous avez été invité à rejoindre KHE Booth avec le rôle <strong>${role}</strong>.</p><p><a href="${inviteUrl}">Accepter l’invitation</a></p><p>Ce lien expire dans 7 jours.</p>` }),
      });
      return response.ok;
    } catch { return false; }
  }

  async updateMember(user: AuthenticatedUser, memberId: string, body: Record<string, unknown>) {
    const actor = await this.actor(user.id);
    const targets = await this.prisma.$queryRaw<MemberRow[]>`
      SELECT id, "organizationId", email, "firstName", "lastName", phone, role::text AS role, "isActive", permissions, "createdAt"
      FROM "User" WHERE id = ${memberId}::uuid AND "organizationId" = ${actor.organizationId}::uuid LIMIT 1
    `;
    const target = targets[0];
    if (!target) throw new NotFoundException('Membre introuvable');
    if (target.id === actor.id && body.isActive === false) throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte');
    this.assertCanManage(actor.role, target.role);
    const nextRole = body.role ? String(body.role).toUpperCase() : target.role;
    if (!(Object.values(UserRole) as string[]).includes(nextRole)) throw new BadRequestException('Rôle invalide');
    this.assertCanManage(actor.role, nextRole);
    if (target.role === 'OWNER' && nextRole !== 'OWNER') throw new ForbiddenException('Le rôle OWNER principal ne peut pas être rétrogradé ici');
    const permissions = this.sanitizePermissions(body.permissions ?? target.permissions);
    const isActive = body.isActive === undefined ? target.isActive : Boolean(body.isActive);
    await this.prisma.$executeRaw`
      UPDATE "User" SET role = ${nextRole}::"UserRole", permissions = ${JSON.stringify(permissions)}::jsonb, "isActive" = ${isActive}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${memberId}::uuid AND "organizationId" = ${actor.organizationId}::uuid
    `;
    await this.prisma.auditLog.create({ data: { organizationId: actor.organizationId, userId: actor.id, action: 'TEAM_MEMBER_UPDATED', entityType: 'User', entityId: memberId } });
    return this.list(user);
  }

  async revokeInvitation(user: AuthenticatedUser, invitationId: string) {
    const actor = await this.actor(user.id);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; role: string }>>`
      SELECT id, role::text AS role FROM "TeamInvitation" WHERE id = ${invitationId}::uuid AND "organizationId" = ${actor.organizationId}::uuid LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Invitation introuvable');
    this.assertCanManage(actor.role, rows[0].role);
    await this.prisma.$executeRaw`DELETE FROM "TeamInvitation" WHERE id = ${invitationId}::uuid`;
    return { revoked: true };
  }

  async invitation(token: string) {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new BadRequestException('Invitation invalide');
    const hash = createHash('sha256').update(token).digest('hex');
    const rows = await this.prisma.$queryRaw<InvitationRow[]>`
      SELECT id, "organizationId", email, role::text AS role, permissions, "expiresAt", "acceptedAt", "invitedByUserId", "createdAt"
      FROM "TeamInvitation" WHERE "tokenHash" = ${hash} AND "acceptedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Invitation expirée ou indisponible');
    return { email: rows[0].email, role: rows[0].role, expiresAt: rows[0].expiresAt };
  }

  async accept(token: string, body: Record<string, unknown>) {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new BadRequestException('Invitation invalide');
    const hash = createHash('sha256').update(token).digest('hex');
    const invitations = await this.prisma.$queryRaw<InvitationRow[]>`
      SELECT id, "organizationId", email, role::text AS role, permissions, "expiresAt", "acceptedAt", "invitedByUserId", "createdAt"
      FROM "TeamInvitation" WHERE "tokenHash" = ${hash} AND "acceptedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP LIMIT 1
    `;
    const invitation = invitations[0];
    if (!invitation) throw new NotFoundException('Invitation expirée ou indisponible');
    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const phone = String(body.phone ?? '').trim() || null;
    const password = String(body.password ?? '');
    if (!firstName || !lastName) throw new BadRequestException('Nom et prénom obligatoires');
    if (password.length < 10) throw new BadRequestException('Le mot de passe doit contenir au moins 10 caractères');
    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE lower(email) = ${invitation.email.toLowerCase()} LIMIT 1`;
    if (existing[0]) throw new BadRequestException('Cette adresse e-mail est déjà utilisée');
    const passwordHash = await argon2.hash(password);
    const users = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "User" (id, "organizationId", email, "passwordHash", "firstName", "lastName", phone, role, permissions, "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${invitation.organizationId}::uuid, ${invitation.email.toLowerCase()}, ${passwordHash}, ${firstName}, ${lastName}, ${phone}, ${invitation.role}::"UserRole", ${JSON.stringify(this.sanitizePermissions(invitation.permissions))}::jsonb, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;
    await this.prisma.$executeRaw`UPDATE "TeamInvitation" SET "acceptedAt" = CURRENT_TIMESTAMP WHERE id = ${invitation.id}::uuid`;
    return { created: true, userId: users[0]?.id, email: invitation.email };
  }
}
