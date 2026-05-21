import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { EventTicketsService } from './event-tickets.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { EventSharedService } from '../shared/shared.event.service';
import { UsersService } from '../../users/users.service';
import { EmailService } from '@src/email-server/email.service';
import { NotificationService } from '@src/notification/notification.service';
import { PayStackService } from '@src/paystack/paystack.service';

const mockEvent = {
  id: 'event-1',
  name: 'Test Event',
  price: 1000,
  availableTickets: 50,
  bannerImages: [],
  location: 'Nairobi',
  startDate: new Date('2026-06-01T20:00:00Z'),
};

const mockUser = { id: 'user-guest-1', email: 'jane@example.com', name: 'Jane Doe' };

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
            ticketCategory: { findUnique: jest.fn().mockResolvedValue(null) },
            payment: { findUnique: jest.fn(), create: jest.fn() },
            eventTicket: { create: jest.fn() },
            event: { update: jest.fn() },
          },
        },
        {
          provide: EventSharedService,
          useValue: { helperEventFindById: jest.fn().mockResolvedValue(mockEvent) },
        },
        { provide: UsersService, useValue: { findOne: jest.fn() } },
        { provide: EmailService, useValue: { sendMail: jest.fn() } },
        { provide: NotificationService, useValue: { addNotification: jest.fn() } },
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
    expect(result).toMatchObject({ success: true, data: { access_code: 'ac_test', reference: 'ref_test' } });
  });

  it('uses ticketCategory price when ticketCategoryId provided', async () => {
    prisma.ticketCategory.findUnique.mockResolvedValue({ id: 'cat-1', price: 1500 });

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
    price: 1000,
    bannerImages: [],
    location: 'Nairobi',
    startDate: new Date('2026-06-01T20:00:00Z'),
  };

  const mockUserData = { id: 'user-1', name: 'Jane', email: 'jane@example.com' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventTicketsService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              upsert: jest.fn(),
              findFirst: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@glee.app' }),
            },
            payment: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
            },
            eventTicket: {
              create: jest.fn().mockResolvedValue({ id: 'ticket-1', eventId: 'event-1', userId: 'user-1' }),
            },
            event: { update: jest.fn() },
            ticketCategory: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: EventSharedService,
          useValue: { helperEventFindById: jest.fn().mockResolvedValue(mockEventData) },
        },
        {
          provide: UsersService,
          useValue: { findOne: jest.fn().mockResolvedValue(mockUserData) },
        },
        { provide: EmailService, useValue: { sendMail: jest.fn() } },
        {
          provide: NotificationService,
          useValue: { addNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }) },
        },
        {
          provide: PayStackService,
          useValue: { createPaymentIntent: jest.fn() },
        },
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
});
