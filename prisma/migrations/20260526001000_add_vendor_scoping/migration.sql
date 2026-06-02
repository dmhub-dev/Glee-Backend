-- Vendor ownership and vendor staff scoping

ALTER TABLE "User"
  ADD COLUMN "vendorAccountId" TEXT;

ALTER TABLE "Event"
  ADD COLUMN "vendorId" TEXT;

CREATE INDEX "User_vendorAccountId_idx" ON "User"("vendorAccountId");
CREATE INDEX "Event_vendorId_idx" ON "Event"("vendorId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_vendorAccountId_fkey"
  FOREIGN KEY ("vendorAccountId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
