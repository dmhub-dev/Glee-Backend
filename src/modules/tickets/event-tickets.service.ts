import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NotificationType, UserRole } from '@prisma/client';
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
import { WalletService } from '@src/modules/wallets/wallet/wallet.service';
import { randomUUID } from 'crypto';
import {
    EventCheckoutSettings,
    PlatformSettingsService,
} from '@src/modules/settings/platform-settings.service';

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
        private readonly walletService: WalletService,
        private readonly platformSettingsService: PlatformSettingsService,
    ) {
        // Register this service as the event ticket webhook handler
        this.payStackService.eventTicketsHandler = this;
    }

    async create(createEventTicketDto: CreateEventTicketDto, currentUser: any) {
        const userId =
            createEventTicketDto.userId || currentUser?.id || currentUser?.userId;
        if (!userId) {
            throw new HttpException(
                'Authenticated user not found',
                HttpStatus.UNAUTHORIZED,
            );
        }
        const event = await this.eventSharedService.helperEventFindById(
            createEventTicketDto.eventId,
        );
        if (!event)
            throw new HttpException('Event not found', HttpStatus.BAD_REQUEST);
        await this.assertEventCapacity(
            event.id,
            event.capacity,
            createEventTicketDto.noOfTickets,
            createEventTicketDto.ticketCategoryId,
        );

        const user = await this.userService.findOne({ id: userId });
        if (!user)
            throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
        const payerEmail = this.resolvePaystackEmail(
            user.email ?? currentUser?.email,
        );

        const price = await this.resolveTicketPrice(
            event.id,
            createEventTicketDto.ticketCategoryId,
        );

        let menuTotal = 0;
        const resolvedMenuItems: {
            id: string;
            name: string;
            price: number;
            quantity: number;
        }[] = [];
        if (createEventTicketDto.preOrderMenu?.length) {
            const menuItemRecords = await this.prisma.eventMenuItem.findMany({
                where: {
                    id: { in: createEventTicketDto.preOrderMenu.map((m) => m.id) },
                    eventId: event.id,
                },
            });
            for (const ordered of createEventTicketDto.preOrderMenu) {
                const record = menuItemRecords.find((r) => r.id === ordered.id);
                if (record) {
                    const quantity = Number(ordered.quantity) || 0;
                    const lineTotal = Number(record.price) * quantity;
                    menuTotal += lineTotal;
                    resolvedMenuItems.push({
                        id: record.id,
                        name: record.name,
                        price: Number(record.price),
                        quantity,
                    });
                }
            }
        }

        const totalPrice = price * createEventTicketDto.noOfTickets + menuTotal;

        if (
            createEventTicketDto.useWallet &&
            createEventTicketDto.walletPaymentType === 'INSTALLMENT'
        ) {
            return this.purchaseWithWalletInstallments({
                event,
                userId,
                ticketCategoryId: createEventTicketDto.ticketCategoryId,
                noOfTickets: createEventTicketDto.noOfTickets,
                preOrderMenu: resolvedMenuItems.length ? resolvedMenuItems : undefined,
                totalPrice,
                price,
                ticketTotal: price * createEventTicketDto.noOfTickets,
                menuTotal,
                installmentCount: createEventTicketDto.installmentCount ?? 2,
            });
        }

        if (createEventTicketDto.useWallet) {
            return this.purchaseWithWallet({
                event,
                userId,
                ticketCategoryId: createEventTicketDto.ticketCategoryId,
                noOfTickets: createEventTicketDto.noOfTickets,
                preOrderMenu: resolvedMenuItems.length ? resolvedMenuItems : undefined,
                totalPrice,
                price,
            });
        }

        const metadata = {
            purchasingType: PurchasingType.EVENT_TICKET,
            eventId: event.id,
            noOfTickets: createEventTicketDto.noOfTickets,
            ticketCategoryId: createEventTicketDto.ticketCategoryId,
            preOrderMenu: resolvedMenuItems.length ? resolvedMenuItems : undefined,
            userId,
        };

        const paymentIntent = await this.payStackService.createPaymentIntent({
            email: payerEmail,
            amount: Math.round(totalPrice),
            metaData: metadata,
            callbackUrl: createEventTicketDto.callbackUrl,
        });

        return { success: true, data: paymentIntent };
    }

    private async purchaseWithWallet(input: {
        event: any;
        userId: string;
        ticketCategoryId?: string;
        noOfTickets: number;
        preOrderMenu?: any[];
        totalPrice: number;
        price: number;
    }) {
        const reference = `wallet_${randomUUID()}`;
        await this.walletService.debit(
            input.userId,
            input.totalPrice,
            `Event ticket purchase: ${input.event.name}`,
            reference,
            { eventId: input.event.id, noOfTickets: input.noOfTickets },
        );

        await this.createPurchasedEventTicket(
            {
                purchasingType: PurchasingType.EVENT_TICKET,
                eventId: input.event.id,
                noOfTickets: input.noOfTickets,
                ticketCategoryId: input.ticketCategoryId,
                preOrderMenu: input.preOrderMenu,
                userId: input.userId,
                paymentMethod: 'WALLET',
                walletReference: reference,
                amountPaid: input.totalPrice,
                outstandingAmount: 0,
            },
            reference,
        );

        return {
            success: true,
            message: 'Ticket purchased successfully with wallet',
            data: { reference },
        };
    }

    private async purchaseWithWalletInstallments(input: {
        event: any;
        userId: string;
        ticketCategoryId?: string;
        noOfTickets: number;
        preOrderMenu?: any[];
        totalPrice: number;
        price: number;
        ticketTotal: number;
        menuTotal: number;
        installmentCount: number;
    }) {
        const settings =
            await this.platformSettingsService.getEventCheckoutSettings();
        const paymentPlan = this.createInstallmentPlan(
            input.totalPrice,
            input.event.startDate,
            input.installmentCount,
            input.ticketTotal,
            input.menuTotal,
            settings,
        );
        const reference = `wallet_installment_${randomUUID()}`;
        await this.walletService.debit(
            input.userId,
            paymentPlan.dueNow,
            `Event ticket reservation deposit: ${input.event.name}`,
            reference,
            {
                eventId: input.event.id,
                noOfTickets: input.noOfTickets,
                paymentPlan,
            },
        );

        await this.createPurchasedEventTicket(
            {
                purchasingType: PurchasingType.EVENT_TICKET,
                eventId: input.event.id,
                noOfTickets: input.noOfTickets,
                ticketCategoryId: input.ticketCategoryId,
                preOrderMenu: input.preOrderMenu,
                userId: input.userId,
                paymentMethod: 'WALLET_INSTALLMENT',
                paymentStatus: 'PARTIAL',
                isPaid: false,
                walletReference: reference,
                paymentPlan,
                amountPaid: paymentPlan.dueNow,
                outstandingAmount: paymentPlan.remainingAmount,
                paymentDueDate: paymentPlan.finalDueDate,
            },
            reference,
        );

        return {
            success: true,
            message: 'Ticket reserved with wallet installment plan',
            data: { reference, paymentPlan },
        };
    }

    private createInstallmentPlan(
        totalPrice: number,
        eventStartDate: Date | string | null | undefined,
        requestedInstallments: number,
        ticketTotal = totalPrice,
        menuTotal = 0,
        settings?: EventCheckoutSettings,
    ) {
        if (!eventStartDate) {
            throw new HttpException(
                'Installment purchases require an event date',
                HttpStatus.BAD_REQUEST,
            );
        }

        const finalDue = moment(eventStartDate).subtract(7, 'days').endOf('day');
        if (finalDue.isSameOrBefore(moment())) {
            throw new HttpException(
                'Installments are only available when the event is more than one week away',
                HttpStatus.BAD_REQUEST,
            );
        }

        const installmentCount = Math.min(
            3,
            Math.max(2, Number(requestedInstallments) || 2),
        );
        const depositType = settings?.walletInstallmentDepositType ?? 'PERCENTAGE';
        const securityFeeType =
            settings?.walletInstallmentSecurityFeeType ?? 'PERCENTAGE';
        const depositPercent = settings?.walletInstallmentDepositPercent ?? 30;
        const securityFeePercent =
            settings?.walletInstallmentSecurityFeePercent ?? 5;
        const depositFixedAmount = settings?.walletInstallmentDepositAmount ?? 0;
        const securityFeeFixedAmount =
            settings?.walletInstallmentSecurityFeeAmount ?? 0;
        const depositAmount = this.roundMoney(
            depositType === 'FIXED'
                ? Math.min(ticketTotal, depositFixedAmount)
                : ticketTotal * (depositPercent / 100),
        );
        const securityFeeAmount = this.roundMoney(
            securityFeeType === 'FIXED'
                ? securityFeeFixedAmount
                : ticketTotal * (securityFeePercent / 100),
        );
        const dueNow = this.roundMoney(depositAmount + menuTotal + securityFeeAmount);
        const remainingAmount = this.roundMoney(totalPrice - depositAmount);
        const baseAmount = this.roundMoney(remainingAmount / installmentCount);
        const installments = Array.from({ length: installmentCount }, (_, index) => {
            const dueDate = moment()
                .add(
                    Math.round(
                        ((index + 1) * finalDue.diff(moment(), 'days')) /
                            installmentCount,
                    ),
                    'days',
                )
                .endOf('day');
            const amount =
                index === installmentCount - 1
                    ? this.roundMoney(
                          remainingAmount - baseAmount * (installmentCount - 1),
                      )
                    : baseAmount;
            return {
                label: `Payment ${index + 1}`,
                amount,
                dueDate: dueDate.isAfter(finalDue)
                    ? finalDue.toISOString()
                    : dueDate.toISOString(),
            };
        });

        return {
            type: 'INSTALLMENT',
            depositType,
            depositPercent,
            depositFixedAmount: this.roundMoney(depositFixedAmount),
            securityFeeType,
            securityFeePercent,
            securityFeeFixedAmount: this.roundMoney(securityFeeFixedAmount),
            totalAmount: this.roundMoney(totalPrice),
            depositAmount,
            menuAmount: this.roundMoney(menuTotal),
            securityFeeAmount,
            dueNow,
            remainingAmount,
            finalDueDate: finalDue.toISOString(),
            installments,
            rule: 'The remaining balance must be fully paid one week before the event.',
        };
    }

    private roundMoney(value: number) {
        return Math.round(value * 100) / 100;
    }

    async initiateGuestPurchase(dto: CreateGuestTicketDto) {
        const event = await this.eventSharedService.helperEventFindById(
            dto.eventId,
        );
        if (!event)
            throw new HttpException('Event not found', HttpStatus.BAD_REQUEST);
        await this.assertEventCapacity(
            event.id,
            event.capacity,
            dto.noOfTickets,
            dto.ticketCategoryId,
        );

        const price = await this.resolveTicketPrice(
            event.id,
            dto.ticketCategoryId,
        );

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
        const resolvedMenuItems: {
            id: string;
            name: string;
            price: number;
            quantity: number;
        }[] = [];
        if (dto.menuItems?.length) {
            const menuItemRecords = await this.prisma.eventMenuItem.findMany({
                where: {
                    id: { in: dto.menuItems.map((m) => m.id) },
                    eventId: dto.eventId,
                },
            });
            for (const ordered of dto.menuItems) {
                const record = menuItemRecords.find((r) => r.id === ordered.id);
                if (record) {
                    const lineTotal = Number(record.price) * ordered.quantity;
                    menuTotal += lineTotal;
                    resolvedMenuItems.push({
                        id: record.id,
                        name: record.name,
                        price: Number(record.price),
                        quantity: ordered.quantity,
                    });
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
            guestName: dto.guestName,
            guestEmail: dto.guestEmail,
            guestPhone: dto.guestPhone,
            preOrderMenu: resolvedMenuItems.length
                ? resolvedMenuItems
                : undefined,
        };

        const paymentIntent = await this.payStackService.createPaymentIntent({
            email: dto.guestEmail,
            amount: Math.round(totalPrice),
            metaData: metadata,
            callbackUrl: dto.callbackUrl,
        });

        return { success: true, data: paymentIntent };
    }

    async confirmPurchase(dto: ConfirmPurchaseDto) {
        if (!dto.verificationToken && !dto.reference) {
            throw new HttpException(
                'Payment reference is required',
                HttpStatus.BAD_REQUEST,
            );
        }
        const result = dto.verificationToken
            ? await this.payStackService.verifyTransaction(
                  dto.verificationToken,
              )
            : await this.payStackService.verifyTransactionReference(
                  dto.reference!,
              );
        const paystackData = (result as any)?.paystack?.data;
        this.logger.debug(
            `Paystack verify data: ${JSON.stringify(paystackData)}`,
        );
        if (!paystackData?.reference) {
            throw new HttpException(
                'Payment verification failed',
                HttpStatus.BAD_REQUEST,
            );
        }
        if (
            paystackData.status === 'failed' ||
            paystackData.status === 'abandoned'
        ) {
            throw new HttpException(
                'Payment was not successful',
                HttpStatus.BAD_REQUEST,
            );
        }
        await this.createPurchasedEventTicket(
            {
                ...paystackData.metadata,
                customerEmail: paystackData.customer?.email,
                customerPhone: paystackData.customer?.phone,
            },
            paystackData.reference,
        );
        return { success: true, message: 'Ticket confirmed' };
    }

    async createPurchasedEventTicket(metadata: any, paystackReference: string) {
        const existing = await this.prisma.payment.findUnique({
            where: { paystackReference },
        });
        if (existing) return;

        const event = await this.eventSharedService.helperEventFindById(
            metadata.eventId,
        );
        if (!event) return;

        const noOfTickets = parseInt(String(metadata.noOfTickets ?? 1), 10);
        await this.assertEventCapacity(
            event.id,
            event.capacity,
            noOfTickets,
            metadata.ticketCategoryId,
        );
        const price = await this.resolveTicketPrice(
            event.id,
            metadata.ticketCategoryId,
        );
        const preOrderMenu: {
            id: string;
            name: string;
            price: number;
            quantity: number;
        }[] = metadata.preOrderMenu ?? [];
        const menuTotal = preOrderMenu.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
        );
        const totalPrice = price * noOfTickets + menuTotal;
        const amountPaid = Number(metadata.amountPaid ?? totalPrice);
        const outstandingAmount = Number(metadata.outstandingAmount ?? 0);

        const payment = await this.prisma.payment.create({
            data: {
                userId: metadata.userId,
                paystackReference,
                paymentStatus: metadata.paymentStatus ?? 'SUCCEEDED',
                paymentMethod: metadata.paymentMethod ?? 'PAYSTACK',
                totalPrice: new Decimal(amountPaid),
                perItemPrice: new Decimal(price),
                noOfItems: noOfTickets,
                isPaid: metadata.isPaid ?? true,
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
                amountPaid: new Decimal(amountPaid),
                outstandingAmount: new Decimal(outstandingAmount),
                paymentDueDate: metadata.paymentDueDate
                    ? new Date(metadata.paymentDueDate)
                    : null,
                paymentPlan: metadata.paymentPlan,
                preOrderMenu: metadata.preOrderMenu,
            },
        });

        if (metadata.ticketCategoryId) {
            await this.prisma.ticketCategory.update({
                where: { id: metadata.ticketCategoryId },
                data: { available: { decrement: noOfTickets } },
            });
        }

        const admin = await this.prisma.user.findFirst({
            where: { role: { name: 'ADMIN' }, isDeleted: false },
        });
        const user = await this.userService.findOne({ id: metadata.userId });
        const attendeeName =
            user?.name ?? metadata.guestName ?? metadata.customerName ?? 'Guest';
        const attendeeEmail =
            user?.email ?? metadata.guestEmail ?? metadata.customerEmail;

        try {
            const notification = await this.notificationService.addNotification(
                {
                    type: NotificationType.EVENT_TICKET,
                    eventTicketId: eventTicket.id,
                    userId: admin?.id,
                } as any,
            );

            loggers.info('Event ticket notification created: %O', {
                type: NotificationType.EVENT_TICKET,
                body: `A new Event Ticket has been purchased by ${attendeeName}.`,
                eventTicketId: eventTicket.id,
                _id: (notification as any)?.id,
                userId: admin?.id,
            });
        } catch (e) {
            loggers.error('Notification error: %O', e);
        }

        try {
            const purchasedOn = moment().format('MMMM DD, YYYY');
            const eventDate = event.startDate
                ? moment(event.startDate).format('dddd, MMMM DD, YYYY')
                : null;
            const eventTime = event.startDate
                ? moment(event.startDate).format('h:mm A')
                : null;
            const eventVenue =
                (event as any).location?.name ??
                (event as any).location?.address ??
                null;

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
                        attendeeName,
                        attendeeEmail: attendeeEmail ?? '',
                        purchasedOn,
                        orderId: eventTicket.id,
                        price: price.toLocaleString(),
                        currency: 'KES',
                    }).then((buf) => ({
                        filename: `glee-ticket-${i + 1}.pdf`,
                        content: buf,
                        contentType: 'application/pdf',
                    })),
                ),
            );

            await this.emailService.sendMail({
                template: 'emails/event/event-ticket',
                message: {
                    to: [attendeeEmail].filter(Boolean) as string[],
                    subject: `Your ticket for ${event.name} — Glee`,
                    attachments: pdfAttachments,
                },
                locals: {
                    purchasedOn,
                    userEmail: attendeeEmail,
                    userName: attendeeName,
                    ticketId: eventTicket.id,
                    productTitle: event.name,
                    eventDate,
                    eventTime,
                    eventVenue,
                    total: amountPaid.toLocaleString(),
                    orderTotal: totalPrice.toLocaleString(),
                    subTotal: (price * noOfTickets).toLocaleString(),
                    menuItems: preOrderMenu.map((item) => ({
                        name: item.name,
                        quantity: item.quantity,
                        price: (item.price * item.quantity).toLocaleString(),
                    })),
                    menuTotal:
                        menuTotal > 0 ? menuTotal.toLocaleString() : null,
                    noOfItems: noOfTickets,
                    paymentPlan: metadata.paymentPlan
                        ? {
                              ...metadata.paymentPlan,
                              depositAmount:
                                  metadata.paymentPlan.depositAmount?.toLocaleString?.() ??
                                  metadata.paymentPlan.depositAmount,
                              menuAmount:
                                  metadata.paymentPlan.menuAmount?.toLocaleString?.() ??
                                  metadata.paymentPlan.menuAmount,
                              securityFeeAmount:
                                  metadata.paymentPlan.securityFeeAmount?.toLocaleString?.() ??
                                  metadata.paymentPlan.securityFeeAmount,
                              dueNow:
                                  metadata.paymentPlan.dueNow?.toLocaleString?.() ??
                                  metadata.paymentPlan.dueNow,
                              remainingAmount:
                                  metadata.paymentPlan.remainingAmount?.toLocaleString?.() ??
                                  metadata.paymentPlan.remainingAmount,
                              totalAmount:
                                  metadata.paymentPlan.totalAmount?.toLocaleString?.() ??
                                  metadata.paymentPlan.totalAmount,
                              finalDueDate: moment(
                                  metadata.paymentPlan.finalDueDate,
                              ).format('dddd, MMMM DD, YYYY'),
                              installments: (
                                  metadata.paymentPlan.installments ?? []
                              ).map((installment) => ({
                                  ...installment,
                                  amount:
                                      installment.amount?.toLocaleString?.() ??
                                      installment.amount,
                                  dueDate: moment(installment.dueDate).format(
                                      'MMMM DD, YYYY',
                                  ),
                              })),
                          }
                        : null,
                    productImage: event.photos?.[0] ?? null,
                    orderType: 'Event',
                },
            });
        } catch (e) {
            loggers.error('Email error: %O', e);
        }
    }

    async createEventTicketViaPaystack(data: any) {
        const metadata = data.metadata;
        return this.createPurchasedEventTicket(
            {
                ...metadata,
                depositAmount: metadata.depositAmount,
            },
            data.reference,
        );
    }

    async findAll(page = 1, limit = 10, filter?: any, currentUser?: any) {
        const where: any = { ...filter };
        const vendorId = this.resolveVendorAccountId(currentUser, false);
        if (vendorId) where.event = { vendorId };

        const [tickets, ticketsCount] = await Promise.all([
            this.prisma.eventTicket.findMany({
                where,
                include: {
                    event: true,
                    payment: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                        },
                    },
                    ticketCategory: true,
                    checkedInBy: {
                        select: { id: true, name: true, email: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.eventTicket.count({ where }),
        ]);

        if (tickets.length === 0)
            return { success: false, message: 'No tickets sold yet', data: [] };

        return {
            success: true,
            message: 'Tickets fetched successfully',
            data: tickets,
            totalPages: Math.ceil(ticketsCount / limit),
            page,
            limit,
        };
    }

    async getTicketById(id: string, currentUser?: any) {
        const ticket = await this.findScopedTicketOrThrow(
            id,
            currentUser,
            false,
        );
        const supportNotes = currentUser
            ? await this.prisma.auditLog.findMany({
                  where: {
                      entity: 'EventTicket',
                      entityId: id,
                      action: 'tickets.support_note',
                  },
                  include: {
                      actor: {
                          select: {
                              id: true,
                              name: true,
                              email: true,
                              role: true,
                          },
                      },
                  },
                  orderBy: { createdAt: 'desc' },
              })
            : [];
        return {
            success: true,
            message: 'Ticket fetched successfully',
            data: { ...ticket, supportNotes },
        };
    }

    async addSupportNote(id: string, note: string, currentUser: any) {
        const ticket = await this.findScopedTicketOrThrow(
            id,
            currentUser,
            false,
        );
        if (
            ![
                UserRole.SUPER_ADMIN,
                UserRole.ADMIN,
                UserRole.CUSTOMER_SUPPORT,
            ].includes(currentUser?.role)
        ) {
            throw new HttpException(
                'Only support or admin users can add support notes',
                HttpStatus.FORBIDDEN,
            );
        }

        const supportNote = await this.prisma.auditLog.create({
            data: {
                actorId: currentUser.id,
                action: 'tickets.support_note',
                entity: 'EventTicket',
                entityId: id,
                metadata: {
                    note,
                    eventId: ticket.eventId,
                    userId: ticket.userId,
                },
            },
            include: {
                actor: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });

        return {
            success: true,
            message: 'Support note added successfully',
            data: supportNote,
        };
    }

    async checkInTicket(id: string, currentUser: any) {
        this.assertVendorCheckInRole(currentUser);
        const ticket = await this.findScopedTicketOrThrow(id, currentUser);
        if (ticket.checkedInAt) {
            return {
                success: true,
                message: 'Ticket is already checked in',
                data: ticket,
            };
        }

        const checkedInAt = new Date();
        const updated = await this.prisma.eventTicket.update({
            where: { id },
            data: {
                checkedInAt,
                checkedInById: currentUser.id,
            },
            include: {
                event: true,
                payment: true,
                user: {
                    select: { id: true, name: true, email: true, phone: true },
                },
                ticketCategory: true,
                checkedInBy: { select: { id: true, name: true, email: true } },
            },
        });

        await this.prisma.auditLog.create({
            data: {
                actorId: currentUser.id,
                action: 'tickets.check_in',
                entity: 'EventTicket',
                entityId: id,
                metadata: {
                    eventId: ticket.eventId,
                    vendorId: ticket.event.vendorId,
                    checkedInAt: checkedInAt.toISOString(),
                },
            },
        });

        return {
            success: true,
            message: 'Ticket checked in successfully',
            data: updated,
        };
    }

    async revertTicketCheckIn(id: string, currentUser: any) {
        this.assertVendorCheckInRole(currentUser);
        const ticket = await this.findScopedTicketOrThrow(id, currentUser);
        if (!ticket.checkedInAt) {
            return {
                success: true,
                message: 'Ticket has not been checked in',
                data: ticket,
            };
        }

        const updated = await this.prisma.eventTicket.update({
            where: { id },
            data: {
                checkedInAt: null,
                checkedInById: null,
            },
            include: {
                event: true,
                payment: true,
                user: {
                    select: { id: true, name: true, email: true, phone: true },
                },
                ticketCategory: true,
                checkedInBy: { select: { id: true, name: true, email: true } },
            },
        });

        await this.prisma.auditLog.create({
            data: {
                actorId: currentUser.id,
                action: 'tickets.check_in_revert',
                entity: 'EventTicket',
                entityId: id,
                metadata: {
                    eventId: ticket.eventId,
                    vendorId: ticket.event.vendorId,
                },
            },
        });

        return {
            success: true,
            message: 'Ticket check-in reverted successfully',
            data: updated,
        };
    }

    async findTicketsByUserID(userId: string, queryData: any) {
        const { page, limit, eventId } = queryData;
        const where: any = { userId };
        if (eventId) where.eventId = eventId;

        const tickets = await this.prisma.eventTicket.findMany({
            where,
            include: {
                event: { include: { category: true, location: true } },
                payment: true,
                ticketCategory: true,
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        });

        if (tickets.length === 0)
            return {
                success: true,
                message: 'No tickets bought yet',
                data: [],
            };

        const grouped: Record<string, any> = {};
        tickets.forEach((t) => {
            const eid = t.eventId;
            if (!grouped[eid])
                grouped[eid] = {
                    event: t.event,
                    tickets: [],
                    noOfTicketsPurchased: 0,
                    totalPrice: 0,
                };
            grouped[eid].tickets.push(t);
            grouped[eid].noOfTicketsPurchased += t.payment?.noOfItems ?? 0;
            grouped[eid].totalPrice += Number(t.payment?.totalPrice ?? 0);
        });

        const data = Object.values(grouped).map((g) => ({
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
        };
    }

    async getAvailableTicktesOfEvent(queryData: PaginationQueryDto) {
        const { page, limit, eventId } = queryData;
        const event = await this.prisma.event.findFirst({
            where: { id: eventId, isDeleted: false, status: 'ACTIVE' },
        });
        if (!event)
            return { success: false, message: 'Event not found', data: [] };

        const [tickets, ticketsCount, sold, categories] = await Promise.all([
            this.prisma.eventTicket.findMany({
                where: { eventId },
                include: { user: true },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.eventTicket.count({ where: { eventId } }),
            this.prisma.eventTicket.aggregate({
                where: { eventId },
                _sum: { quantity: true },
            }),
            this.prisma.ticketCategory.findMany({
                where: { eventId },
                select: { available: true, capacity: true },
            }),
        ]);

        const ticketsSold = sold._sum.quantity ?? 0;
        const categoryCapacity = categories.reduce(
            (sum, category) => sum + Number(category.capacity ?? 0),
            0,
        );
        const categoryAvailable = categories.reduce(
            (sum, category) =>
                sum + Number(category.available ?? category.capacity ?? 0),
            0,
        );
        const ticketsCapacity = categories.length
            ? categoryCapacity
            : event.capacity;
        const ticketsAvailable = categories.length
            ? categoryAvailable
            : event.capacity - ticketsSold;
        return {
            success: true,
            data: {
                ticketsCapacity,
                ticketsSold,
                ticketsAvailable,
                tickets,
                totalPages: Math.ceil(ticketsCount / limit),
                page,
                limit,
            },
        };
    }

    private async resolveTicketPrice(
        eventId: string,
        ticketCategoryId?: string,
    ) {
        if (ticketCategoryId) {
            const category = await this.prisma.ticketCategory.findFirst({
                where: { id: ticketCategoryId, eventId },
            });
            if (!category) {
                throw new HttpException(
                    'Ticket category not found',
                    HttpStatus.BAD_REQUEST,
                );
            }
            return Number(category.price);
        }

        const category = await this.prisma.ticketCategory.findFirst({
            where: { eventId },
            orderBy: { createdAt: 'asc' },
        });
        return category ? Number(category.price) : 0;
    }

    private async assertEventCapacity(
        eventId: string,
        capacity: number,
        requestedTickets: number,
        ticketCategoryId?: string,
    ) {
        if (ticketCategoryId) {
            const category = await this.prisma.ticketCategory.findFirst({
                where: { id: ticketCategoryId, eventId },
            });
            if (!category) {
                throw new HttpException(
                    'Ticket category not found',
                    HttpStatus.BAD_REQUEST,
                );
            }
            const available =
                category.available ?? category.capacity ?? capacity ?? 0;
            if (available < requestedTickets) {
                throw new HttpException(
                    'No tickets available',
                    HttpStatus.BAD_REQUEST,
                );
            }
            return;
        }

        const categories = await this.prisma.ticketCategory.findMany({
            where: { eventId },
            select: { available: true, capacity: true },
        });
        if (categories.length) {
            const available = categories.reduce(
                (sum, category) =>
                    sum + Number(category.available ?? category.capacity ?? 0),
                0,
            );
            if (available < requestedTickets) {
                throw new HttpException(
                    'No tickets available',
                    HttpStatus.BAD_REQUEST,
                );
            }
            return;
        }

        const sold = await this.prisma.eventTicket.aggregate({
            where: { eventId },
            _sum: { quantity: true },
        });
        const soldCount = sold._sum.quantity ?? 0;
        if (capacity - soldCount < requestedTickets) {
            throw new HttpException(
                'No tickets available',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    private resolvePaystackEmail(email?: string | null) {
        const normalized = String(email ?? '').trim().toLowerCase();
        const hasValidShape = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
            normalized,
        );
        const hasUnsupportedTestDomain = /\.(test|local|invalid)$/i.test(
            normalized,
        );
        if (!hasValidShape || hasUnsupportedTestDomain) {
            throw new HttpException(
                'Your account email cannot be used for Paystack payments. Please update your profile with a real email address before purchasing.',
                HttpStatus.BAD_REQUEST,
            );
        }
        return normalized;
    }

    async remove(eventId?: string, userId?: string) {
        const where: any = {};
        if (eventId) where.eventId = eventId;
        if (userId) where.userId = userId;
        await this.prisma.eventTicket.deleteMany({ where });
    }

    async removeTicket(id: string) {
        const ticket = await this.prisma.eventTicket.findFirst({
            where: { id },
        });
        if (!ticket)
            throw new HttpException('Ticket not found', HttpStatus.BAD_REQUEST);
        await this.prisma.eventTicket.delete({ where: { id } });
    }

    async removePermanently() {
        await this.prisma.eventTicket.deleteMany({});
        return { success: true };
    }

    private resolveVendorAccountId(user: any, required = true) {
        if (user?.role === UserRole.VENDOR) return user.id;
        if (user?.role === UserRole.VENDOR_STAFF && user.vendorAccountId)
            return user.vendorAccountId;
        if (required)
            throw new HttpException(
                'Vendor account scope is required',
                HttpStatus.FORBIDDEN,
            );
        return null;
    }

    private async findScopedTicketOrThrow(
        id: string,
        currentUser: any,
        requireVendorScope = true,
    ) {
        const ticket = await this.prisma.eventTicket.findFirst({
            where: { id },
            include: {
                event: true,
                payment: true,
                user: {
                    select: { id: true, name: true, email: true, phone: true },
                },
                ticketCategory: true,
                checkedInBy: { select: { id: true, name: true, email: true } },
            },
        });
        if (!ticket)
            throw new HttpException('Ticket not found', HttpStatus.NOT_FOUND);

        if (
            [UserRole.VENDOR, UserRole.VENDOR_STAFF].includes(currentUser?.role)
        ) {
            const vendorId = this.resolveVendorAccountId(currentUser);
            if (ticket.event.vendorId !== vendorId) {
                throw new HttpException(
                    'You do not have access to this ticket',
                    HttpStatus.FORBIDDEN,
                );
            }
        } else if (
            requireVendorScope &&
            ![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(currentUser?.role)
        ) {
            throw new HttpException(
                'Vendor account scope is required',
                HttpStatus.FORBIDDEN,
            );
        }

        return ticket;
    }

    private assertVendorCheckInRole(user: any) {
        if (![UserRole.VENDOR, UserRole.VENDOR_STAFF].includes(user?.role)) {
            throw new HttpException(
                'Only vendor users can check in tickets',
                HttpStatus.FORBIDDEN,
            );
        }
    }
}
