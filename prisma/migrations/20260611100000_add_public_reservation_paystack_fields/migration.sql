ALTER TABLE "reservations" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "reservation_payments" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_no_table_overlap_active";

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_no_table_overlap_active" EXCLUDE USING gist (
    "tableId" WITH =,
    tsrange("startDateTime", "endDateTime", '[)') WITH &&
) WHERE ("status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'SEATED'));

ALTER TABLE "reservations"
ADD COLUMN "guestName" TEXT,
ADD COLUMN "guestEmail" TEXT,
ADD COLUMN "guestPhone" TEXT,
ADD COLUMN "publicAccessToken" TEXT;

CREATE UNIQUE INDEX "reservations_publicAccessToken_key"
ON "reservations"("publicAccessToken");
