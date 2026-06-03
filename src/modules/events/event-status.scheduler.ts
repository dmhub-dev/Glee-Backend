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
      await this.prisma.event.updateMany({
        where: {
          isDeleted: false,
          status: EventStatus.ACTIVE,
          startDate: { not: null, lte: now },
        },
        data: { status: EventStatus.LIVE },
      });

      const eventsToEnd = await this.prisma.event.findMany({
        where: {
          isDeleted: false,
          status: EventStatus.LIVE,
          endDate: { not: null, lte: now },
        },
        select: { id: true },
      });

      if (!eventsToEnd.length) return;

      for (const event of eventsToEnd) {
        await this.prisma.$transaction(async (tx) => {
          await tx.event.update({
            where: { id: event.id },
            data: { status: EventStatus.ENDED },
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
