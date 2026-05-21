import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EmailService } from '@src/email-server/email.service';
import { loggers } from '@src/interceptors/logger.enums';
import * as QRCode from 'qrcode';
import { NotificationService } from '@src/notification/notification.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { PayStackService } from '@src/paystack/paystack.service';
import { PurchasingType } from '@src/paystack/paystack.types';
import { SocketGateway } from '@src/socket/socket.gateway';
import moment from 'moment';
import * as crypto from 'crypto';
import * as path from 'path';
import { UsersService } from '../../users/users.service';
import { EventSharedService } from '../shared/shared.event.service';
import { CreateEventTicketDto } from './dto/create-event-ticket.dto';
import { CreateGuestTicketDto } from './dto/create-guest-ticket.dto';
import { ConfirmPurchaseDto } from './dto/confirm-purchase.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@Injectable()
export class EventTicketsService {
  private readonly logger = new Logger(EventTicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventSharedService: EventSharedService,
    private readonly userService: UsersService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly payStackService: PayStackService,
  ) {
    // Register this service as the event ticket webhook handler
    this.payStackService.eventTicketsHandler = this;
  }

  async create(createEventTicketDto: CreateEventTicketDto, currentUser: any) {
    const userId = createEventTicketDto.userId || currentUser.id;
    const event = await this.eventSharedService.helperEventFindById(createEventTicketDto.eventId);
    if (!event) throw new HttpException('Event not found', HttpStatus.BAD_REQUEST);
    if (!event.availableTickets || event.availableTickets <= 0) {
      throw new HttpException('No tickets available', HttpStatus.BAD_REQUEST);
    }

    const user = await this.userService.findOne({ id: userId });
    if (!user) throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);

    let price = Number(event.price);
    if (createEventTicketDto.ticketCategoryId) {
      const category = await this.prisma.ticketCategory.findUnique({
        where: { id: createEventTicketDto.ticketCategoryId },
      });
      if (category) price = Number(category.price);
    }

    const totalPrice = price * createEventTicketDto.noOfTickets;

    const metadata = {
      purchasingType: PurchasingType.EVENT_TICKET,
      eventId: event.id,
      noOfTickets: createEventTicketDto.noOfTickets,
      ticketCategoryId: createEventTicketDto.ticketCategoryId,
      preOrderMenu: createEventTicketDto.preOrderMenu,
      userId,
    };

    const paymentIntent = await this.payStackService.createPaymentIntent({
      email: user.email,
      amount: Math.round(totalPrice),
      metaData: metadata,
    });

    return { success: true, data: paymentIntent };
  }

  async initiateGuestPurchase(dto: CreateGuestTicketDto) {
    const event = await this.eventSharedService.helperEventFindById(dto.eventId);
    if (!event) throw new HttpException('Event not found', HttpStatus.BAD_REQUEST);

    let price = Number(event.price);
    if (dto.ticketCategoryId) {
      const category = await this.prisma.ticketCategory.findUnique({
        where: { id: dto.ticketCategoryId },
      });
      if (category) price = Number(category.price);
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');

    const user = await this.prisma.user.upsert({
      where: { email: dto.guestEmail },
      update: {},
      create: {
        name: dto.guestName,
        email: dto.guestEmail,
        phone: dto.guestPhone,
        password: randomPassword,
        notificationIds: [],
        role: { connect: { name: 'USER' as any } },
      },
    });

    const totalPrice = price * dto.noOfTickets;

    const metadata = {
      purchasingType: PurchasingType.EVENT_TICKET,
      eventId: dto.eventId,
      noOfTickets: dto.noOfTickets,
      ticketCategoryId: dto.ticketCategoryId,
      userId: user.id,
    };

    const paymentIntent = await this.payStackService.createPaymentIntent({
      email: dto.guestEmail,
      amount: Math.round(totalPrice),
      metaData: metadata,
    });

    return { success: true, data: paymentIntent };
  }

  async confirmPurchase(dto: ConfirmPurchaseDto) {
    const result = await this.payStackService.verifyTransaction(dto.verificationToken);
    const paystackData = (result as any)?.paystack?.data;
    this.logger.debug(`Paystack verify data: ${JSON.stringify(paystackData)}`);
    if (!paystackData?.reference) {
      throw new HttpException('Payment verification failed', HttpStatus.BAD_REQUEST);
    }
    if (paystackData.status === 'failed' || paystackData.status === 'abandoned') {
      throw new HttpException('Payment was not successful', HttpStatus.BAD_REQUEST);
    }
    await this.createPurchasedEventTicket(paystackData.metadata, paystackData.reference);
    return { success: true, message: 'Ticket confirmed' };
  }

  async createPurchasedEventTicket(metadata: any, paystackReference: string) {
    const existing = await this.prisma.payment.findUnique({ where: { paystackReference } });
    if (existing) return;

    const event = await this.eventSharedService.helperEventFindById(metadata.eventId);
    if (!event) return;

    let price = Number(event.price);
    if (metadata.ticketCategoryId) {
      const category = await this.prisma.ticketCategory.findUnique({ where: { id: metadata.ticketCategoryId } });
      if (category) price = Number(category.price);
    }

    const noOfTickets = parseInt(String(metadata.noOfTickets ?? 1), 10);
    const totalPrice = price * noOfTickets;

    const payment = await this.prisma.payment.create({
      data: {
        userId: metadata.userId,
        paystackReference,
        paymentStatus: 'SUCCEEDED',
        paymentMethod: 'PAYSTACK',
        totalPrice: new Decimal(totalPrice),
        perItemPrice: new Decimal(price),
        noOfItems: noOfTickets,
        isPaid: true,
        isAvailable: false,
      },
    });

    const eventTicket = await this.prisma.eventTicket.create({
      data: {
        eventId: metadata.eventId,
        userId: metadata.userId,
        paymentId: payment.id,
        ticketCategoryId: metadata.ticketCategoryId,
        quantity: noOfTickets,
        totalPrice: new Decimal(totalPrice),
        preOrderMenu: metadata.preOrderMenu,
      },
    });

    await this.prisma.event.update({
      where: { id: event.id },
      data: { availableTickets: { decrement: noOfTickets } },
    });

    if (metadata.ticketCategoryId) {
      await this.prisma.ticketCategory.update({
        where: { id: metadata.ticketCategoryId },
        data: { available: { decrement: noOfTickets } },
      });
    }

    const admin = await this.prisma.user.findFirst({ where: { role: { name: 'ADMIN' }, isDeleted: false } });
    const user = await this.userService.findOne({ id: metadata.userId });

    try {
      const notification = await this.notificationService.addNotification({
        notificationType: NotificationType.EVENT_TICKET,
        orderModel: 'EventTicket',
        orderPayload: eventTicket.id,
        body: `A new Event Ticket has been purchased by ${user?.name}.`,
      } as any);

      SocketGateway.emitEvent('notification', {
        notificationType: NotificationType.EVENT_TICKET,
        body: `A new Event Ticket has been purchased by ${user?.name}.`,
        orderPayload: eventTicket.id,
        _id: (notification as any)?.id,
      }, admin?.id);
    } catch (e) {
      loggers.error('Notification error: %O', e);
    }

    try {
      const ticketRef = eventTicket.id;
      const qrDataUrl = await QRCode.toDataURL(ticketRef, {
        width: 200,
        margin: 2,
        color: { dark: '#FF2D8F', light: '#131328' },
      });
      const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');

      await this.emailService.sendMail({
        template: 'event-ticket',
        message: {
          to: [user?.email].filter(Boolean),
          subject: `Your ticket for ${event.name} — Glee`,
          attachments: [
            { filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' },
            { filename: 'qrcode.png', content: qrBuffer, encoding: 'base64', cid: 'qrcode' },
          ],
        },
        locals: {
          purchasedOn: moment().format('MMMM DD, YYYY'),
          userEmail: user?.email,
          userName: user?.name,
          ticketId: eventTicket.id,
          productTitle: event.name,
          eventDate: event.startDate ? moment(event.startDate).format('dddd, MMMM DD, YYYY') : null,
          eventTime: event.startDate ? moment(event.startDate).format('h:mm A') : null,
          eventVenue: event.location ?? null,
          total: totalPrice.toLocaleString(),
          subTotal: price.toLocaleString(),
          noOfItems: noOfTickets,
          productImage: event.bannerImages?.[0] ?? null,
          orderType: 'Event',
        },
      });
    } catch (e) {
      loggers.error('Email error: %O', e);
    }
  }

  async createEventTicketViaPaystack(data: any) {
    const metadata = data.metadata;
    return this.createPurchasedEventTicket({
      ...metadata,
      depositAmount: metadata.depositAmount,
    }, data.reference);
  }

  async findAll(page = 1, limit = 10, filter?: any) {
    const where: any = { ...filter };

    const [tickets, ticketsCount] = await Promise.all([
      this.eventSharedService.getEventTicketsData(where, { limit, page }),
      this.prisma.eventTicket.count({ where }),
    ]);

    if (tickets.length === 0) return { success: false, message: 'No tickets sold yet', data: [] };

    return {
      success: true,
      message: 'Tickets fetched successfully',
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
    if (!ticket) return { success: false, message: 'No ticket found', data: {} };
    return { success: true, message: 'Ticket fetched successfully', data: ticket };
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

    if (tickets.length === 0) return { success: true, message: 'No tickets bought yet', data: [] };

    const grouped: Record<string, any> = {};
    tickets.forEach(t => {
      const eid = t.eventId;
      if (!grouped[eid]) grouped[eid] = { event: t.event, tickets: [], noOfTicketsPurchased: 0, totalPrice: 0 };
      grouped[eid].tickets.push(t);
      grouped[eid].noOfTicketsPurchased += t.payment?.noOfItems ?? 0;
      grouped[eid].totalPrice += Number(t.payment?.totalPrice ?? 0);
    });

    const data = Object.values(grouped).map(g => ({
      ...g,
      count: g.tickets.length,
      lastTicketPurchasedOn: g.tickets[g.tickets.length - 1]?.createdAt,
    }));

    return { success: true, data, totalPages: Math.ceil(data.length / limit), page, limit };
  }

  async getAvailableTicktesOfEvent(queryData: PaginationQueryDto) {
    const { page, limit, eventId } = queryData;
    const event = await this.prisma.event.findFirst({ where: { id: eventId, isDeleted: false, status: 'ACTIVE' } });
    if (!event) return { success: false, message: 'Event not found', data: [] };

    const [tickets, ticketsCount] = await Promise.all([
      this.prisma.eventTicket.findMany({ where: { eventId }, include: { user: true }, skip: (page - 1) * limit, take: limit }),
      this.prisma.eventTicket.count({ where: { eventId } }),
    ]);

    const ticketsAvailable = (event.capacity ?? 0) - ticketsCount;
    return {
      success: true,
      data: { ticketsCapacity: event.capacity, ticketsSold: ticketsCount, ticketsAvailable, tickets, totalPages: Math.ceil(ticketsCount / limit), page, limit },
    };
  }

  async remove(eventId?: string, userId?: string) {
    const where: any = {};
    if (eventId) where.eventId = eventId;
    if (userId) where.userId = userId;
    await this.prisma.eventTicket.deleteMany({ where });
  }

  async removeTicket(id: string) {
    const ticket = await this.prisma.eventTicket.findFirst({ where: { id } });
    if (!ticket) throw new HttpException('Ticket not found', HttpStatus.BAD_REQUEST);
    await this.prisma.eventTicket.delete({ where: { id } });
  }

  async removePermanently() {
    await this.prisma.eventTicket.deleteMany({});
    return { success: true };
  }
}
