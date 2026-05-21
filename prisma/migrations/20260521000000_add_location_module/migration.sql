-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isIndoors" BOOLEAN NOT NULL DEFAULT false,
    "isOutdoors" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "floorPlanImageUrl" TEXT,
    "isParkingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add new columns to Event first, preserve location string data
ALTER TABLE "Event" ADD COLUMN "locationId" TEXT;
ALTER TABLE "Event" ADD COLUMN "locationName" TEXT;
UPDATE "Event" SET "locationName" = "location" WHERE "location" IS NOT NULL;
ALTER TABLE "Event" DROP COLUMN "location";

-- AlterTable
ALTER TABLE "Media" ADD COLUMN "locationId" TEXT;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
