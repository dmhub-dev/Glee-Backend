import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EmailService } from '@src/email-server/email.service';
import { loggers } from '@src/interceptors/logger.enums';
import { NotificationService } from '@src/notification/notification.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { PayStackService } from '@src/paystack/paystack.service';
import { PurchasingType } from '@src/paystack/paystack.types';
import { SocketGateway } from '@src/socket/socket.gateway';
import moment from 'moment';
import * as path from 'path';
import { BookingSharedService } from '../shared/shared.bookings.service';
import { UsersService } from 'src/users/users.service';
import { GetBookingsDataDto } from './dto/public.purchased-booking.dto';

const PURCHASED_BOOKING_INCLUDE = {
  user: { include: { country: true, city: true, state: true } },
  booking: { include: { category: true, vendor: true } },
  payment: true,
};

export class CreatePurchaseBookingPaystackDto {
  bookingId: string;
  tableId?: string;
  bookingType?: string;
  preOrderMenu?: any[];
}

@Injectable()
export class PurchaseBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingSharedService: BookingSharedService,
    private readonly userService: UsersService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly payStackService: PayStackService,
  ) {
    // Register this service as the booking webhook handler
    this.payStackService.purchaseBookingHandler = this;
  }

  async purchase(dto: CreatePurchaseBookingPaystackDto, userId: string) {
    const booking = await this.bookingSharedService.helperBookingFindById(dto.bookingId);
    if (!booking) throw new HttpException('Booking not found', HttpStatus.BAD_REQUEST);

    const user = await this.userService.findOne({ id: userId });
    if (!user) throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);

    let price = Number(booking.price);
    if (dto.tableId) {
      const table = await this.prisma.bookingTable.findFirst({ where: { id: dto.tableId } });
      if (!table) throw new HttpException('Table not found', HttpStatus.BAD_REQUEST);
      if (table.status === 'booked') throw new HttpException('Table already booked', HttpStatus.BAD_REQUEST);
    }

    const metadata = {
      purchasingType: PurchasingType.BOOKING,
      bookingId: dto.bookingId,
      bookingType: dto.bookingType ?? 'STANDARD',
      tableId: dto.tableId,
      preOrderMenu: dto.preOrderMenu,
      userId,
    };

    const paymentIntent = await this.payStackService.createPaymentIntent({
      email: user.email,
      amount: Math.round(price),
      metaData: metadata,
    });

    return { success: true, data: paymentIntent };
  }

  async createPurchasedBooking(metadata: any, paystackReference: string) {
    const existing = await this.prisma.payment.findUnique({ where: { paystackReference } });
    if (existing) return;

    const booking = await this.bookingSharedService.helperBookingFindById(metadata.bookingId);
    if (!booking) return;

    const price = Number(booking.price);

    const payment = await this.prisma.payment.create({
      data: {
        userId: metadata.userId,
        paystackReference,
        paymentStatus: 'SUCCEEDED',
        paymentMethod: 'PAYSTACK',
        totalPrice: new Decimal(price),
        perItemPrice: new Decimal(price),
        isPaid: true,
        isAvailable: false,
      },
    });

    if (metadata.tableId) {
      await this.prisma.bookingTable.update({ where: { id: metadata.tableId }, data: { status: 'booked' } });
    }

    const purchasedBooking = await this.prisma.purchasedBooking.create({
      data: {
        bookingId: metadata.bookingId,
        userId: metadata.userId,
        paymentId: payment.id,
        bookingType: metadata.bookingType ?? 'STANDARD',
        tableId: metadata.tableId,
        preOrderMenu: metadata.preOrderMenu,
      },
    });

    const admin = await this.prisma.user.findFirst({ where: { role: { name: 'ADMIN' }, isDeleted: false } });
    const user = await this.userService.findOne({ id: metadata.userId });

    try {
      const notification = await this.notificationService.addNotification({
        notificationType: NotificationType.BOOKING,
        orderModel: 'PurchasedBooking',
        orderPayload: purchasedBooking.id,
        body: `A new Booking has been purchased by ${user?.name}.`,
      } as any);

      SocketGateway.emitEvent('notification', {
        notificationType: NotificationType.BOOKING,
        body: `A new Booking has been purchased by ${user?.name}.`,
        orderPayload: purchasedBooking.id,
        _id: (notification as any)?.id,
      }, admin?.id);
    } catch (e) {
      loggers.error('Notification error: %O', e);
    }

    try {
      await this.emailService.sendMail({
        template: 'event-ticket',
        message: {
          to: [admin?.email, user?.email].filter(Boolean),
          subject: 'New Booking Purchased',
          attachments: [{ filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' }],
        },
        locals: {
          purchasedOn: moment().format('MMMM DD,YYYY'),
          userEmail: user?.email,
          userName: user?.name,
          productId: booking.id,
          productTitle: booking.name,
          total: price,
          subTotal: price,
          noOfItems: 1,
          productImage: booking.photos?.[0],
          orderType: 'Booking',
        },
      });
    } catch (e) {
      loggers.error('Email error: %O', e);
    }
  }

  async createDepositPurchasedBookingViaPaystack(data: any) {
    return this.createPurchasedBooking(data.metadata, data.reference);
  }

  async getPurchasedBookings(getbookingssDataDto: GetBookingsDataDto, userId?: string) {
    const { page, limit } = getbookingssDataDto;
    const where: any = {};
    if (userId) where.userId = userId;
    if ((getbookingssDataDto as any).bookingId) where.bookingId = (getbookingssDataDto as any).bookingId;

    const [purchasedBookings, purchasedBookingsCount] = await Promise.all([
      this.prisma.purchasedBooking.findMany({
        where,
        include: PURCHASED_BOOKING_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchasedBooking.count({ where }),
    ]);

    if (purchasedBookings.length === 0) return { success: false, msg: 'No bookings purchased yet', data: [] };

    return {
      success: true,
      msg: 'Purchased bookings fetched successfully',
      data: purchasedBookings,
      page,
      limit,
      totalPages: Math.ceil(purchasedBookingsCount / limit),
    };
  }

  async getPurchasedBooking(id: string, userId?: string) {
    const where: any = { bookingId: id };
    if (userId) where.userId = userId;

    const purchasedData = await this.prisma.purchasedBooking.findFirst({
      where,
      include: PURCHASED_BOOKING_INCLUDE,
    });

    if (!purchasedData) return { success: true, message: 'You have not purchased this booking yet.', data: {} };
    return { success: true, message: 'Purchased booking fetched successfully', data: purchasedData };
  }
}
