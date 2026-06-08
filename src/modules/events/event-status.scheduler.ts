import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventStatus, TicketAttendantStatus } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/database/prisma.service';

@Injectable()
export class EventStatusScheduler {
  private readonly logger = new Logger(EventStatusScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async syncEventStatuses() {
    const now = new Date();

    try {
      const eventsToStart = await this.prisma.event.findMany({
        where: {
          isDeleted: false,
          status: EventStatus.ACTIVE,
          OR: [
            { startDate: { not: null, lte: now } },
            { schedules: { some: { startDate: { lte: now } } } },
          ],
        },
        select: {
          id: true,
          startDate: true,
          schedules: {
            select: { startDate: true },
            orderBy: { startDate: 'asc' },
          },
        },
      });

      for (const event of eventsToStart) {
        const effectiveStartDate =
          event.schedules?.[0]?.startDate ?? event.startDate;
        if (!effectiveStartDate || effectiveStartDate > now) continue;

        await this.prisma.event.update({
          where: { id: event.id },
          data: { status: EventStatus.LIVE },
        });
      }

      const eventsToEnd = await this.prisma.event.findMany({
        where: {
          isDeleted: false,
          status: EventStatus.LIVE,
          OR: [
            { endDate: { not: null, lte: now } },
            { schedules: { some: { endDate: { lte: now } } } },
          ],
        },
        select: {
          id: true,
          endDate: true,
          schedules: {
            select: { endDate: true },
            orderBy: { endDate: 'desc' },
          },
        },
      });

      if (!eventsToEnd.length) return;

      for (const event of eventsToEnd) {
        const effectiveEndDate =
          event.schedules?.[0]?.endDate ?? event.endDate;
        if (!effectiveEndDate || effectiveEndDate > now) continue;

        await this.prisma.$transaction(async (tx) => {
          await tx.event.update({
            where: { id: event.id },
            data: { status: EventStatus.ENDED, endedAt: effectiveEndDate },
          });

          await tx.eventTicketAttendant.updateMany({
            where: {
              eventId: event.id,
              status: {
                in: [
                  TicketAttendantStatus.INVITED,
                  TicketAttendantStatus.ACTIVE,
                ],
              },
            },
            data: {
              status: TicketAttendantStatus.EXPIRED,
              sessionActive: false,
            },
          });

          await tx.eventTicketAttendantSession.updateMany({
            where: { eventId: event.id, revokedAt: null },
            data: { revokedAt: now },
          });
        });
      }
    } catch (error) {
      this.logger.error('Failed to sync event statuses', error);
    }
  }
}
