import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { EventTicketsService } from './event-tickets.service';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { EventSharedService } from '@src/modules/events/shared/shared.event.service';
import { UsersService } from '@src/modules/identity/users/users.service';
import { EmailService } from '@src/infrastructure/email/email.service';
import { NotificationService } from '@src/modules/notifications/notifications/notification.service';
import { PayStackService } from '@src/infrastructure/payments/paystack/paystack.service';
import { WalletService } from '@src/modules/wallets/wallet/wallet.service';
import { PlatformSettingsService } from '@src/modules/settings/platform-settings.service';

const mockEvent = {
    id: 'event-1',
    name: 'Test Event',
    capacity: 50,
    photos: [],
    location: { name: 'Nairobi' },
    startDate: new Date('2026-06-01T20:00:00Z'),
};

const mockUser = {
    id: 'user-guest-1',
    email: 'jane@example.com',
    name: 'Jane Doe',
};

const mockPlatformSettingsProvider = {
    provide: PlatformSettingsService,
    useValue: {
        getEventCheckoutSettings: jest.fn().mockResolvedValue({
            walletInstallmentDepositType: 'PERCENTAGE',
            walletInstallmentDepositPercent: 30,
            walletInstallmentDepositAmount: 0,
            walletInstallmentSecurityFeeType: 'PERCENTAGE',
            walletInstallmentSecurityFeePercent: 5,
            walletInstallmentSecurityFeeAmount: 0,
        }),
    },
};

describe('EventTicketsService.initiateGuestPurchase', () => {
    let service: EventTicketsService;
    let prisma: any;
    let paystack: any;
    let eventShared: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventTicketsService,
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            upsert: jest.fn().mockResolvedValue(mockUser),
                            findFirst: jest.fn().mockResolvedValue(null),
                        },
                        ticketCategory: {
                            findMany: jest
                                .fn()
                                .mockResolvedValue([
                                    { available: 50, capacity: 50 },
                                ]),
                            findFirst: jest
                                .fn()
                                .mockResolvedValue({
                                    id: 'cat-default',
                                    price: 1000,
                                    available: 50,
                                    capacity: 50,
                                }),
                        },
                        payment: { findUnique: jest.fn(), create: jest.fn() },
                        eventTicket: {
                            create: jest.fn(),
                            aggregate: jest
                                .fn()
                                .mockResolvedValue({ _sum: { quantity: 0 } }),
                        },
                    },
                },
                {
                    provide: EventSharedService,
                    useValue: {
                        helperEventFindById: jest
                            .fn()
                            .mockResolvedValue(mockEvent),
                    },
                },
                { provide: UsersService, useValue: { findOne: jest.fn() } },
                { provide: EmailService, useValue: { sendMail: jest.fn() } },
                {
                    provide: NotificationService,
                    useValue: { addNotification: jest.fn() },
                },
                {
                    provide: PayStackService,
                    useValue: {
                        createPaymentIntent: jest.fn().mockResolvedValue({
                            access_code: 'ac_test',
                            reference: 'ref_test',
                            verificationToken: 'vt_test',
                        }),
                    },
                },
                { provide: WalletService, useValue: { debit: jest.fn() } },
                mockPlatformSettingsProvider,
            ],
        }).compile();

        service = module.get<EventTicketsService>(EventTicketsService);
        prisma = module.get(PrismaService);
        paystack = module.get(PayStackService);
        eventShared = module.get(EventSharedService);
    });

    it('upserts guest user and returns access_code', async () => {
        const result = await service.initiateGuestPurchase({
            eventId: 'event-1',
            noOfTickets: 2,
            guestName: 'Jane Doe',
            guestEmail: 'jane@example.com',
            guestPhone: '+254700000000',
        });

        expect(prisma.user.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { email: 'jane@example.com' },
            }),
        );
        expect(paystack.createPaymentIntent).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'jane@example.com',
                amount: 2000,
            }),
        );
        expect(result).toMatchObject({
            success: true,
            data: { access_code: 'ac_test', reference: 'ref_test' },
        });
    });

    it('uses ticketCategory price when ticketCategoryId provided', async () => {
        prisma.ticketCategory.findFirst.mockResolvedValue({
            id: 'cat-1',
            price: 1500,
        });

        await service.initiateGuestPurchase({
            eventId: 'event-1',
            ticketCategoryId: 'cat-1',
            noOfTickets: 1,
            guestName: 'Jane',
            guestEmail: 'jane@example.com',
            guestPhone: '+254700000000',
        });

        expect(paystack.createPaymentIntent).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 1500 }),
        );
    });

    it('throws 400 when event not found', async () => {
        eventShared.helperEventFindById.mockResolvedValue(null);

        await expect(
            service.initiateGuestPurchase({
                eventId: 'bad-id',
                noOfTickets: 1,
                guestName: 'Jane',
                guestEmail: 'jane@example.com',
                guestPhone: '+254700000000',
            }),
        ).rejects.toThrow(HttpException);
    });
});

describe('EventTicketsService.createPurchasedEventTicket - tier decrement', () => {
    let service: EventTicketsService;
    let prisma: any;
    let userService: any;
    let emailService: any;

    const mockEventData = {
        id: 'event-1',
        name: 'Test Event',
        capacity: 50,
        photos: [],
        location: { name: 'Nairobi' },
        startDate: new Date('2026-06-01T20:00:00Z'),
    };

    const mockUserData = {
        id: 'user-1',
        name: 'Jane',
        email: 'jane@example.com',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventTicketsService,
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            upsert: jest.fn(),
                            findFirst: jest
                                .fn()
                                .mockResolvedValue({
                                    id: 'admin-1',
                                    email: 'admin@glee.app',
                                }),
                        },
                        payment: {
                            findUnique: jest.fn().mockResolvedValue(null),
                            create: jest
                                .fn()
                                .mockResolvedValue({ id: 'payment-1' }),
                        },
                        eventTicket: {
                            create: jest
                                .fn()
                                .mockResolvedValue({
                                    id: 'ticket-1',
                                    eventId: 'event-1',
                                    userId: 'user-1',
                                    purchaseGroupId: 'group-1',
                                    ticketRef: 'group-1-1',
                                    ticketNumber: 1,
                                    quantity: 1,
                                }),
                            aggregate: jest
                                .fn()
                                .mockResolvedValue({ _sum: { quantity: 0 } }),
                        },
                        ticketCategory: {
                            findMany: jest
                                .fn()
                                .mockResolvedValue([
                                    { available: 50, capacity: 50 },
                                ]),
                            findFirst: jest
                                .fn()
                                .mockResolvedValue({
                                    id: 'cat-1',
                                    price: 1000,
                                    available: 50,
                                    capacity: 50,
                                }),
                            update: jest.fn(),
                        },
                    },
                },
                {
                    provide: EventSharedService,
                    useValue: {
                        helperEventFindById: jest
                            .fn()
                            .mockResolvedValue(mockEventData),
                    },
                },
                {
                    provide: UsersService,
                    useValue: {
                        findOne: jest.fn().mockResolvedValue(mockUserData),
                    },
                },
                { provide: EmailService, useValue: { sendMail: jest.fn() } },
                {
                    provide: NotificationService,
                    useValue: {
                        addNotification: jest
                            .fn()
                            .mockResolvedValue({ id: 'notif-1' }),
                    },
                },
                {
                    provide: PayStackService,
                    useValue: { createPaymentIntent: jest.fn() },
                },
                { provide: WalletService, useValue: { debit: jest.fn() } },
                mockPlatformSettingsProvider,
            ],
        }).compile();

        service = module.get<EventTicketsService>(EventTicketsService);
        prisma = module.get(PrismaService);
        userService = module.get(UsersService);
        emailService = module.get(EmailService);
    });

    it('decrements ticketCategory.available when ticketCategoryId in metadata', async () => {
        await service.createPurchasedEventTicket(
            {
                userId: 'user-1',
                eventId: 'event-1',
                ticketCategoryId: 'cat-1',
                noOfTickets: 2,
                purchasingType: 'EVENT_TICKET',
            },
            'paystack-ref-123',
        );

        expect(prisma.ticketCategory.update).toHaveBeenCalledWith({
            where: { id: 'cat-1' },
            data: { available: { decrement: 2 } },
        });
    });

    it('creates one EventTicket row per purchased QR code', async () => {
        await service.createPurchasedEventTicket(
            {
                userId: 'user-1',
                eventId: 'event-1',
                ticketCategoryId: 'cat-1',
                noOfTickets: 5,
                purchasingType: 'EVENT_TICKET',
            },
            'paystack-ref-units',
        );

        expect(prisma.eventTicket.create).toHaveBeenCalledTimes(5);
        const createdRows = prisma.eventTicket.create.mock.calls.map(
            ([call]) => call.data,
        );
        expect(new Set(createdRows.map((row) => row.purchaseGroupId)).size).toBe(1);
        expect(createdRows.map((row) => row.ticketNumber)).toEqual([1, 2, 3, 4, 5]);
        expect(new Set(createdRows.map((row) => row.ticketRef)).size).toBe(5);
        expect(createdRows.every((row) => row.quantity === 1)).toBe(true);
    });

    it('does not call ticketCategory.update when no ticketCategoryId', async () => {
        await service.createPurchasedEventTicket(
            {
                userId: 'user-1',
                eventId: 'event-1',
                noOfTickets: 1,
                purchasingType: 'EVENT_TICKET',
            },
            'paystack-ref-456',
        );

        expect(prisma.ticketCategory.update).not.toHaveBeenCalled();
    });

    it('sends ticket email to metadata email when user lookup fails', async () => {
        userService.findOne.mockResolvedValue(null);

        await service.createPurchasedEventTicket(
            {
                userId: 'user-1',
                eventId: 'event-1',
                ticketCategoryId: 'cat-1',
                noOfTickets: 1,
                purchasingType: 'EVENT_TICKET',
                guestName: 'Guest Buyer',
                guestEmail: 'guest@example.com',
            },
            'paystack-ref-789',
        );

        expect(emailService.sendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.objectContaining({
                    to: ['guest@example.com'],
                }),
                locals: expect.objectContaining({
                    userEmail: 'guest@example.com',
                    userName: 'Guest Buyer',
                }),
            }),
        );
    });
});

describe('EventTicketsService.create - wallet payment', () => {
    let service: EventTicketsService;
    let prisma: any;
    let wallet: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventTicketsService,
                {
                    provide: PrismaService,
                    useValue: {
                        payment: {
                            findUnique: jest.fn().mockResolvedValue(null),
                            create: jest
                                .fn()
                                .mockResolvedValue({ id: 'payment-wallet-1' }),
                        },
                        eventTicket: {
                            create: jest
                                .fn()
                                .mockResolvedValue({
                                    id: 'ticket-wallet-1',
                                    eventId: 'event-1',
                                    userId: 'user-1',
                                    purchaseGroupId: 'wallet-group-1',
                                    ticketRef: 'wallet-group-1-1',
                                    ticketNumber: 1,
                                    quantity: 1,
                                }),
                            aggregate: jest
                                .fn()
                                .mockResolvedValue({ _sum: { quantity: 0 } }),
                        },
                        ticketCategory: {
                            findMany: jest
                                .fn()
                                .mockResolvedValue([
                                    { available: 50, capacity: 50 },
                                ]),
                            findFirst: jest
                                .fn()
                                .mockResolvedValue({
                                    id: 'cat-default',
                                    price: 1000,
                                    available: 50,
                                    capacity: 50,
                                }),
                            update: jest.fn(),
                        },
                        user: {
                            findFirst: jest
                                .fn()
                                .mockResolvedValue({ id: 'admin-1' }),
                        },
                    },
                },
                {
                    provide: EventSharedService,
                    useValue: {
                        helperEventFindById: jest
                            .fn()
                            .mockResolvedValue(mockEvent),
                    },
                },
                {
                    provide: UsersService,
                    useValue: {
                        findOne: jest
                            .fn()
                            .mockResolvedValue({
                                id: 'user-1',
                                email: 'user@example.com',
                                name: 'User',
                            }),
                    },
                },
                { provide: EmailService, useValue: { sendMail: jest.fn() } },
                {
                    provide: NotificationService,
                    useValue: {
                        addNotification: jest
                            .fn()
                            .mockResolvedValue({ id: 'notif-1' }),
                    },
                },
                {
                    provide: PayStackService,
                    useValue: { createPaymentIntent: jest.fn() },
                },
                {
                    provide: WalletService,
                    useValue: { debit: jest.fn().mockResolvedValue({}) },
                },
                mockPlatformSettingsProvider,
            ],
        }).compile();

        service = module.get<EventTicketsService>(EventTicketsService);
        prisma = module.get(PrismaService);
        wallet = module.get(WalletService);
    });

    it('debits wallet and creates WALLET payment for ticket purchase', async () => {
        await service.create(
            { eventId: 'event-1', noOfTickets: 2, useWallet: true },
            { id: 'user-1' },
        );

        expect(wallet.debit).toHaveBeenCalledWith(
            'user-1',
            2000,
            'Event ticket purchase: Test Event',
            expect.stringMatching(/^wallet_/),
            { eventId: 'event-1', noOfTickets: 2 },
        );
        expect(prisma.payment.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    paymentMethod: 'WALLET',
                    totalPrice: expect.anything(),
                }),
            }),
        );
    });
});

describe('EventTicketsService.checkInTicketByQr - ticket units', () => {
    let service: EventTicketsService;
    let prisma: any;

    beforeEach(async () => {
        const ticket = {
            id: 'ticket-unit-1',
            eventId: 'event-1',
            userId: 'user-1',
            ticketRef: 'unit-ref-1',
            ticketNumber: 1,
            quantity: 1,
            status: 'ACTIVE',
            checkedInAt: null,
            event: { id: 'event-1', vendorId: 'vendor-1' },
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventTicketsService,
                {
                    provide: PrismaService,
                    useValue: {
                        eventTicket: {
                            findFirst: jest.fn().mockResolvedValue(ticket),
                            update: jest.fn().mockResolvedValue({
                                ...ticket,
                                status: 'USED',
                                checkedInAt: new Date('2026-06-02T10:00:00Z'),
                            }),
                        },
                        auditLog: { create: jest.fn() },
                    },
                },
                {
                    provide: EventSharedService,
                    useValue: { helperEventFindById: jest.fn() },
                },
                { provide: UsersService, useValue: { findOne: jest.fn() } },
                { provide: EmailService, useValue: { sendMail: jest.fn() } },
                {
                    provide: NotificationService,
                    useValue: { addNotification: jest.fn() },
                },
                {
                    provide: PayStackService,
                    useValue: { createPaymentIntent: jest.fn() },
                },
                { provide: WalletService, useValue: { debit: jest.fn() } },
                mockPlatformSettingsProvider,
            ],
        }).compile();

        service = module.get<EventTicketsService>(EventTicketsService);
        prisma = module.get(PrismaService);
    });

    it('checks in exactly one ticket unit by ticketRef', async () => {
        await service.checkInTicketByQr(
            { eventId: 'event-1', ticketRef: 'unit-ref-1' },
            { id: 'vendor-1', role: 'VENDOR' },
        );

        expect(prisma.eventTicket.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { ticketRef: 'unit-ref-1' },
            }),
        );
        expect(prisma.eventTicket.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'ticket-unit-1' },
                data: expect.objectContaining({
                    status: 'USED',
                    checkedInById: 'vendor-1',
                }),
            }),
        );
    });
});
