import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationKind,
  SupportConversationStatus,
  SupportMessageAuthor,
  SupportTaskStatus,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const AGENT_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR];
const SUPPORT_CONVERSATION_URL_PREFIX = '/help?conversation=';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private isAgent(user: AuthenticatedUser) {
    return AGENT_ROLES.includes(user.role);
  }

  private conversationActionUrl(conversationId: string) {
    return `${SUPPORT_CONVERSATION_URL_PREFIX}${conversationId}`;
  }

  private kheAnswer(question: string): { answer: string; confident: boolean } {
    const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const rules: Array<{ words: string[]; answer: string }> = [
      {
        words: ['activation', 'code', 'station'],
        answer:
          "Pour activer une station KHE Booth, ouvre l’événement dans le portail, génère un code d’activation, puis saisis ce code sur la tablette Capture ou Sharing. Le code est temporaire et sécurisé. Si le code est refusé, vérifie qu’il n’est ni expiré ni déjà utilisé pour ce mode.",
      },
      {
        words: ['camera', 'photo', 'video', 'capture'],
        answer:
          "Pour la capture, vérifie d’abord les autorisations Caméra et Microphone de KHE Booth sur la tablette. Dans le mode Capture, choisis Photo ou Vidéo, cadre le sujet puis lance la prise. Les médias restent conservés localement tant qu’ils ne sont pas synchronisés.",
      },
      {
        words: ['sharing', 'partage', 'deuxieme tablette', '2 tablette'],
        answer:
          "La tablette Sharing doit rejoindre le même événement que la tablette Capture avec le mode SHARING. Une fois les médias confirmés par la synchronisation, ils apparaissent dans la galerie de partage sans donner à la tablette Sharing l’accès aux données d’une autre organisation.",
      },
      {
        words: ['hors ligne', 'offline', 'internet', 'connexion'],
        answer:
          "KHE Booth est conçu pour continuer à fonctionner hors ligne. Le manifeste de l’événement et la file de synchronisation sont conservés localement. Ne supprime pas l’application ni ses données avant que les médias indiquent qu’ils sont synchronisés.",
      },
      {
        words: ['imprimer', 'impression', 'print', 'photo imprim'],
        answer:
          "Pour imprimer une photo, ouvre-la depuis la galerie puis utilise l’action Imprimer. Android affichera le service d’impression disponible sur la tablette. Vérifie que l’imprimante est déjà configurée sur Android et accessible sur le même réseau si elle est réseau.",
      },
      {
        words: ['mot de passe', 'connexion', 'login', 'compte'],
        answer:
          "Pour un problème de connexion au portail, vérifie l’adresse e-mail du compte et le mot de passe. Si l’accès reste impossible ou si le compte est désactivé, demande le transfert à un agent KHE afin qu’un administrateur puisse contrôler le compte sans exposer ton mot de passe.",
      },
      {
        words: ['mise a jour', 'mise à jour', 'version', 'nouveaute', 'nouveauté'],
        answer:
          "Les nouveautés KHE Booth apparaissent dans la cloche de notifications. Tu peux activer ou désactiver les notifications générales et les annonces produit dans tes préférences. Les informations importantes de sécurité peuvent rester visibles dans l’application.",
      },
      {
        words: ['agent', 'humain', 'conseiller', 'support', 'personne'],
        answer:
          "Je peux transférer cette conversation à un agent KHE. Ton historique restera attaché au ticket afin que tu n’aies pas à répéter le problème.",
      },
    ];

    let best: { score: number; answer: string } | null = null;
    for (const rule of rules) {
      const score = rule.words.filter((word) => q.includes(word)).length;
      if (score > 0 && (!best || score > best.score)) best = { score, answer: rule.answer };
    }

    if (best) return { answer: best.answer, confident: true };

    return {
      answer:
        "Je n’ai pas encore une réponse assez fiable pour cette demande. Je peux transmettre la conversation à un agent KHE avec le contexte déjà fourni afin qu’il puisse reprendre directement.",
      confident: false,
    };
  }

  private async visibleSupportActionUrls(user: AuthenticatedUser) {
    const conversations = await this.prisma.supportConversation.findMany({
      where: { organizationId: user.organizationId, requesterUserId: user.id },
      select: { id: true },
    });
    return new Set(conversations.map((conversation) => this.conversationActionUrl(conversation.id)));
  }

  async getNotifications(user: AuthenticatedUser) {
    const preferences = await this.prisma.user.findFirst({
      where: { id: user.id, organizationId: user.organizationId },
      select: {
        notificationsEnabled: true,
        productUpdatesEnabled: true,
        supportNotificationsEnabled: true,
      },
    });
    if (!preferences) throw new NotFoundException('Utilisateur introuvable');

    if (!preferences.notificationsEnabled) return { preferences, unreadCount: 0, items: [] };

    const excludedKinds: NotificationKind[] = [];
    if (!preferences.productUpdatesEnabled) excludedKinds.push(NotificationKind.UPDATE, NotificationKind.NEWS);
    if (!preferences.supportNotificationsEnabled) excludedKinds.push(NotificationKind.SUPPORT);

    const privateSupportUrls = await this.visibleSupportActionUrls(user);
    const items = await this.prisma.appNotification.findMany({
      where: {
        organizationId: user.organizationId,
        ...(excludedKinds.length ? { kind: { notIn: excludedKinds } } : {}),
      },
      include: { reads: { where: { userId: user.id }, select: { id: true } } },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    });

    const visibleItems = items.filter((item) => {
      const isPrivateSupport =
        item.kind === NotificationKind.SUPPORT && item.actionUrl?.startsWith(SUPPORT_CONVERSATION_URL_PREFIX);
      return !isPrivateSupport || privateSupportUrls.has(item.actionUrl ?? '');
    });
    const normalized = visibleItems
      .slice(0, 30)
      .map(({ reads, ...item }) => ({ ...item, read: reads.length > 0 }));
    return { preferences, unreadCount: normalized.filter((item) => !item.read).length, items: normalized };
  }

  async updatePreferences(
    user: AuthenticatedUser,
    input: { notificationsEnabled?: boolean; productUpdatesEnabled?: boolean; supportNotificationsEnabled?: boolean },
  ) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: input,
      select: {
        notificationsEnabled: true,
        productUpdatesEnabled: true,
        supportNotificationsEnabled: true,
      },
    });
  }

  async markNotificationRead(user: AuthenticatedUser, notificationId: string) {
    const notification = await this.prisma.appNotification.findFirst({
      where: { id: notificationId, organizationId: user.organizationId },
      select: { id: true, kind: true, actionUrl: true },
    });
    if (!notification) throw new NotFoundException('Notification introuvable');

    if (
      notification.kind === NotificationKind.SUPPORT &&
      notification.actionUrl?.startsWith(SUPPORT_CONVERSATION_URL_PREFIX)
    ) {
      const visibleUrls = await this.visibleSupportActionUrls(user);
      if (!visibleUrls.has(notification.actionUrl)) throw new NotFoundException('Notification introuvable');
    }

    return this.prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId, userId: user.id } },
      update: { readAt: new Date() },
      create: { notificationId, userId: user.id },
    });
  }

  async publishNotification(
    user: AuthenticatedUser,
    input: { title: string; body: string; kind?: NotificationKind; actionUrl?: string },
  ) {
    if (![UserRole.OWNER, UserRole.ADMIN].includes(user.role)) throw new ForbiddenException();
    return this.prisma.appNotification.create({
      data: {
        organizationId: user.organizationId,
        title: input.title,
        body: input.body,
        kind: input.kind ?? NotificationKind.NEWS,
        actionUrl: input.actionUrl,
      },
    });
  }

  async createConversation(user: AuthenticatedUser, message: string) {
    const subject = message.trim().slice(0, 80) || 'Demande KHE Booth';
    const bot = this.kheAnswer(message);
    const wantsAgent = /\b(agent|humain|conseiller|support)\b/i.test(message);
    const status = !bot.confident || wantsAgent
      ? SupportConversationStatus.HANDOFF_REQUESTED
      : SupportConversationStatus.BOT;

    return this.prisma.supportConversation.create({
      data: {
        organizationId: user.organizationId,
        requesterUserId: user.id,
        subject,
        status,
        messages: {
          create: [
            { author: SupportMessageAuthor.USER, body: message },
            { author: SupportMessageAuthor.KHE, body: bot.answer },
          ],
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } }, assignedTo: { select: { id: true, email: true } } },
    });
  }

  async listMine(user: AuthenticatedUser) {
    return this.prisma.supportConversation.findMany({
      where: { organizationId: user.organizationId, requesterUserId: user.id },
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async listInbox(user: AuthenticatedUser) {
    if (!this.isAgent(user)) throw new ForbiddenException();
    return this.prisma.supportConversation.findMany({
      where: { organizationId: user.organizationId, status: { not: SupportConversationStatus.BOT } },
      include: {
        requester: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        tasks: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getConversation(user: AuthenticatedUser, conversationId: string) {
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, organizationId: user.organizationId },
      include: {
        requester: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: { assignedTo: { select: { id: true, email: true } } },
        },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation introuvable');
    if (conversation.requesterUserId !== user.id && !this.isAgent(user)) throw new ForbiddenException();
    return conversation;
  }

  async sendMessage(user: AuthenticatedUser, conversationId: string, body: string) {
    const conversation = await this.getConversation(user, conversationId);
    const fromAgent = conversation.requesterUserId !== user.id && this.isAgent(user);

    if (fromAgent) {
      await this.prisma.$transaction([
        this.prisma.supportMessage.create({
          data: { conversationId, author: SupportMessageAuthor.AGENT, userId: user.id, body },
        }),
        this.prisma.supportConversation.update({
          where: { id: conversationId },
          data: {
            status: SupportConversationStatus.ASSIGNED,
            assignedToUserId: conversation.assignedToUserId ?? user.id,
            lastMessageAt: new Date(),
          },
        }),
        this.prisma.appNotification.create({
          data: {
            organizationId: user.organizationId,
            kind: NotificationKind.SUPPORT,
            title: 'Nouvelle réponse du support KHE',
            body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
            actionUrl: this.conversationActionUrl(conversationId),
          },
        }),
      ]);
      return this.getConversation(user, conversationId);
    }

    await this.prisma.supportMessage.create({
      data: { conversationId, author: SupportMessageAuthor.USER, body },
    });

    if (conversation.status === SupportConversationStatus.BOT) {
      const bot = this.kheAnswer(body);
      await this.prisma.supportMessage.create({
        data: { conversationId, author: SupportMessageAuthor.KHE, body: bot.answer },
      });
      await this.prisma.supportConversation.update({
        where: { id: conversationId },
        data: {
          status: bot.confident ? SupportConversationStatus.BOT : SupportConversationStatus.HANDOFF_REQUESTED,
          lastMessageAt: new Date(),
        },
      });
    } else {
      await this.prisma.supportConversation.update({
        where: { id: conversationId },
        data: {
          status:
            conversation.status === SupportConversationStatus.RESOLVED
              ? SupportConversationStatus.HANDOFF_REQUESTED
              : conversation.status,
          lastMessageAt: new Date(),
        },
      });
    }
    return this.getConversation(user, conversationId);
  }

  async requestAgent(user: AuthenticatedUser, conversationId: string) {
    const conversation = await this.getConversation(user, conversationId);
    if (conversation.requesterUserId !== user.id) throw new ForbiddenException();
    await this.prisma.supportMessage.create({
      data: { conversationId, author: SupportMessageAuthor.SYSTEM, body: 'Transfert demandé à un agent KHE.' },
    });
    return this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { status: SupportConversationStatus.HANDOFF_REQUESTED, lastMessageAt: new Date() },
    });
  }

  async listAgents(user: AuthenticatedUser) {
    if (!this.isAgent(user)) throw new ForbiddenException();
    return this.prisma.user.findMany({
      where: { organizationId: user.organizationId, isActive: true, role: { in: AGENT_ROLES } },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
      orderBy: { email: 'asc' },
    });
  }

  async assignConversation(user: AuthenticatedUser, conversationId: string, assignedToUserId: string) {
    if (!this.isAgent(user)) throw new ForbiddenException();
    const target = await this.prisma.user.findFirst({
      where: {
        id: assignedToUserId,
        organizationId: user.organizationId,
        isActive: true,
        role: { in: AGENT_ROLES },
      },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('Agent introuvable');
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Conversation introuvable');
    return this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { assignedToUserId, status: SupportConversationStatus.ASSIGNED },
    });
  }

  async resolveConversation(user: AuthenticatedUser, conversationId: string) {
    if (!this.isAgent(user)) throw new ForbiddenException();
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, organizationId: user.organizationId },
      select: { id: true, requesterUserId: true },
    });
    if (!conversation) throw new NotFoundException('Conversation introuvable');

    await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: {
          conversationId,
          author: SupportMessageAuthor.SYSTEM,
          body: 'Cette conversation a été marquée comme résolue par l’équipe KHE.',
        },
      }),
      this.prisma.supportConversation.update({
        where: { id: conversationId },
        data: { status: SupportConversationStatus.RESOLVED, lastMessageAt: new Date() },
      }),
      this.prisma.appNotification.create({
        data: {
          organizationId: user.organizationId,
          kind: NotificationKind.SUPPORT,
          title: 'Demande KHE résolue',
          body: 'L’équipe KHE a marqué votre demande comme résolue. Vous pouvez rouvrir la conversation en répondant.',
          actionUrl: this.conversationActionUrl(conversationId),
        },
      }),
    ]);
    return this.getConversation(user, conversationId);
  }

  async createTask(user: AuthenticatedUser, conversationId: string, title: string, assignedToUserId?: string) {
    if (!this.isAgent(user)) throw new ForbiddenException();
    const conversation = await this.prisma.supportConversation.findFirst({
      where: { id: conversationId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!conversation) throw new NotFoundException('Conversation introuvable');
    if (assignedToUserId) {
      const target = await this.prisma.user.findFirst({
        where: {
          id: assignedToUserId,
          organizationId: user.organizationId,
          isActive: true,
          role: { in: AGENT_ROLES },
        },
      });
      if (!target) throw new NotFoundException('Membre de l’équipe introuvable');
    }
    return this.prisma.supportTask.create({
      data: {
        organizationId: user.organizationId,
        conversationId,
        title,
        assignedToUserId,
        createdByUserId: user.id,
      },
    });
  }

  async updateTask(user: AuthenticatedUser, taskId: string, status: SupportTaskStatus) {
    if (!this.isAgent(user)) throw new ForbiddenException();
    const task = await this.prisma.supportTask.findFirst({
      where: { id: taskId, organizationId: user.organizationId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Tâche introuvable');
    return this.prisma.supportTask.update({ where: { id: taskId }, data: { status } });
  }
}
