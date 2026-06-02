ALTER TABLE "event_tickets"
  ADD COLUMN "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "outstandingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "paymentDueDate" TIMESTAMP(3),
  ADD COLUMN "paymentPlan" JSONB;

UPDATE "event_tickets"
SET "amountPaid" = "totalPrice"
WHERE "amountPaid" = 0;
