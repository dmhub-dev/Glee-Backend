-- Event ticket check-in support for vendor staff

ALTER TABLE "event_tickets"
  ADD COLUMN "checkedInById" TEXT,
  ADD COLUMN "checkedInAt" TIMESTAMP(3);

CREATE INDEX "event_tickets_checkedInById_idx" ON "event_tickets"("checkedInById");
CREATE INDEX "event_tickets_checkedInAt_idx" ON "event_tickets"("checkedInAt");

ALTER TABLE "event_tickets"
  ADD CONSTRAINT "event_tickets_checkedInById_fkey"
  FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
