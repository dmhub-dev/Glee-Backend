CREATE TYPE "EventChatRoomStatus" AS ENUM ('ACTIVE', 'READ_ONLY', 'LOCKED');
CREATE TYPE "EventChatMessageType" AS ENUM ('MESSAGE', 'ANNOUNCEMENT', 'SYSTEM');

CREATE TABLE "event_chat_rooms" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "status" "EventChatRoomStatus" NOT NULL DEFAULT 'ACTIVE',
  "finalUpdatesUntil" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_chat_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_chat_messages" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "senderId" TEXT,
  "type" "EventChatMessageType" NOT NULL DEFAULT 'MESSAGE',
  "body" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  "deleteReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_chat_read_states" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadMessageId" TEXT,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "event_chat_read_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_chat_rooms_eventId_key" ON "event_chat_rooms"("eventId");
CREATE UNIQUE INDEX "event_chat_rooms_id_eventId_key" ON "event_chat_rooms"("id", "eventId");
CREATE INDEX "event_chat_rooms_status_idx" ON "event_chat_rooms"("status");
CREATE INDEX "event_chat_rooms_finalUpdatesUntil_idx" ON "event_chat_rooms"("finalUpdatesUntil");
CREATE UNIQUE INDEX "event_chat_messages_id_roomId_eventId_key" ON "event_chat_messages"("id", "roomId", "eventId");
CREATE INDEX "event_chat_messages_roomId_createdAt_idx" ON "event_chat_messages"("roomId", "createdAt");
CREATE INDEX "event_chat_messages_roomId_isPinned_createdAt_idx" ON "event_chat_messages"("roomId", "isPinned", "createdAt");
CREATE INDEX "event_chat_messages_eventId_idx" ON "event_chat_messages"("eventId");
CREATE INDEX "event_chat_messages_senderId_idx" ON "event_chat_messages"("senderId");
CREATE INDEX "event_chat_messages_deletedAt_idx" ON "event_chat_messages"("deletedAt");
CREATE UNIQUE INDEX "event_chat_read_states_roomId_userId_key" ON "event_chat_read_states"("roomId", "userId");
CREATE INDEX "event_chat_read_states_eventId_idx" ON "event_chat_read_states"("eventId");
CREATE INDEX "event_chat_read_states_userId_idx" ON "event_chat_read_states"("userId");
CREATE INDEX "event_chat_read_states_lastReadMessageId_idx" ON "event_chat_read_states"("lastReadMessageId");

ALTER TABLE "event_chat_rooms" ADD CONSTRAINT "event_chat_rooms_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_chat_messages" ADD CONSTRAINT "event_chat_messages_roomId_eventId_fkey" FOREIGN KEY ("roomId", "eventId") REFERENCES "event_chat_rooms"("id", "eventId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_chat_messages" ADD CONSTRAINT "event_chat_messages_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_chat_messages" ADD CONSTRAINT "event_chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_chat_messages" ADD CONSTRAINT "event_chat_messages_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_chat_read_states" ADD CONSTRAINT "event_chat_read_states_roomId_eventId_fkey" FOREIGN KEY ("roomId", "eventId") REFERENCES "event_chat_rooms"("id", "eventId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_chat_read_states" ADD CONSTRAINT "event_chat_read_states_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_chat_read_states" ADD CONSTRAINT "event_chat_read_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_chat_read_states" ADD CONSTRAINT "event_chat_read_states_lastReadMessageId_roomId_eventId_fkey" FOREIGN KEY ("lastReadMessageId", "roomId", "eventId") REFERENCES "event_chat_messages"("id", "roomId", "eventId") ON DELETE SET NULL ("lastReadMessageId") ON UPDATE CASCADE;
