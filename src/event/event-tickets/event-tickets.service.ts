import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { EmailService } from '@src/email-server/email.service';
import { loggers } from '@src/interceptors/logger.enums';
import { NotificationService } from '@src/notification/notification.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { SocketGateway } from '@src/socket/socket.gateway';
import * as moment from 'moment';
import * as path from 'path';
import { UsersService } from '../../users/users.service';
import { PaymentMethods, PaymentService } from '../../payment/payment.service';
import { EventSharedService } from '../shared/shared.event.service';
import { CreateEventTicketDto } from './dto/create-event-ticket.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@Injectable()
export class EventTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventSharedService: EventSharedService,
    private readonly paymentService: PaymentService,
    private readonly userService: UsersService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(createEventTicketDto: CreateEventTicketDto, expMonth: any, expYear: any) {
    const event = await this.eventSharedService.helperEventFindById(createEventTicketDto.eventId);
    const user = await this.userService.findOne({ id: createEventTicketDto.userId });
    const admin = await this.prisma.user.findFirst({ where: { role: { name: 'ADMIN' }, isDeleted: false } });

    let commission = 0;
    if (admin?.margin && typeof +`${admin.margin}` === 'number' && !Number.isNaN(admin.margin)) {
      commission = admin.margin;
    }

    if (!event) throw new HttpException('Event not found...', HttpStatus.BAD_REQUEST);
    if (!event.availableTickets || event.availableTickets <= 0) throw new HttpException('No ticket available', HttpStatus.BAD_REQUEST);
    if (!user) throw new HttpException('User not found...', HttpStatus.UNAUTHORIZED);

    let isReachMaxLimit = 0;
    if (event.maxTicketPurchased) {
      const purchasedTickets = await this.prisma.eventTicket.findMany({
        where: { userId: user.id, eventId: event.id },
        include: { payment: true },
      });
      purchasedTickets.forEach(t => { isReachMaxLimit += (t.payment as any)?.noOfItems ?? 0; });
      if (event.maxTicketPurchased - isReachMaxLimit < createEventTicketDto.noOfTickets) {
        throw new HttpException(
          `You have ${event.maxTicketPurchased - isReachMaxLimit} tickets remaining to purchase`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const { status: result, id } = await this.paymentService.createPaymentCharges(
      PaymentMethods.ONE_TIME,
      {
        amount: Number(event.price) * createEventTicketDto.noOfTickets * 100,
        currency: 'USD',
        receipt_email: user.email,
        description: `Stripe Charge Of Amount ${Number(event.price) * createEventTicketDto.noOfTickets} for One Time Payment. ${createEventTicketDto.noOfTickets} number of tickets are purchased. Per ticket price is ${event.price}`,
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

    if (result === 'failed') throw new HttpException('Payment failed....', HttpStatus.BAD_REQUEST);
    if (result === 'pending') return { success: true, status: 'pending' };

    const payment = await this.paymentService.helperCreatePayment({
      transactionId: id,
      bankAccountNumber: createEventTicketDto.number,
      paymentStatus: result,
      totalPrice: Number(event.price) * createEventTicketDto.noOfTickets,
      perItemPrice: Number(event.price),
      noOfItems: createEventTicketDto.noOfTickets,
    });

    const eventTicket = await this.prisma.eventTicket.create({
      data: {
        eventId: createEventTicketDto.eventId,
        userId: createEventTicketDto.userId,
        paymentId: payment.id,
        quantity: createEventTicketDto.noOfTickets,
        totalPrice: Number(event.price) * createEventTicketDto.noOfTickets,
      },
    });

    await this.prisma.event.update({
      where: { id: event.id },
      data: { availableTickets: { decrement: payment.noOfItems } },
    });

    const dataToSend = await this.prisma.eventTicket.findFirst({
      where: { id: eventTicket.id },
      include: { payment: true, event: { include: { category: true } }, user: true },
    });

    try {
      const notification = await this.notificationService.addNotification({
        notificationType: NotificationType.EVENT_TICKET,
        orderModel: 'EventTicket',
        orderPayload: eventTicket.id,
        body: `A new Event has been purchased by ${user.name}.`,
      } as any);

      SocketGateway.emitEvent(
        'notification',
        {
          notificationType: NotificationType.EVENT_TICKET,
          body: `A new Event has been purchased by ${user.name}.`,
          orderPayload: eventTicket.id,
          _id: (notification as any)?._id ?? (notification as any)?.id,
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
          to: [admin?.email, (event as any).vendor?.email, user?.email].filter(Boolean),
          subject: 'New Event Ticket Purchased',
          attachments: [
            { filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' },
          ],
        },
        locals: {
          purchasedOn: moment().format('MMMM DD,YYYY'),
          userEmail: user.email,
          userName: user.name,
          productId: event.id,
          productTitle: event.name,
          total: payment.totalPrice,
          subTotal: payment.perItemPrice,
          noOfItems: payment.noOfItems,
          productImage: event.bannerImages?.[0],
          orderType: 'Event',
        },
      });
    } catch (e) {
      loggers.error('Email error: %O', e);
    }

    return { success: true, data: dataToSend };
  }

  async findAll(page = 1, limit = 10, filter?: any) {
    const where: any = { ...filter };

    const [tickets, ticketsCount] = await Promise.all([
      this.eventSharedService.getEventTicketsData(where, { limit, page }),
      this.prisma.eventTicket.count({ where }),
    ]);

    if (tickets.length === 0) {
      return { success: false, message: 'Not any ticket sold yet', data: [] };
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
    const ticket = await this.prisma.eventTicket.findFirst({
      where: { id },
      include: { event: true, payment: true, user: true },
    });
    if (!ticket) {
      return { success: false, message: 'There is no Ticket with this id', data: {} };
    }
    return { success: true, status: 200, message: 'Ticket Fetched Successfuly', data: ticket };
  }

  async findTicketsByUserID(userId: string, queryData: any) {
    const { page, limit, eventId } = queryData;
    const where: any = { userId };
    if (eventId) where.eventId = eventId;

    const tickets = await this.prisma.eventTicket.findMany({
      where,
      include: { event: { include: { category: true } }, payment: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (tickets.length === 0) {
      return { success: true, message: 'This user have not bought any ticket yet', data: [] };
    }

    const grouped: Record<string, any> = {};
    tickets.forEach(t => {
      const eid = t.eventId;
      if (!grouped[eid]) {
        grouped[eid] = { event: t.event, tickets: [], noOfTicketsPurchased: 0, totalPrice: 0 };
      }
      grouped[eid].tickets.push(t);
      grouped[eid].noOfTicketsPurchased += (t.payment as any)?.noOfItems ?? 0;
      grouped[eid].totalPrice += Number(t.payment?.totalPrice ?? 0);
    });

    const data = Object.values(grouped).map(g => ({
      ...g,
      count: g.tickets.length,
      lastTicketPurchasedOn: g.tickets[g.tickets.length - 1]?.createdAt,
    }));

    return {
      success: true,
      data,
      totalPages: Math.ceil(data.length / limit),
      page,
      limit,
      totalBoughtTicket: data.length,
    };
  }

  async getAvailableTicktesOfEvent(queryData: PaginationQueryDto) {
    const { page, limit, eventId } = queryData;

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, isDeleted: false, status: 'ACTIVE' },
    });
    if (!event) {
      return { success: false, message: 'There is no Event exists with given description', data: [] };
    }

    const [tickets, ticketsCount] = await Promise.all([
      this.prisma.eventTicket.findMany({
        where: { eventId },
        include: { user: true, event: true },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.eventTicket.count({ where: { eventId } }),
    ]);

    const ticketsCapacity = event.capacity;
    const totalPages = Math.ceil(ticketsCount / limit);
    const ticketsAvailable = (ticketsCapacity ?? 0) - ticketsCount;

    if (ticketsAvailable <= 0) {
      return {
        success: true,
        message: 'This Event is full no any Tickets avaliable',
        data: tickets,
        ticketsCapicity: ticketsCapacity,
        ticketsSold: ticketsCount,
        ticketsAvailable: 0,
        totalPages,
        page,
        limit,
      };
    }

    return {
      success: true,
      status: 200,
      message: `${ticketsAvailable} are avaliable`,
      data: { ticketsCapacity, ticketsSold: ticketsCount, TicketsAvaliable: ticketsAvailable, Tickets: tickets, totalPages, page, limit },
    };
  }

  async remove(eventId: string = null, userId: string = null) {
    const where: any = {};
    if (eventId) {
      const event = await this.eventSharedService.helperSingleEventFilter({ id: eventId, isDeleted: false });
      if (!event) throw new HttpException('There is no event with this id', HttpStatus.BAD_REQUEST);
      where.eventId = eventId;
    }
    if (userId) {
      const user = await this.userService.findOne({ id: userId });
      if (!user) throw new HttpException('There is no user with provided data', HttpStatus.BAD_REQUEST);
      where.userId = userId;
    }
    await this.prisma.eventTicket.deleteMany({ where });
  }

  async removeTicket(id: string) {
    const ticket = await this.prisma.eventTicket.findFirst({ where: { id } });
    if (!ticket) throw new HttpException('There is no ticket with this id', HttpStatus.BAD_REQUEST);
    await this.prisma.eventTicket.delete({ where: { id } });
  }

  async removePermanently() {
    await this.prisma.eventTicket.deleteMany({});
    return { success: true };
  }
}
