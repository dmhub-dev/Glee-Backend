import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';

export interface IPaginationOptions {
  page?: number;
  limit?: number;
}

export interface IFetchEventTicketOptions {
  skipPopulates?: string[];
  populateAll?: boolean;
  populate?: any[];
}

@Injectable()
export class EventSharedService {
  constructor(private readonly prisma: PrismaService) {}

  async getEventTicketsData(filter: any, pagination?: IPaginationOptions, _options?: IFetchEventTicketOptions) {
    const skip = pagination?.page && pagination?.limit ? (pagination.page - 1) * pagination.limit : 0;
    const take = pagination?.limit;
    return this.prisma.eventTicket.findMany({
      where: filter,
      include: {
        user: { include: { country: true, city: true, state: true } },
        payment: true,
        event: { include: { category: true, vendor: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async helperEventTicketUpdateMany(filter: any, _update: any) {
    // EventTicket has no soft-delete fields in new schema; delete permanently on cascade
    return this.prisma.eventTicket.deleteMany({ where: filter });
  }

  async helperGetEventParticipants(filter: { eventId: string; userId: string }, me: any) {
    const tickets = await this.prisma.eventTicket.findMany({
      where: { eventId: filter.eventId, userId: { not: filter.userId } },
      distinct: ['userId'],
      include: {
        user: { include: { blockedUsers: true, blockedByUsers: true } },
      },
    });

    const blockedByMeIds: string[] = (me.blockedUsers ?? []).map((b: any) => b.blockedId);

    const data = tickets.map(t => ({
      ...t.user,
      blockedByMe: blockedByMeIds.includes(t.user.id),
      blockedByHim: t.user.blockedByUsers.some((b: any) => b.blockerId === me.id),
      unReadCount: 0,
    }));

    return { data, count: data.length };
  }

  async helperEventFindById(id: string) {
    return this.prisma.event.findFirst({
      where: { id, isDeleted: false },
      include: { vendor: true },
    });
  }

  async helperSingleEventFilter(filter: any) {
    const where: any = {};
    if (filter._id || filter.id) where.id = filter._id ?? filter.id;
    if (filter.isDeleted !== undefined) where.isDeleted = filter.isDeleted;
    if (filter.status) where.status = filter.status;
    return this.prisma.event.findFirst({ where });
  }

  async getUserPurchasedEventList(userId: string, eventId?: string) {
    const where: any = { userId };
    if (eventId) where.eventId = eventId;
    return this.prisma.eventTicket.findMany({
      where,
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async calculateEventEarning(eventId: string) {
    const tickets = await this.prisma.eventTicket.findMany({
      where: { eventId },
      include: { payment: true },
    });
    if (!tickets.length) return [];
    const grandTotal = tickets.reduce((sum, t) => sum + Number(t.payment?.totalPrice ?? 0), 0);
    return [{ _id: eventId, grandTotal, adminEarning: 0, vendorEarning: grandTotal }];
  }
}
