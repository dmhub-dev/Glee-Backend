-- CreateTable
CREATE TABLE "ticket_check_ins" (
    "id" TEXT NOT NULL,
    "eventTicketId" TEXT NOT NULL,
    "ticketRef" TEXT NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "checkedInById" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_check_ins_ticketRef_key" ON "ticket_check_ins"("ticketRef");

-- CreateIndex
CREATE INDEX "ticket_check_ins_eventTicketId_idx" ON "ticket_check_ins"("eventTicketId");

-- CreateIndex
CREATE INDEX "ticket_check_ins_checkedInById_idx" ON "ticket_check_ins"("checkedInById");

-- CreateIndex
CREATE INDEX "ticket_check_ins_checkedInAt_idx" ON "ticket_check_ins"("checkedInAt");

-- AddForeignKey
ALTER TABLE "ticket_check_ins" ADD CONSTRAINT "ticket_check_ins_eventTicketId_fkey" FOREIGN KEY ("eventTicketId") REFERENCES "event_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_check_ins" ADD CONSTRAINT "ticket_check_ins_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
