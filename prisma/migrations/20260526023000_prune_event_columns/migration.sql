-- Remove denormalized/legacy Event columns now represented by relations or computed state.

UPDATE "Event"
SET "photos" = COALESCE("photos", ARRAY[]::TEXT[]) || COALESCE("bannerImages", ARRAY[]::TEXT[]);

ALTER TABLE "Event"
  DROP COLUMN "price",
  DROP COLUMN "maxTicketPurchased",
  DROP COLUMN "availableTickets",
  DROP COLUMN "locationName",
  DROP COLUMN "city",
  DROP COLUMN "state",
  DROP COLUMN "country",
  DROP COLUMN "latitude",
  DROP COLUMN "longitude",
  DROP COLUMN "bannerImages",
  DROP COLUMN "floorPlan",
  DROP COLUMN "suspended",
  DROP COLUMN "deletedAt";
