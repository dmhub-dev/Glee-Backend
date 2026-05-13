import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import * as moment from 'moment';

@Injectable()
export class CommonApi {
  constructor(private readonly prisma: PrismaService) {}

  async appSearchApi(search: string) {
    const searchFilter = {
      contains: search,
      mode: 'insensitive' as const,
    };

    const [events, services, bookings] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          AND: [
            { name: searchFilter },
            { endDate: { gte: moment().toDate() } },
            { isDeleted: false },
          ],
        },
        select: {
          id: true,
          name: true,
          price: true,
          location: true,
          startDate: true,
          endDate: true,
          bannerImages: true,
        },
        take: 10,
      }),
      this.prisma.service.findMany({
        where: {
          AND: [{ name: searchFilter }, { isDeleted: false }],
        },
        include: { vendor: { select: { name: true } } },
        take: 10,
      }),
      this.prisma.booking.findMany({
        where: {
          AND: [{ name: searchFilter }, { isDeleted: false }],
        },
        select: {
          id: true,
          name: true,
          price: true,
          address: true,
          capacity: true,
          photos: true,
        },
        take: 10,
      }),
    ]);

    return {
      success: true,
      data: {
        events,
        services,
        bookings,
      },
    };
  }

  async dashboardStates() {
    const [eventCount, serviceCount, bookingCount, userCount] = await Promise.all([
      this.prisma.event.count({ where: { isDeleted: false } }),
      this.prisma.service.count({ where: { isDeleted: false } }),
      this.prisma.booking.count({ where: { isDeleted: false } }),
      this.prisma.user.count({ where: { isDeleted: false } }),
    ]);

    const [eventTickets, purchasedServices, purchasedBookings] = await Promise.all([
      this.prisma.eventTicket.findMany({
        where: { event: { isDeleted: false } },
        select: { totalPrice: true },
      }),
      this.prisma.purchasedService.findMany({
        include: { payment: true },
      }),
      this.prisma.purchasedBooking.findMany({
        include: { payment: true },
      }),
    ]);

    const eventEarning = eventTickets.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const serviceEarning = purchasedServices.reduce((sum, item) => sum + Number(item.payment?.totalPrice ?? 0), 0);
    const bookingEarning = purchasedBookings.reduce((sum, item) => sum + Number(item.payment?.totalPrice ?? 0), 0);

    return {
      success: true,
      data: {
        eventCount,
        serviceCount,
        bookingCount,
        userCount,
        earning: eventEarning + serviceEarning + bookingEarning,
      },
    };
  }
}
