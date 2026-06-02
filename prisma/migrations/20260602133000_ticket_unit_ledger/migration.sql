-- Ticket unit ledger: each EventTicket row represents one scannable QR ticket.

CREATE TYPE "TicketStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');

DROP INDEX IF EXISTS "event_tickets_paymentId_key";

ALTER TABLE "event_tickets"
  ADD COLUMN "purchaseGroupId" TEXT,
  ADD COLUMN "ticketRef" TEXT,
  ADD COLUMN "ticketNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "status" "TicketStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "guestName" TEXT,
  ADD COLUMN "guestEmail" TEXT,
  ADD COLUMN "guestPhone" TEXT;

UPDATE "event_tickets" et
SET
  "purchaseGroupId" = et.id,
  "ticketRef" = COALESCE(
    (
      SELECT tci."ticketRef"
      FROM "ticket_check_ins" tci
      WHERE tci."eventTicketId" = et.id AND tci."ticketNumber" = 1
      LIMIT 1
    ),
    et.id || '-1'
  ),
  "status" = CASE
    WHEN et."checkedInAt" IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM "ticket_check_ins" tci
        WHERE tci."eventTicketId" = et.id AND tci."ticketNumber" = 1
      )
    THEN 'USED'::"TicketStatus"
    ELSE 'ACTIVE'::"TicketStatus"
  END,
  "checkedInAt" = COALESCE(
    (
      SELECT tci."checkedInAt"
      FROM "ticket_check_ins" tci
      WHERE tci."eventTicketId" = et.id AND tci."ticketNumber" = 1
      LIMIT 1
    ),
    et."checkedInAt"
  ),
  "checkedInById" = COALESCE(
    (
      SELECT tci."checkedInById"
      FROM "ticket_check_ins" tci
      WHERE tci."eventTicketId" = et.id AND tci."ticketNumber" = 1
      LIMIT 1
    ),
    et."checkedInById"
  );

INSERT INTO "event_tickets" (
  id,
  "eventId",
  "userId",
  "paymentId",
  "ticketCategoryId",
  "checkedInById",
  "purchaseGroupId",
  "ticketRef",
  "ticketNumber",
  status,
  quantity,
  "totalPrice",
  "amountPaid",
  "outstandingAmount",
  "paymentDueDate",
  "paymentPlan",
  "preOrderMenu",
  "checkedInAt",
  "createdAt",
  "updatedAt",
  "guestName",
  "guestEmail",
  "guestPhone"
)
SELECT
  et.id || '-' || gs.n,
  et."eventId",
  et."userId",
  et."paymentId",
  et."ticketCategoryId",
  tci."checkedInById",
  et.id,
  COALESCE(tci."ticketRef", et.id || '-' || gs.n),
  gs.n,
  CASE WHEN tci.id IS NOT NULL THEN 'USED'::"TicketStatus" ELSE 'ACTIVE'::"TicketStatus" END,
  1,
  ROUND((et."totalPrice" / NULLIF(et.quantity, 0))::numeric, 2),
  ROUND((et."amountPaid" / NULLIF(et.quantity, 0))::numeric, 2),
  ROUND((et."outstandingAmount" / NULLIF(et.quantity, 0))::numeric, 2),
  et."paymentDueDate",
  et."paymentPlan",
  et."preOrderMenu",
  tci."checkedInAt",
  et."createdAt",
  et."updatedAt",
  NULL,
  NULL,
  NULL
FROM "event_tickets" et
JOIN LATERAL generate_series(2, GREATEST(et.quantity, 1)) AS gs(n) ON TRUE
LEFT JOIN "ticket_check_ins" tci
  ON tci."eventTicketId" = et.id AND tci."ticketNumber" = gs.n
WHERE et.quantity > 1;

UPDATE "event_tickets"
SET
  "totalPrice" = ROUND(("totalPrice" / NULLIF(quantity, 0))::numeric, 2),
  "amountPaid" = ROUND(("amountPaid" / NULLIF(quantity, 0))::numeric, 2),
  "outstandingAmount" = ROUND(("outstandingAmount" / NULLIF(quantity, 0))::numeric, 2),
  quantity = 1
WHERE quantity > 1;

ALTER TABLE "event_tickets"
  ALTER COLUMN "purchaseGroupId" SET NOT NULL,
  ALTER COLUMN "ticketRef" SET NOT NULL;

CREATE UNIQUE INDEX "event_tickets_ticketRef_key" ON "event_tickets"("ticketRef");
CREATE INDEX "event_tickets_purchaseGroupId_idx" ON "event_tickets"("purchaseGroupId");
CREATE INDEX "event_tickets_status_idx" ON "event_tickets"("status");
