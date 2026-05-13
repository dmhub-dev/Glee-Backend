import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class BookingSharedService {
  constructor(private readonly prisma: PrismaService) {}

  async helperBookingFindById(id: string) {
    return this.prisma.booking.findFirst({
      where: { id, isDeleted: false },
      include: { vendor: true },
    });
  }

  async calculateBookingsEarning(bookingId: string) {
    const items = await this.prisma.purchasedBooking.findMany({
      where: { bookingId },
      include: { payment: true },
    });
    if (!items.length) return [];
    const grandTotal = items.reduce((sum, t) => sum + Number(t.payment?.totalPrice ?? 0), 0);
    return [{ _id: bookingId, grandTotal, adminEarning: 0, vendorEarning: grandTotal }];
  }
}
