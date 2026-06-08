ALTER TABLE "Event" ADD COLUMN "endedAt" TIMESTAMP(3);

UPDATE "Event"
SET "endedAt" = COALESCE("endDate", "updatedAt", "createdAt")
WHERE "status" = 'ENDED'::"EventStatus"
  AND "endedAt" IS NULL;

CREATE INDEX "Event_endedAt_idx" ON "Event"("endedAt");
