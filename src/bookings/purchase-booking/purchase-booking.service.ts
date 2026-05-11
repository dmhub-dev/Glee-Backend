import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreatePurchaseBookingDto } from './dto/create-purchase-booking.dto';
import { BookingSharedService } from '../shared/shared.bookings.service';
import { PaymentMethods, PaymentService } from 'src/payment/payment.service';
import { UsersService } from 'src/users/users.service';
import { InjectModel } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { FilterQuery, Model } from 'mongoose';
import {
  PurchasedBooking,
  PurchasedBookingDocument,
} from 'src/schemas/purchased-booking.schema';
import {
  BookingTable,
  BookingTableDocument,
} from 'src/schemas/booking-table.schema';
import { BookingDocument } from 'src/schemas/booking.schema';
import { UserDocument } from 'src/schemas/user.shema';
import { PaymentDocument } from 'src/schemas/payment.schema';
import { BookingType } from 'src/schemas/enums/bookingType-enum';
import { GetBookingsDataDto } from './dto/public.purchased-booking.dto';
import { Role } from '@src/schemas/enums/role';
import { loggers } from '@src/interceptors/logger.enums';
import {
  bookingHistoryAggregation,
  singleBookingHistory,
} from '@src/bookings/purchase-booking/aggregate/listing.aggregate';
import { ObjectId } from 'bson';
import { eventMinorDetails } from '@src/schemas/events.schema';
import { SocketGateway } from '@src/socket/socket.gateway';
import * as path from 'path';
import * as moment from 'moment/moment';
import { EmailService } from '@src/email-server/email.service';
import { NotificationService } from '@src/notification/notification.service';
import { NotificationType } from '@src/schemas/enums/notification-enum';
import { NotificationDocument } from '@src/schemas/notification.schema';

@Injectable()
export class PurchaseBookingService {
  constructor(
    private readonly bookingSharedService: BookingSharedService,
    private readonly paymentService: PaymentService,
    private readonly userService: UsersService,
    @InjectModel(PurchasedBooking.name)
    private readonly purchasedBookingModel: Model<PurchasedBookingDocument>,
    @InjectModel(BookingTable.name)
    private readonly bookingTableModel: Model<BookingTableDocument>,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async purchase(
    createPurchaseBookingDto: CreatePurchaseBookingDto,
    userId: string,
    expMonth: string,
    expYear: string,
  ) {
    let price: number;

    let booking: any = await this.bookingSharedService.helperBookingFindById(
      createPurchaseBookingDto.bookingId,
    );

    let table: BookingTableDocument;

    if (!booking) {
      throw new HttpException('booking not find...', HttpStatus.BAD_REQUEST);
    }

    let admin: UserDocument = await this.userService.findOne({
      role: Role.ADMIN,
    });
    let commission = 0;
    if (
      admin?.margin &&
      typeof +`${admin.margin}` === 'number' &&
      !Number.isNaN(admin.margin)
    )
      commission = admin.margin;

    let checkPriorBooking: PurchasedBookingDocument =
      await this.purchasedBookingModel.findOne({
        bookingId: createPurchaseBookingDto.bookingId,
      });
    if (checkPriorBooking) {
      if (
        checkPriorBooking.bookingType == BookingType.VENUE &&
        createPurchaseBookingDto.bookingType == BookingType.VENUE
      ) {
        throw new HttpException(
          'This Venue is already booked',
          HttpStatus.NOT_ACCEPTABLE,
        );
      } else if (
        checkPriorBooking.bookingType == BookingType.VENUE &&
        createPurchaseBookingDto.bookingType == BookingType.TABLE
      ) {
        throw new HttpException(
          'Not selling tables anymore',
          HttpStatus.BAD_REQUEST,
        );
      } else if (
        checkPriorBooking.bookingType == BookingType.TABLE &&
        createPurchaseBookingDto.bookingType == BookingType.VENUE
      ) {
        throw new HttpException(
          'whole Venue not avalibale, you can buy tables if avaliable',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    let user: UserDocument = await this.userService.findOne({ _id: userId });
    if (!user) {
      throw new HttpException('User not found...', HttpStatus.UNAUTHORIZED);
    }
    price = booking.price;
    if (createPurchaseBookingDto.bookingType == BookingType.TABLE) {
      if (!createPurchaseBookingDto.tableId) {
        throw new HttpException(
          'table Id is required when booking type is Table...',
          HttpStatus.BAD_REQUEST,
        );
      }
      table = await this.bookingTableModel.findById(
        createPurchaseBookingDto.tableId,
      );
      if (!table) {
        throw new HttpException(
          'No table exists with this id...',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (table?.isBooked) {
        throw new HttpException(
          'This table is already booked...',
          HttpStatus.BAD_REQUEST,
        );
      }
      price = table?.tablePrice;
    }
    // totalPriceCalculated =
    //   service.price * createPurchasedServiceDto.totalPersons;
    let { status: result, id } = await this.paymentService.createPaymentCharges(
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
          address_state: createPurchaseBookingDto.addressState,
          address_zip: createPurchaseBookingDto.addressZip,
        },
      },
    );

    if (result == 'failed') {
      throw new HttpException('payment failed...', HttpStatus.BAD_REQUEST);
    }
    if (result == 'pending') {
      return {
        success: true,
        status: 'pending',
      };
    }

    let payment: PaymentDocument =
      await this.paymentService.helperCreatePayment({
        transactionId: id,
        bankAccountNumber: createPurchaseBookingDto.number,
        paymentStatus: result,
        totalPrice: price,
        perItemPrice: price,
      });

    let purchasedBookingCreate: FilterQuery<PurchasedBookingDocument> = {
      bookingId: createPurchaseBookingDto.bookingId,
      userId: user._id,
      paymentId: payment._id,
      date: booking.startTime,
      bookingType: createPurchaseBookingDto.bookingType,
      commission,
    };

    if (createPurchaseBookingDto.bookingType == BookingType.TABLE) {
      purchasedBookingCreate.tableId = createPurchaseBookingDto.tableId;
      await table.update({ isBooked: true });
    }

    let purchasedBooking: PurchasedBookingDocument =
      await this.purchasedBookingModel.create({
        ...purchasedBookingCreate,
      });

    const dataToSend = await this.purchasedBookingModel.populate(
      [purchasedBooking],
      [
        { path: 'paymentId' },
        { path: 'tableId' },
        {
          path: 'bookingId',
          select: {
            ...eventMinorDetails,
            category: 1,
          },
          populate: {
            path: 'category',
            select: {
              name: 1,
            },
          },
        },
      ],
    );

    // noinspection DuplicatedCode
    const notification = await this.notificationService.addNotification({
      notificationType: NotificationType.BOOKING,
      orderModel: PurchasedBooking.name,
      orderPayload: purchasedBooking._id.toString(),
      body: `A new Booking has been purchased by ${user.name}.`,
    } as NotificationDocument);
    SocketGateway.emitEvent(
      'notification',
      {
        notificationType: NotificationType.BOOKING,
        body: `A new Booking has been purchased by ${user.name}.`,
        orderPayload: purchasedBooking._id,
        _id: notification._id,
      },
      admin._id.toString(),
    );
    const responseEmail = await this.emailService.sendMail({
      template: 'event-ticket',
      message: {
        to: [admin.email, booking.vendor?.email, user?.email],
        subject: 'New Booking Ticket Purchased',
        attachments: [
          {
            filename: 'logo.svg',
            path: path.join(process.cwd(), 'views', 'logo.svg'),
            cid: 'logo',
          },
        ],
      },
      locals: {
        purchasedOn: moment().format('MMMM DD,YYYY'),
        userEmail: user.email,
        userName: user.name,
        productId: booking?._id,
        productTitle: booking.name,
        total: payment?.totalPrice,
        subTotal: payment?.perItemPrice,
        noOfItems: payment?.noOfItems,
        productImage: booking.photos[0],
        orderType: 'Booking',
      },
    });

    return {
      success: true,
      msg: 'booking purchased successfuly',
      data: dataToSend,
    };
  }

  async getPurchasedBookings(
    getbookingssDataDto: GetBookingsDataDto /* | AdminGetServicesDataDto */,
    userId?: string,
  ) {
    const { page, limit } = getbookingssDataDto;
    let totalPages: number;
    let query: FilterQuery<PurchasedBookingDocument> = {
      isDeleted: false,
    };

    if (userId) query.userId = new ObjectId(userId);
    if (getbookingssDataDto?.bookingId)
      query.bookingId = new ObjectId(getbookingssDataDto.bookingId);

    const purchasedBookingsCount: number = await this.purchasedBookingModel
      .find(query)
      .count();
    totalPages = Math.ceil(purchasedBookingsCount / limit);
    loggers.info('DTO........... %O', query);
    const purchasedBookings: PurchasedBookingDocument[] =
      await this.purchasedBookingModel
        .aggregate(bookingHistoryAggregation(query))
        .skip((page - 1) * limit)
        .limit(limit);
    if (purchasedBookings.length == 0) {
      return {
        success: false,
        msg: 'not any Bookings purchased yet',
        data: [],
      };
    }
    return {
      success: true,
      msg: 'purchased services fetched successfuly',
      data: purchasedBookings,
      page,
      limit,
      totalPages,
    };
  }

  async getPurchasedBooking(id: string, userId: string = null) {
    if (
      (!userId && !mongoose.isValidObjectId(userId)) ||
      !mongoose.isValidObjectId(id)
    ) {
      throw new HttpException('Invalid request data', HttpStatus.BAD_REQUEST);
    }
    let query: FilterQuery<PurchasedBookingDocument> = {
      bookingId: new ObjectId(id),
    };

    if (userId) {
      query.isDeleted = false;
      query.userId = userId;
    }

    let purchasedData: any[] = await this.purchasedBookingModel.aggregate(
      singleBookingHistory(query),
    );
    if (!purchasedData || purchasedData.length === 0) {
      return {
        success: true,
        message: 'You have not purchased this booking yet.',
        data: {},
      };
    }
    return {
      success: true,
      message: 'purchased booking fetched successfuly',
      data: purchasedData[0],
    };
  }
}
