-- Store event schedules as event-level itinerary summaries.

ALTER TABLE "event_schedules"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "endDate" TIMESTAMP(3);

UPDATE "event_schedules"
SET
  "name" = COALESCE("title", 'Event Schedule'),
  "startDate" = "startsAt",
  "endDate" = COALESCE("endsAt", "startsAt");

DROP INDEX IF EXISTS "event_schedules_startsAt_idx";
CREATE INDEX "event_schedules_startDate_idx" ON "event_schedules"("startDate");

ALTER TABLE "event_schedules"
  ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "startDate" SET NOT NULL,
  ALTER COLUMN "endDate" SET NOT NULL,
  DROP COLUMN "title",
  DROP COLUMN "startsAt",
  DROP COLUMN "endsAt",
  DROP COLUMN "sortOrder";
