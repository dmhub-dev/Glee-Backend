-- Event-specific status lifecycle and required capacity counts.

CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'ACTIVE', 'POSTPONED', 'CANCELLED', 'SOLD_OUT');

UPDATE "Event"
SET
  "capacity" = COALESCE("capacity", 0),
  "availableTickets" = COALESCE("availableTickets", COALESCE("capacity", 0));

ALTER TABLE "Event"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "EventStatus"
    USING (
      CASE "status"::text
        WHEN 'ACTIVE' THEN 'ACTIVE'
        WHEN 'DONE' THEN 'ACTIVE'
        WHEN 'SUSPENDED' THEN 'POSTPONED'
        WHEN 'INACTIVE' THEN 'CANCELLED'
        ELSE 'DRAFT'
      END
    )::"EventStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "capacity" SET DEFAULT 0,
  ALTER COLUMN "capacity" SET NOT NULL,
  ALTER COLUMN "availableTickets" SET DEFAULT 0,
  ALTER COLUMN "availableTickets" SET NOT NULL;
