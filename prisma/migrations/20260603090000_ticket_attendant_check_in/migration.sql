-- Ticket attendant check-in support.

ALTER TYPE "EventStatus" ADD VALUE 'LIVE' AFTER 'ACTIVE';
ALTER TYPE "EventStatus" ADD VALUE 'ENDED' AFTER 'LIVE';

CREATE TYPE "TicketAttendantStatus" AS ENUM ('INVITED', 'ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "TicketCheckInAttemptResult" AS ENUM ('SUCCESS', 'DUPLICATE', 'WRONG_EVENT', 'EXPIRED', 'CANCELLED', 'UNKNOWN', 'NOT_LIVE');
CREATE TYPE "TicketCheckInAttemptSource" AS ENUM ('QR', 'MANUAL');

ALTER TABLE "event_tickets" ADD COLUMN "checkedInByAttendantId" TEXT;

CREATE TABLE "event_ticket_attendants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "inviteTokenHash" TEXT NOT NULL,
    "status" "TicketAttendantStatus" NOT NULL DEFAULT 'INVITED',
    "lastSessionId" TEXT,
    "sessionActive" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "event_ticket_attendants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_ticket_attendant_sessions" (
    "id" TEXT NOT NULL,
    "attendantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "event_ticket_attendant_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ticket_check_in_attempts" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketId" TEXT,
    "attendantId" TEXT,
    "platformUserId" TEXT,
    "result" "TicketCheckInAttemptResult" NOT NULL,
    "source" "TicketCheckInAttemptSource" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_check_in_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_ticket_attendants_inviteTokenHash_key" ON "event_ticket_attendants"("inviteTokenHash");
CREATE INDEX "event_ticket_attendants_eventId_idx" ON "event_ticket_attendants"("eventId");
CREATE INDEX "event_ticket_attendants_email_idx" ON "event_ticket_attendants"("email");
CREATE INDEX "event_ticket_attendants_status_idx" ON "event_ticket_attendants"("status");

CREATE UNIQUE INDEX "event_ticket_attendant_sessions_sessionTokenHash_key" ON "event_ticket_attendant_sessions"("sessionTokenHash");
CREATE UNIQUE INDEX "event_ticket_attendant_sessions_one_active_idx" ON "event_ticket_attendant_sessions"("attendantId") WHERE "revokedAt" IS NULL;
CREATE INDEX "event_ticket_attendant_sessions_attendantId_idx" ON "event_ticket_attendant_sessions"("attendantId");
CREATE INDEX "event_ticket_attendant_sessions_eventId_idx" ON "event_ticket_attendant_sessions"("eventId");
CREATE INDEX "event_ticket_attendant_sessions_expiresAt_idx" ON "event_ticket_attendant_sessions"("expiresAt");

CREATE INDEX "ticket_check_in_attempts_eventId_idx" ON "ticket_check_in_attempts"("eventId");
CREATE INDEX "ticket_check_in_attempts_ticketId_idx" ON "ticket_check_in_attempts"("ticketId");
CREATE INDEX "ticket_check_in_attempts_attendantId_idx" ON "ticket_check_in_attempts"("attendantId");
CREATE INDEX "ticket_check_in_attempts_result_idx" ON "ticket_check_in_attempts"("result");
CREATE INDEX "ticket_check_in_attempts_createdAt_idx" ON "ticket_check_in_attempts"("createdAt");

CREATE INDEX "event_tickets_checkedInByAttendantId_idx" ON "event_tickets"("checkedInByAttendantId");

ALTER TABLE "event_ticket_attendants" ADD CONSTRAINT "event_ticket_attendants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_ticket_attendants" ADD CONSTRAINT "event_ticket_attendants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "event_ticket_attendant_sessions" ADD CONSTRAINT "event_ticket_attendant_sessions_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "event_ticket_attendants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_ticket_attendant_sessions" ADD CONSTRAINT "event_ticket_attendant_sessions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ticket_check_in_attempts" ADD CONSTRAINT "ticket_check_in_attempts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_check_in_attempts" ADD CONSTRAINT "ticket_check_in_attempts_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "event_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ticket_check_in_attempts" ADD CONSTRAINT "ticket_check_in_attempts_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "event_ticket_attendants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ticket_check_in_attempts" ADD CONSTRAINT "ticket_check_in_attempts_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_checkedInByAttendantId_fkey" FOREIGN KEY ("checkedInByAttendantId") REFERENCES "event_ticket_attendants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
