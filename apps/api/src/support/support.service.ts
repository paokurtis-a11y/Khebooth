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
const ADMIN_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];
const SUPPORT_CONVERSATION_URL_PREFIX = '/help?conversation=';
const SUPPORT_AGENT_URL_PREFIX = '/help?agentConversation=';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private isAgent(user: AuthenticatedUser) {
    return AGENT_ROLES.includes(user.role);
  }

  private wantsAgent(question: string) {
    return /\b(agent|humain|humaine|conseiller|conseillere|support|technicien|technicienne|personne)\b/i.test(question);
  }

  private conversationActionUrl(conversationId: string) {
    return `${SUPPORT_CONVERSATION_URL_PREFIX}${conversationId}`;
  }

  private agentConversationActionUrl(conversationId: string) {
    return `${SUPPORT_AGENT_URL_PREFIX}${conversationId}`;
  }

  private kheAnswer(question: string): { answer: string; confident: boolean } {
    const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const rules: Array<{ words: string[]; answer: string }> = [
      {
        words: ['activation', 'code', 'station', 'activer'],
        answer:
          "Pour activer une station KHE Booth, ouvre l’événement dans le portail, génère un code d’activation, puis saisis ce code sur la tablette Capture ou Sharing. Le code est temporaire et sécurisé. S’il est refusé, vérifie qu’il n’est ni expiré ni déjà utilisé pour ce mode.",
      },
      {
        words: ['camera', 'photo', 'video', 'capture', 'microphone'],
        answer:
          "Pour la capture, vérifie d’abord les autorisations Caméra et Microphone de KHE Booth sur la tablette. Dans Capture, choisis Photo ou Vidéo, cadre le sujet puis lance la prise. Si l’image reste noire, ferme puis rouvre le mode Capture après avoir confirmé les autorisations Android.",
      },
      {
        words: ['sharing', 'partage', 'deuxieme tablette', '2 tablette', 'tablette partage'],
        answer:
          "La tablette Sharing doit rejoindre le même événement que la tablette Capture avec le mode SHARING. Vérifie que la connexion Sharing a été approuvée dans l’événement. Une fois les médias synchronisés, ils apparaissent dans la galerie de partage sans exposer les données d’une autre organisation.",
      },
      {
        words: ['synchronisation', 'synchroniser', 'sync', 'upload', 'transfert', 'media manquant', 'video manquante', 'photo manquante'],
        answer:
          "Si un média n’apparaît pas encore, garde la tablette Capture ouverte et connectée, puis vérifie la file de synchronisation. Un média non confirmé reste localement en attente : ne supprime pas l’application ni ses données. Dès que l’envoi est confirmé, la tablette Sharing peut rafraîchir la galerie.",
      },
      {
        words: ['hors ligne', 'offline', 'internet', 'reseau', 'connexion internet'],
        answer:
          "KHE Booth est conçu pour continuer à capturer hors ligne. Le manifeste de l’événement et la file de synchronisation restent localement sur la tablette. Quand Internet revient, laisse l’application ouverte pour terminer les transferts et ne supprime pas ses données avant confirmation de synchronisation.",
      },
      {
        words: ['connexion sharing', 'autoriser tablette', 'approuver', 'approval', 'remote', 'commande distance', 'controle distance'],
        answer:
          "Pour connecter ou piloter une seconde station, ouvre l’événement dans le portail et vérifie la demande de connexion de la tablette. Approuve uniquement la station attendue. Les commandes à distance restent limitées à l’événement et à l’organisation auxquels la station est rattachée.",
      },
      {
        words: ['imprimer', 'impression', 'print', 'photo imprim', 'imprimante'],
        answer:
          "Pour imprimer une photo, ouvre-la depuis la galerie puis utilise l’action Imprimer. Android affichera le service d’impression disponible. Vérifie que l’imprimante est déjà configurée sur Android et, si elle est réseau, qu’elle est accessible depuis la tablette.",
      },
      {
        words: ['mot de passe', 'connexion', 'login', 'compte', 'identifiant', 'username', 'nom utilisateur'],
        answer:
          "Pour te connecter au portail, utilise ton adresse e-mail d’accès ou ton nom d’utilisateur KHE, puis ton mot de passe. Le nom d’utilisateur est unique et une adresse e-mail d’accès ne peut appartenir qu’à un seul compte. Si nécessaire, utilise “Mot de passe oublié” ou demande le transfert à un agent KHE.",
      },
      {
        words: ['abonnement', 'subscription', 'facture', 'billing', 'paiement', 'stripe', 'renouvellement'],
        answer:
          "Pour l’abonnement ou la facturation, ouvre la rubrique Abonnement/Facturation du portail afin de vérifier le plan actif, les documents disponibles et les actions de renouvellement. Si un paiement est débité mais que l’accès n’est pas actualisé, transmets la conversation à un agent KHE avec la date du paiement, sans partager de numéro de carte.",
      },
      {
        words: ['enterprise', 'kyc', 'identite', 'justificatif', 'onboarding', 'verification', 'reverification'],
        answer:
          "Pour un dossier Enterprise, suis le lien sécurisé d’onboarding ou de revérification et complète uniquement les champs demandés. Les pièces d’identité et justificatifs doivent être envoyés via l’espace prévu à cet effet. Si le dossier reste bloqué après envoi, un agent KHE peut vérifier son statut sans te demander ton mot de passe.",
      },
      {
        words: ['crm', 'client', 'email marketing', 'marketing', 'newsletter', 'desabonner', 'consentement'],
        answer:
          "Le CRM KHE conserve les informations client nécessaires au suivi. Les e-mails marketing ne sont envoyés qu’aux contacts ayant un consentement enregistré et peuvent être désactivés via le lien de désabonnement. Modifier l’adresse e-mail du client réinitialise le consentement marketing pour éviter un envoi à une nouvelle adresse sans accord.",
      },
      {
        words: ['notification', 'cloche', 'son', 'vibration', 'nouveaute', 'mise a jour', 'version'],
        answer:
          "Les nouveautés et réponses support apparaissent dans la cloche de notifications. Tu peux activer ou désactiver les notifications générales, les nouveautés produit et le support, puis régler le son et la vibration dans les paramètres. Les informations de sécurité importantes peuvent rester visibles dans l’application.",
      },
      {
        words: ['securite', 'confidentialite', 'privacy', 'donnees', 'mot de passe partage', 'carte bancaire'],
        answer:
          "Pour ta sécurité, ne communique jamais ton mot de passe, un code d’activation sensible ou les données complètes d’une carte bancaire dans la messagerie. KHE Booth isole les données par organisation et l’équipe support peut diagnostiquer un compte sans demander ton mot de passe.",
      },
      {
        words: ['urgent', 'evenement en cours', 'prestation en cours', 'bloque maintenant', 'panne evenement'],
        answer:
          "Si l’événement est en cours, conserve d’abord les médias déjà capturés : ne désinstalle pas l’application et ne vide pas ses données. Vérifie l’alimentation, les autorisations, le réseau et la file de synchronisation. Si la prestation reste bloquée, demande immédiatement le transfert à un agent KHE en précisant Capture ou Sharing et ce qui est affiché à l’écran.",
      },
      {
        words: ['agent', 'humain', 'conseiller', 'support', 'personne', 'technicien'],
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
    const own = await this.prisma.supportConversation.findMany({
      where: { organizationId: user.organizationId, requesterUserId: user.id },
      select: { id: true },
    });
    const urls = new Set(own.map((conversation) => this.conversationActionUrl(conversation.id)));
    if (this.isAgent(user)) {
      const inbox = await this.prisma.supportConversation.findMany({
        where: { organizationId: user.organizationId, status: { not: SupportConversationStatus.BOT } },
        select: { id: true },
      });
      inbox.forEach((conversation) => urls.add(this.agentConversationActionUrl(conversation.id)));
    }
    return urls;
  }

  private async notifyAgents(user: AuthenticatedUser, conversationId: string, title: string, body: string) {
    return this.prisma.appNotification.create({
      data: {
        organizationId: user.organizationId,
        kind: NotificationKind.SUPPORT,
        title,
        body,
        actionUrl: this.agentConversationActionUrl(conversationId),
      },
    });
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
        item.kind === NotificationKind.SUPPORT &&
        (item.actionUrl?.startsWith(SUPPORT_CONVERSATION_URL_PREFIX) || item.actionUrl?.startsWith(SUPPORT_AGENT_URL_PREFIX));
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
      (notification.actionUrl?.startsWith(SUPPORT_CONVERSATION_URL_PREFIX) || notification.actionUrl?.startsWith(SUPPORT_AGENT_URL_PREFIX))
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
    if (!ADMIN_ROLES.includes(user.role)) throw new ForbiddenException();
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
    const cleanedMessage = message.trim();
    const subject = cleanedMessage.slice(0, 80) || 'Demande KHE Booth';
    const bot = this.kheAnswer(cleanedMessage);
    const status = !bot.confident || this.wantsAgent(cleanedMessage)
      ? SupportConversationStatus.HANDOFF_REQUESTED
      : SupportConversationStatus.BOT;

    const created = await this.prisma.supportConversation.create({
      data: {
        organizationId: user.organizationId,
        requesterUserId: user.id,
        subject,
        status,
        messages: {
          create: [
            { author: SupportMessageAuthor.USER, body: cleanedMessage },
            { author: SupportMessageAuthor.KHE, body: bot.answer },
          ],
        },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } }, assignedTo: { select: { id: true, email: true } } },
    });

    if (status === SupportConversationStatus.HANDOFF_REQUESTED) {
      await this.notifyAgents(
        user,
        created.id,
        'Nouvelle demande pour le support KHE',
        `Une conversation nécessite l’intervention de l’équipe : ${subject}`,
      );
    }
    return created;
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
    const cleanedBody = body.trim();
    const fromAgent = conversation.requesterUserId !== user.id && this.isAgent(user);

    if (fromAgent) {
      await this.prisma.$transaction([
        this.prisma.supportMessage.create({
          data: { conversationId, author: SupportMessageAuthor.AGENT, userId: user.id, body: cleanedBody },
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
            body: cleanedBody.length > 180 ? `${cleanedBody.slice(0, 177)}…` : cleanedBody,
            actionUrl: this.conversationActionUrl(conversationId),
          },
        }),
      ]);
      return this.getConversation(user, conversationId);
    }

    await this.prisma.supportMessage.create({
      data: { conversationId, author: SupportMessageAuthor.USER, body: cleanedBody },
    });

    let shouldNotifyAgents = false;
    if (conversation.status === SupportConversationStatus.BOT) {
      const bot = this.kheAnswer(cleanedBody);
      const handoff = !bot.confident || this.wantsAgent(cleanedBody);
      await this.prisma.supportMessage.create({
        data: { conversationId, author: SupportMessageAuthor.KHE, body: bot.answer },
      });
      await this.prisma.supportConversation.update({
        where: { id: conversationId },
        data: {
          status: handoff ? SupportConversationStatus.HANDOFF_REQUESTED : SupportConversationStatus.BOT,
          lastMessageAt: new Date(),
        },
      });
      shouldNotifyAgents = handoff;
    } else {
      const reopening = conversation.status === SupportConversationStatus.RESOLVED;
      await this.prisma.supportConversation.update({
        where: { id: conversationId },
        data: {
          status: reopening ? SupportConversationStatus.HANDOFF_REQUESTED : conversation.status,
          lastMessageAt: new Date(),
        },
      });
      shouldNotifyAgents = true;
    }

    if (shouldNotifyAgents) {
      await this.notifyAgents(
        user,
        conversationId,
        'Nouveau message pour le support KHE',
        cleanedBody.length > 180 ? `${cleanedBody.slice(0, 177)}…` : cleanedBody,
      );
    }
    return this.getConversation(user, conversationId);
  }

  async requestAgent(user: AuthenticatedUser, conversationId: string) {
    const conversation = await this.getConversation(user, conversationId);
    if (conversation.requesterUserId !== user.id) throw new ForbiddenException();
    if (
      conversation.status === SupportConversationStatus.HANDOFF_REQUESTED ||
      conversation.status === SupportConversationStatus.ASSIGNED
    ) {
      return conversation;
    }
    await this.prisma.supportMessage.create({
      data: { conversationId, author: SupportMessageAuthor.SYSTEM, body: 'Transfert demandé à un agent KHE.' },
    });
    const updated = await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { status: SupportConversationStatus.HANDOFF_REQUESTED, lastMessageAt: new Date() },
    });
    await this.notifyAgents(
      user,
      conversationId,
      'Transfert demandé à un agent KHE',
      `Une conversation attend une prise en charge : ${conversation.subject}`,
    );
    return updated;
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
    const updated = await this.prisma.supportConversation.update({
      where: { id: conversationId },
      data: { assignedToUserId, status: SupportConversationStatus.ASSIGNED },
    });
    await this.prisma.appNotification.create({
      data: {
        organizationId: user.organizationId,
        kind: NotificationKind.SUPPORT,
        title: 'Votre demande KHE est prise en charge',
        body: 'Un agent KHE a pris en charge votre conversation.',
        actionUrl: this.conversationActionUrl(conversationId),
      },
    });
    return updated;
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
