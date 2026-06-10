-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('CLUB', 'RESTAURANT', 'HOTEL_RESTAURANT', 'LOUNGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReservationDepositType" AS ENUM ('FLAT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('VENUE', 'EVENT');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'SEATED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReservationPaymentMethod" AS ENUM ('WALLET', 'PAYSTACK');

-- CreateEnum
CREATE TYPE "ReservationPaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bookingRules" TEXT,
ADD COLUMN     "cancellationCutoffHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
ADD COLUMN     "venueType" "VenueType" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "location_tables" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "minGuests" INTEGER NOT NULL DEFAULT 1,
    "maxGuests" INTEGER NOT NULL,
    "minimumSpend" DECIMAL(10,2) NOT NULL,
    "depositType" "ReservationDepositType" NOT NULL DEFAULT 'FLAT',
    "depositValue" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_slots" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_reservation_slots" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_reservation_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "eventId" TEXT,
    "tableId" TEXT NOT NULL,
    "slotId" TEXT,
    "eventSlotId" TEXT,
    "reservationDate" TIMESTAMP(3) NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "tableCategory" TEXT NOT NULL,
    "minimumSpend" DECIMAL(10,2) NOT NULL,
    "depositAmount" DECIMAL(10,2) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "source" "ReservationSource" NOT NULL DEFAULT 'VENUE',
    "cancelBefore" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_payments" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "ReservationPaymentMethod" NOT NULL,
    "status" "ReservationPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_tables_locationId_idx" ON "location_tables"("locationId");

-- CreateIndex
CREATE INDEX "location_tables_locationId_category_idx" ON "location_tables"("locationId", "category");

-- CreateIndex
CREATE INDEX "location_tables_isActive_idx" ON "location_tables"("isActive");

-- CreateIndex
CREATE INDEX "reservation_slots_locationId_idx" ON "reservation_slots"("locationId");

-- CreateIndex
CREATE INDEX "reservation_slots_isActive_idx" ON "reservation_slots"("isActive");

-- CreateIndex
CREATE INDEX "event_reservation_slots_eventId_idx" ON "event_reservation_slots"("eventId");

-- CreateIndex
CREATE INDEX "event_reservation_slots_startDateTime_endDateTime_idx" ON "event_reservation_slots"("startDateTime", "endDateTime");

-- CreateIndex
CREATE INDEX "event_reservation_slots_isActive_idx" ON "event_reservation_slots"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_reference_key" ON "reservations"("reference");

-- CreateIndex
CREATE INDEX "reservations_userId_idx" ON "reservations"("userId");

-- CreateIndex
CREATE INDEX "reservations_locationId_idx" ON "reservations"("locationId");

-- CreateIndex
CREATE INDEX "reservations_eventId_idx" ON "reservations"("eventId");

-- CreateIndex
CREATE INDEX "reservations_tableId_idx" ON "reservations"("tableId");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_startDateTime_endDateTime_idx" ON "reservations"("startDateTime", "endDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_payments_reference_key" ON "reservation_payments"("reference");

-- CreateIndex
CREATE INDEX "reservation_payments_reservationId_idx" ON "reservation_payments"("reservationId");

-- CreateIndex
CREATE INDEX "reservation_payments_userId_idx" ON "reservation_payments"("userId");

-- CreateIndex
CREATE INDEX "reservation_payments_status_idx" ON "reservation_payments"("status");

-- AddForeignKey
ALTER TABLE "location_tables" ADD CONSTRAINT "location_tables_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_slots" ADD CONSTRAINT "reservation_slots_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reservation_slots" ADD CONSTRAINT "event_reservation_slots_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "location_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "reservation_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_eventSlotId_fkey" FOREIGN KEY ("eventSlotId") REFERENCES "event_reservation_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_payments" ADD CONSTRAINT "reservation_payments_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_payments" ADD CONSTRAINT "reservation_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
