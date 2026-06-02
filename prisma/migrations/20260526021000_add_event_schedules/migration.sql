-- Per-event schedule rows for single-day and multi-day event programs.

CREATE TABLE "event_schedules" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "event_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_schedules_eventId_idx" ON "event_schedules"("eventId");
CREATE INDEX "event_schedules_startsAt_idx" ON "event_schedules"("startsAt");

ALTER TABLE "event_schedules"
  ADD CONSTRAINT "event_schedules_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
