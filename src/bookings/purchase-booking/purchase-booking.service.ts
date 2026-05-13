import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { EmailService } from '@src/email-server/email.service';
import { loggers } from '@src/interceptors/logger.enums';
import { NotificationService } from '@src/notification/notification.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { SocketGateway } from '@src/socket/socket.gateway';
import * as moment from 'moment/moment';
import * as path from 'path';
import { BookingSharedService } from '../shared/shared.bookings.service';
import { PaymentMethods, PaymentService } from 'src/payment/payment.service';
import { UsersService } from 'src/users/users.service';
import { CreatePurchaseBookingDto } from './dto/create-purchase-booking.dto';
import { GetBookingsDataDto } from './dto/public.purchased-booking.dto';

const PURCHASED_BOOKING_INCLUDE = {
  user: { include: { country: true, city: true, state: true } },
  booking: { include: { category: true, vendor: true } },
  payment: true,
};

@Injectable()
export class PurchaseBookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingSharedService: BookingSharedService,
    private readonly paymentService: PaymentService,
    private readonly userService: UsersService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async purchase(
    createPurchaseBookingDto: CreatePurchaseBookingDto,
    userId: string,
    expMonth: string,
    expYear: string,
  ) {
    const booking = await this.bookingSharedService.helperBookingFindById(createPurchaseBookingDto.bookingId);
    if (!booking) throw new HttpException('booking not find...', HttpStatus.BAD_REQUEST);

    const user = await this.userService.findOne({ id: userId });
    if (!user) throw new HttpException('User not found...', HttpStatus.UNAUTHORIZED);

    const admin = await this.prisma.user.findFirst({ where: { role: { name: 'ADMIN' }, isDeleted: false } });

    let price = Number(booking.price);

    let table: any = null;
    const dto = createPurchaseBookingDto as any;
    if (dto.tableId) {
      table = await this.prisma.bookingTable.findFirst({ where: { id: dto.tableId } });
      if (!table) throw new HttpException('No table exists with this id...', HttpStatus.BAD_REQUEST);
      if (table?.status === 'booked') throw new HttpException('This table is already booked...', HttpStatus.BAD_REQUEST);
      if ((table as any).tablePrice) price = (table as any).tablePrice;
    }

    const { status: result, id } = await this.paymentService.createPaymentCharges(
      PaymentMethods.ONE_TIME,
      {
        amount: price * 100,
        currency: 'USD',
        receipt_email: user.email,
        description: `Stripe charge of Amount ${price} for One Time Payment`,
      },
      {
        cardDetails: {
          number: createPurchaseBookingDto.number,
          exp_month: expMonth,
          exp_year: expYear,
          cvc: createPurchaseBookingDto.cvc,
          address_state: (createPurchaseBookingDto as any).addressState,
          address_zip: (createPurchaseBookingDto as any).addressZip,
        },
      },
    );

    if (result === 'failed') throw new HttpException('payment failed...', HttpStatus.BAD_REQUEST);
    if (result === 'pending') return { success: true, status: 'pending' };

    const payment = await this.paymentService.helperCreatePayment({
      transactionId: id,
      bankAccountNumber: createPurchaseBookingDto.number,
      paymentStatus: result,
      totalPrice: price,
      perItemPrice: price,
    });

    if (table) {
      await this.prisma.bookingTable.update({ where: { id: table.id }, data: { status: 'booked' } });
    }

    const purchasedBooking = await this.prisma.purchasedBooking.create({
      data: {
        bookingId: createPurchaseBookingDto.bookingId,
        userId: user.id,
        paymentId: payment.id,
      },
    });

    const dataToSend = await this.prisma.purchasedBooking.findFirst({
      where: { id: purchasedBooking.id },
      include: PURCHASED_BOOKING_INCLUDE,
    });

    try {
      const notification = await this.notificationService.addNotification({
        notificationType: NotificationType.BOOKING,
        orderModel: 'PurchasedBooking',
        orderPayload: purchasedBooking.id,
        body: `A new Booking has been purchased by ${user.name}.`,
      } as any);

      SocketGateway.emitEvent(
        'notification',
        {
          notificationType: NotificationType.BOOKING,
          body: `A new Booking has been purchased by ${user.name}.`,
          orderPayload: purchasedBooking.id,
          _id: (notification as any)?.id ?? (notification as any)?._id,
        },
        admin?.id,
      );
    } catch (e) {
      loggers.error('Notification error: %O', e);
    }

    try {
      await this.emailService.sendMail({
        template: 'event-ticket',
        message: {
          to: [admin?.email, (booking as any).vendor?.email, user?.email].filter(Boolean),
          subject: 'New Booking Ticket Purchased',
          attachments: [
            { filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' },
          ],
        },
        locals: {
          purchasedOn: moment().format('MMMM DD,YYYY'),
          userEmail: user.email,
          userName: user.name,
          productId: booking.id,
          productTitle: booking.name,
          total: payment?.totalPrice,
          subTotal: payment?.perItemPrice,
          noOfItems: payment?.noOfItems,
          productImage: booking.photos?.[0],
          orderType: 'Booking',
        },
      });
    } catch (e) {
      loggers.error('Email error: %O', e);
    }

    return { success: true, msg: 'booking purchased successfuly', data: dataToSend };
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

    if (purchasedBookings.length === 0) {
      return { success: false, msg: 'not any Bookings purchased yet', data: [] };
    }

    return {
      success: true,
      msg: 'purchased services fetched successfuly',
      data: purchasedBookings,
      page,
      limit,
      totalPages: Math.ceil(purchasedBookingsCount / limit),
    };
  }

  async getPurchasedBooking(id: string, userId: string = null) {
    const where: any = { bookingId: id };
    if (userId) where.userId = userId;

    const purchasedData = await this.prisma.purchasedBooking.findFirst({
      where,
      include: PURCHASED_BOOKING_INCLUDE,
    });

    if (!purchasedData) {
      return { success: true, message: 'You have not purchased this booking yet.', data: {} };
    }
    return { success: true, message: 'purchased booking fetched successfuly', data: purchasedData };
  }
}
