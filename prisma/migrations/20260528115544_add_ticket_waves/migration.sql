-- CreateEnum
CREATE TYPE "TicketWaveStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ticket_categories" ADD COLUMN     "waveId" TEXT;

-- AlterTable
ALTER TABLE "user_invitations" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ticket_waves" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "TicketWaveStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_waves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_waves_eventId_sequence_idx" ON "ticket_waves"("eventId", "sequence");

-- CreateIndex
CREATE INDEX "ticket_waves_eventId_status_idx" ON "ticket_waves"("eventId", "status");

-- CreateIndex
CREATE INDEX "ticket_waves_startsAt_endsAt_idx" ON "ticket_waves"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ticket_categories_waveId_idx" ON "ticket_categories"("waveId");

-- AddForeignKey
ALTER TABLE "ticket_waves" ADD CONSTRAINT "ticket_waves_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "ticket_waves"("id") ON DELETE CASCADE ON UPDATE CASCADE;
