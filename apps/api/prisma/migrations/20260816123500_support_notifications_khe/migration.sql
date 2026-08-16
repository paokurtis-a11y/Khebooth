CREATE TYPE "NotificationKind" AS ENUM ('UPDATE', 'NEWS', 'SUPPORT', 'SYSTEM');
CREATE TYPE "SupportConversationStatus" AS ENUM ('BOT', 'HANDOFF_REQUESTED', 'ASSIGNED', 'RESOLVED');
CREATE TYPE "SupportMessageAuthor" AS ENUM ('USER', 'KHE', 'AGENT', 'SYSTEM');
CREATE TYPE "SupportTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

ALTER TABLE "User"
  ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "productUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "supportNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "AppNotification" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "kind" "NotificationKind" NOT NULL DEFAULT 'NEWS',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionUrl" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationRead" (
  "id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportConversation" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "requesterUserId" UUID NOT NULL,
  "assignedToUserId" UUID,
  "subject" TEXT NOT NULL,
  "status" "SupportConversationStatus" NOT NULL DEFAULT 'BOT',
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
  "id" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "author" "SupportMessageAuthor" NOT NULL,
  "userId" UUID,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTask" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "status" "SupportTaskStatus" NOT NULL DEFAULT 'TODO',
  "assignedToUserId" UUID,
  "createdByUserId" UUID NOT NULL,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationRead_notificationId_userId_key" ON "NotificationRead"("notificationId", "userId");
CREATE INDEX "AppNotification_organizationId_publishedAt_idx" ON "AppNotification"("organizationId", "publishedAt");
CREATE INDEX "NotificationRead_userId_readAt_idx" ON "NotificationRead"("userId", "readAt");
CREATE INDEX "SupportConversation_organizationId_status_lastMessageAt_idx" ON "SupportConversation"("organizationId", "status", "lastMessageAt");
CREATE INDEX "SupportConversation_requesterUserId_lastMessageAt_idx" ON "SupportConversation"("requesterUserId", "lastMessageAt");
CREATE INDEX "SupportConversation_assignedToUserId_status_idx" ON "SupportConversation"("assignedToUserId", "status");
CREATE INDEX "SupportMessage_conversationId_createdAt_idx" ON "SupportMessage"("conversationId", "createdAt");
CREATE INDEX "SupportTask_organizationId_status_idx" ON "SupportTask"("organizationId", "status");
CREATE INDEX "SupportTask_conversationId_idx" ON "SupportTask"("conversationId");
CREATE INDEX "SupportTask_assignedToUserId_status_idx" ON "SupportTask"("assignedToUserId", "status");

ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "AppNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTask" ADD CONSTRAINT "SupportTask_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTask" ADD CONSTRAINT "SupportTask_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTask" ADD CONSTRAINT "SupportTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTask" ADD CONSTRAINT "SupportTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
