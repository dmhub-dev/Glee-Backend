import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EmailService } from '@src/infrastructure/email/email.service';
import { loggers } from '@src/common/interceptors/logger.enums';
import { generateTicketPdf } from '@src/common/utils/ticket-pdf.util';
import { NotificationService } from '@src/modules/notifications/notifications/notification.service';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { PayStackService } from '@src/infrastructure/payments/paystack/paystack.service';
import { PurchasingType } from '@src/infrastructure/payments/paystack/paystack.types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const moment = require('moment') as typeof import('moment');
import * as crypto from 'crypto';
import { UsersService } from '@src/modules/identity/users/users.service';
import { EventSharedService } from '@src/modules/events/shared/shared.event.service';
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

    let menuTotal = 0;
    const resolvedMenuItems: { id: string; name: string; price: number; quantity: number }[] = [];
    if (dto.menuItems?.length) {
      const menuItemRecords = await this.prisma.eventMenuItem.findMany({
        where: { id: { in: dto.menuItems.map(m => m.id) }, eventId: dto.eventId },
      });
      for (const ordered of dto.menuItems) {
        const record = menuItemRecords.find(r => r.id === ordered.id);
        if (record) {
          const lineTotal = Number(record.price) * ordered.quantity;
          menuTotal += lineTotal;
          resolvedMenuItems.push({ id: record.id, name: record.name, price: Number(record.price), quantity: ordered.quantity });
        }
      }
    }

    const totalPrice = price * dto.noOfTickets + menuTotal;

    const metadata = {
      purchasingType: PurchasingType.EVENT_TICKET,
      eventId: dto.eventId,
      noOfTickets: dto.noOfTickets,
      ticketCategoryId: dto.ticketCategoryId,
      userId: user.id,
      preOrderMenu: resolvedMenuItems.length ? resolvedMenuItems : undefined,
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
    const preOrderMenu: { id: string; name: string; price: number; quantity: number }[] = metadata.preOrderMenu ?? [];
    const menuTotal = preOrderMenu.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalPrice = price * noOfTickets + menuTotal;

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
        type: NotificationType.EVENT_TICKET,
        eventTicketId: eventTicket.id,
        userId: admin?.id,
      } as any);

      loggers.info('Event ticket notification created: %O', {
        type: NotificationType.EVENT_TICKET,
        body: `A new Event Ticket has been purchased by ${user?.name}.`,
        eventTicketId: eventTicket.id,
        _id: (notification as any)?.id,
        userId: admin?.id,
      });
    } catch (e) {
      loggers.error('Notification error: %O', e);
    }

    try {
      const purchasedOn = moment().format('MMMM DD, YYYY');
      const eventDate = event.startDate ? moment(event.startDate).format('dddd, MMMM DD, YYYY') : null;
      const eventTime = event.startDate ? moment(event.startDate).format('h:mm A') : null;
      const eventVenue = (event as any).locationName ?? null;

      const pdfAttachments = await Promise.all(
        Array.from({ length: noOfTickets }, (_, i) =>
          generateTicketPdf({
            ticketRef: `${eventTicket.id}-${i + 1}`,
            ticketNumber: i + 1,
            totalTickets: noOfTickets,
            eventName: event.name,
            eventDate,
            eventTime,
            eventVenue,
            attendeeName: user?.name ?? '',
            attendeeEmail: user?.email ?? '',
            purchasedOn,
            orderId: eventTicket.id,
            price: price.toLocaleString(),
            currency: 'KES',
          }).then((buf) => ({
            filename: `glee-ticket-${i + 1}.pdf`,
            content: buf,
            content_type: 'application/pdf',
          })),
        ),
      );

      await this.emailService.sendMail({
        template: 'event-ticket',
        message: {
          to: [user?.email].filter(Boolean) as string[],
          subject: `Your ticket for ${event.name} — Glee`,
          attachments: pdfAttachments,
        },
        locals: {
          purchasedOn,
          userEmail: user?.email,
          userName: user?.name,
          ticketId: eventTicket.id,
          productTitle: event.name,
          eventDate,
          eventTime,
          eventVenue,
          total: totalPrice.toLocaleString(),
          subTotal: (price * noOfTickets).toLocaleString(),
          menuItems: preOrderMenu.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: (item.price * item.quantity).toLocaleString(),
          })),
          menuTotal: menuTotal > 0 ? menuTotal.toLocaleString() : null,
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
