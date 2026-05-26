-- Vendor-owned locations. NULL vendorId means Glee/admin shared location.
ALTER TABLE "locations"
  ADD COLUMN "vendorId" TEXT;

CREATE INDEX "locations_vendorId_idx" ON "locations"("vendorId");

ALTER TABLE "locations"
  ADD CONSTRAINT "locations_vendorId_fkey"
  FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
