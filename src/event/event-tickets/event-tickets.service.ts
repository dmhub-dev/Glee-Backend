import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';

import {
  adminGetRequestEventManagement,
  eventMinorDetails,
  Events,
  EventsDocument,
} from 'src/schemas/events.schema';
import {
  EventTickets,
  EventTicketsDocument,
} from 'src/schemas/event.tickets.schema';
import { CreateEventTicketDto } from './dto/create-event-ticket.dto';
import {
  UserDocument,
  adminGetRequestEventManagementUser,
} from 'src/schemas/user.shema';
import { PaymentMethods, PaymentService } from '../../payment/payment.service';
import { IEventTicket } from '../../schemas/interfaces/event.ticekt';
import { EventStatus } from '../../schemas/enums/status';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { IEventTicketAdminFilters } from './interfaces/filters';
import { UsersService } from '../../users/users.service';
import { EventSharedService } from '../shared/shared.event.service';
import {
  adminGetRequestEventManagementPayment,
  PaymentDocument,
} from '../../schemas/payment.schema';
import { adminGetRequestEventManagementCategory } from '../../schemas/categories.schema';
import { adminGetRequestEventManagementVendor } from '../../schemas/vendor.schema';
import { ObjectId } from 'bson';
import { aggregateEventTicketsGroupByEvent } from './aggregations/aggregation.event-ticket';
import * as mongoose from 'mongoose';
import { Role } from '@src/schemas/enums/role';
import { SocketGateway } from '@src/socket/socket.gateway';
import passwordOtpTemplate from '@src/template/mail/otp-mail';
import mailer from '@src/config/mail';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@src/email-server/email.service';
import { loggers } from '@src/interceptors/logger.enums';
import * as path from 'path';
import * as moment from 'moment';
import { NotificationType } from '@src/schemas/enums/notification-enum';
import { PurchasedBooking } from '@src/schemas/purchased-booking.schema';
import { NotificationDocument } from '@src/schemas/notification.schema';
import { NotificationService } from '@src/notification/notification.service';

@Injectable()
export class EventTicketsService {
  constructor(
    private readonly eventSharedService: EventSharedService,
    private readonly paymentService: PaymentService,
    private readonly userService: UsersService,
    @InjectModel(EventTickets.name)
    private EventTicketsModel: Model<EventTicketsDocument>,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  // Route Specific Function
  // ===================================================================================================================

  async create(createEventTicketDto: CreateEventTicketDto, expMonth, expYear) {
    let event: any = await this.eventSharedService.helperEventFindById(
      createEventTicketDto.eventId,
    );
    let user: UserDocument = await this.userService.findOne({
      _id: createEventTicketDto.userId,
    });
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
    if (!event)
      throw new HttpException('Event not found...', HttpStatus.BAD_REQUEST);
    if (!event.availableTickets || event.availableTickets <= 0)
      throw new HttpException('No ticket available', HttpStatus.BAD_REQUEST);
    if (!user)
      throw new HttpException('User not found...', HttpStatus.UNAUTHORIZED);

    let isReachMaxLimit = 0;
    if (event.maxTicketPurchased) {
      let purchasedTickets: IEventTicket[] = await this.EventTicketsModel.find({
        userId: user._id,
        eventId: event._id,
      }).populate('paymentId');
      purchasedTickets.map(
        (v) => (isReachMaxLimit += (v.paymentId as PaymentDocument).noOfItems),
      );
      if (
        event.maxTicketPurchased - isReachMaxLimit <
        createEventTicketDto.noOfTickets
      ) {
        throw new HttpException(
          `You have ${
            event.maxTicketPurchased - isReachMaxLimit
          } tickets remaining to purchase`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    let { status: result, id } = await this.paymentService.createPaymentCharges(
      PaymentMethods.ONE_TIME,
      {
        amount: event.price * createEventTicketDto.noOfTickets * 100, // multiply by hundred due to stripe take price in cent and 1 cent equal to 100
        currency: 'USD',
        receipt_email: user.email,
        description: `Stripe Charge Of Amount ${
          event.price * createEventTicketDto.noOfTickets
        } for One Time Payment. ${
          createEventTicketDto.noOfTickets
        } number of tickets are purchased. Per ticket price is ${event.price}`,
      },
      {
        cardDetails: {
          number: createEventTicketDto.number,
          exp_month: expMonth,
          exp_year: expYear,
          cvc: createEventTicketDto.cvc,
          address_state: createEventTicketDto?.addressState,
          address_zip: createEventTicketDto?.addressZip,
        },
      },
    );
    if (result == 'failed')
      throw new HttpException('Payment failed....', HttpStatus.BAD_REQUEST);
    if (result == 'pending')
      return {
        success: true,
        status: 'pending',
      };

    let payment = await this.paymentService.helperCreatePayment({
      transactionId: id,
      bankAccountNumber: createEventTicketDto.number,
      paymentStatus: result,
      totalPrice: event.price * createEventTicketDto.noOfTickets,
      perItemPrice: event.price,
      noOfItems: createEventTicketDto.noOfTickets,
    });

    let eventTicket: EventTicketsDocument = await this.EventTicketsModel.create(
      {
        eventId: createEventTicketDto.eventId,
        userId: createEventTicketDto.userId,
        paymentId: payment._id,
        commission,
      },
    );

    await event.update({
      availableTickets: event.availableTickets - payment.noOfItems,
    });

    const dataToSend = await this.EventTicketsModel.populate(
      [eventTicket],
      [
        { path: 'paymentId' },
        {
          path: 'eventId',
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

    const notification = await this.notificationService.addNotification({
      notificationType: NotificationType.EVENT,
      orderModel: PurchasedBooking.name,
      orderPayload: eventTicket._id.toString(),
      body: `A new Event has been purchased by ${user.name}.`,
    } as NotificationDocument);

    SocketGateway.emitEvent(
      'notification',
      {
        notificationType: NotificationType.EVENT,
        body: `A new Event has been purchased by ${user.name}.`,
        orderPayload: eventTicket._id,
        _id: notification._id,
      },
      admin._id.toString(),
    );

    const responseEmail = await this.emailService.sendMail({
      template: 'event-ticket',
      message: {
        to: [admin.email, event.vendor?.email, user?.email],
        subject: 'New Event Ticket Purchased',
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
        productId: event?._id,
        productTitle: event.name,
        total: payment.totalPrice,
        subTotal: payment.perItemPrice,
        noOfItems: payment.noOfItems,
        productImage: event.bannerImages[0],
        orderType: 'Event',
      },
    });

    return {
      success: true,
      data: dataToSend,
    };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filter?: IEventTicketAdminFilters,
  ) {
    let query: Partial<FilterQuery<EventTicketsDocument>> = {
      isDeleted: false,

      ...filter,
    };

    const ticketsCount: number = await this.EventTicketsModel.find(
      query,
    ).count();
    //@todo if there is no filter all the fields should be populated
    const tickets: Array<EventTickets> =
      await this.eventSharedService.getEventTicketsData(
        query,
        {
          limit,
          page,
        },
        {
          populate: [
            {
              path: 'userId',
              select: adminGetRequestEventManagementUser,
              populate: [
                { path: 'country', select: { name: 1, isoCode: 1 } },
                {
                  path: 'city',
                  select: {
                    isoCode: 1,
                    name: 1,
                    _id: 1,
                    countryCode: 1,
                    stateCode: 1,
                  },
                },
                {
                  path: 'state',
                  select: { isoCode: 1, name: 1, _id: 1, countryCode: 1 },
                },
              ],
            },
            {
              path: 'paymentId',
              select: adminGetRequestEventManagementPayment,
            },
            {
              path: 'eventId',
              select: adminGetRequestEventManagement,
              populate: [
                {
                  path: 'category',
                  select: adminGetRequestEventManagementCategory,
                },
                {
                  path: 'vendor',
                  select: adminGetRequestEventManagementVendor,
                },
              ],
            },
          ],
        },
      );
    // const tickets: Array<EventTickets> = await this.EventTicketsModel.find(
    //   query,
    // )
    //   .populate('eventId')
    //   .populate('paymentId')
    //   .populate({
    //     path: 'userId',
    //     select:
    //       '-notificationStatus -notificationIds -blockedUsersList -token -password',
    //   })
    //   .skip((page - 1) * limit)
    //   .limit(limit);

    if (tickets.length == 0) {
      return {
        success: false,
        message: 'Not any ticket sold yet',
        data: [],
      };
    }

    return {
      success: true,
      message: 'All Tickets are Fetched Successfuly',
      data: tickets,
      totalPages: Math.ceil(ticketsCount / limit),
      page,
      limit,
    };
  }

  async getTicketById(id: string) {
    const ticket: EventTickets = await this.EventTicketsModel.findById({
      _id: id,
      isDeleted: false,
      deletedAt: null,
    })
      .populate('eventId')
      .populate('paymentId')
      .populate({
        path: 'userId',
        select:
          '-notificationStatus -notificationIds -blockedUsersList -token -password',
      });
    if (!ticket) {
      return {
        success: false,
        message: 'There is no Ticket with this id',
        data: {},
      };
    }
    return {
      success: true,
      status: 200,
      message: 'Ticket Fetched Successfuly',
      data: ticket,
    };
  }

  async findTicketsByUserID(userId, queryData) {
    let totalPages: number;
    let { page, limit, eventId } = queryData;
    let totalBoughtTicket: number | string;
    let query: IEventTicket = {
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
      deletedAt: null,
    };
    if (eventId) {
      query.eventId = new ObjectId(eventId);
    }

    const tickets: Array<EventTickets> = await this.EventTicketsModel.aggregate(
      aggregateEventTicketsGroupByEvent(query),
    )
      .sort({ lastTicketPurchasedOn: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    if (tickets.length == 0) {
      return {
        success: true,
        message: 'This user have not bought any ticket yet',
        data: [],
      };
    }
    totalBoughtTicket = tickets.length;
    totalPages = Math.ceil(tickets.length / limit);

    return {
      success: true,
      data: tickets,
      totalPages,
      page,
      limit,
      totalBoughtTicket,
    };
  }

  async getAvailableTicktesOfEvent(queryData: PaginationQueryDto) {
    let totalPages: number;
    let { page, limit, eventId } = queryData;
    let ticketsAvailable = 0;
    let ticketsCapacity: string | number;
    const event: Events = await this.eventSharedService.helperSingleEventFilter(
      {
        _id: eventId,
        isDeleted: false,
        deletedAt: null,
        isActive: EventStatus.ACTIVE,
      },
    );
    if (!event) {
      return {
        success: false,
        message: 'There is no Event exists with given description',
        data: [],
      };
    }

    const tickets: Array<EventTickets> = await this.EventTicketsModel.find({
      eventId: eventId,
      isDeleted: false,
      deletedAt: null,
    })
      .populate('eventId')
      .populate({
        path: 'userId',
        select:
          '-notificationStatus -notificationIds -blockedUsersList -token -password',
      })
      .skip((page - 1) * limit)
      .limit(limit);

    if (!tickets) {
      return {
        success: true,
        message: 'Not any ticket of this event sold yet',
        data: [],
      };
    }
    ticketsCapacity = event.capacity;

    const ticketsCount: number = await this.EventTicketsModel.find({
      eventId,
      isDeleted: false,
      deletedAt: null,
    }).count();

    totalPages = Math.ceil(ticketsCount / limit);

    if (ticketsCapacity - tickets.length == 0) {
      return {
        success: true,
        message: 'This Event is full no any Tickets avaliable',
        data: tickets,
        ticketsCapicity: ticketsCapacity,
        ticketsSold: tickets.length,
        ticketsAvailable: ticketsAvailable,
        totalPages,
        page,
        limit,
      };
    }
    ticketsAvailable = ticketsCapacity - tickets.length;

    return {
      success: true,
      status: 200,
      message: `${ticketsAvailable} are avaliable`,
      data: {
        ticketsCapacity,
        ticketsSold: tickets.length,
        TicketsAvaliable: ticketsAvailable,
        Tickets: tickets,
        totalPages,
        page,
        limit,
      },
    };
  }

  async remove(eventId: string = null, userId: string = null) {
    let query: FilterQuery<EventTicketsDocument> = {};
    if (eventId) {
      let event = await this.eventSharedService.helperSingleEventFilter({
        _id: eventId,
        isDeleted: false,
        deletedAt: null,
      });
      if (!event) {
        throw new HttpException(
          'There is no event with this id',
          HttpStatus.BAD_REQUEST,
        );
      }
      query.eventId = eventId;
    }
    if (userId) {
      let user = await this.userService.findOne({
        _id: userId,
        isDeleted: false,
        deletedAt: null,
      });
      if (!user) {
        throw new HttpException(
          'There is no user with provided data',
          HttpStatus.BAD_REQUEST,
        );
      }
      query.userId = userId;
    }

    const updatedTickets = await this.EventTicketsModel.updateMany(
      query,
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );

    if (!updatedTickets) {
      throw new HttpException('some bad data provided', HttpStatus.BAD_REQUEST);
    }
    return;
  }

  async removeTicket(id: string) {
    let ticket = await this.EventTicketsModel.findOne({
      _id: id,
      isDeleted: false,
      deletedAt: null,
    });
    if (!ticket) {
      throw new HttpException(
        'There is no ticket with this id',
        HttpStatus.BAD_REQUEST,
      );
    }
    const updatedTicket = await this.EventTicketsModel.findByIdAndUpdate(
      { _id: id },
      { isDeleted: true, deletedAt: new Date() },
      { new: true },
    );

    if (!updatedTicket) {
      throw new HttpException('some bad data provided', HttpStatus.BAD_REQUEST);
    }
    return;
  }

  async removePermanently() {
    await this.EventTicketsModel.deleteMany({});
    return {
      success: true,
    };
  }
}
