import { HttpStatus } from '@nestjs/common';
import {
  EventStatus,
  TicketAttendantStatus,
  TicketCheckInAttemptResult,
  TicketCheckInAttemptSource,
  TicketStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { TicketAttendantsService } from './ticket-attendants.service';

describe('TicketAttendantsService', () => {
  let service: TicketAttendantsService;
  let prisma: any;
  let emailService: any;

  const hashSecret = (value: string) =>
    createHash('sha256').update(value).digest('hex');

  beforeEach(() => {
    prisma = {
      eventTicketAttendant: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      eventTicketAttendantSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      eventTicket: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      ticketCheckInAttempt: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callbackOrQueries: any) => {
        if (typeof callbackOrQueries === 'function') {
          return callbackOrQueries(prisma);
        }
        return Promise.all(callbackOrQueries);
      }),
    };
    emailService = { sendMail: jest.fn() };
    service = new TicketAttendantsService(
      prisma,
      { get: jest.fn() } as any,
      emailService,
    );
  });

  it('allows attendant access within the pre-live window and creates one active session', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-03T09:15:00.000Z'));
    const pinHash = await bcrypt.hash('123456', 10);
    prisma.eventTicketAttendant.findUnique.mockResolvedValue({
      id: 'attendant-1',
      eventId: 'event-1',
      name: 'Gate Lead',
      email: 'gate@example.com',
      pinHash,
      status: TicketAttendantStatus.INVITED,
      sessionActive: false,
      event: {
        id: 'event-1',
        name: 'Launch Night',
        status: EventStatus.ACTIVE,
        startDate: new Date('2026-06-03T10:00:00.000Z'),
        endDate: new Date('2026-06-03T14:00:00.000Z'),
      },
    });
    prisma.eventTicketAttendantSession.findFirst.mockResolvedValue(null);
    prisma.eventTicketAttendant.updateMany.mockResolvedValue({ count: 1 });
    prisma.eventTicketAttendantSession.create.mockResolvedValue({
      id: 'session-1',
    });
    prisma.eventTicketAttendant.update.mockResolvedValue({
      id: 'attendant-1',
      name: 'Gate Lead',
      email: 'gate@example.com',
      status: TicketAttendantStatus.ACTIVE,
      event: {
        id: 'event-1',
        name: 'Launch Night',
        status: EventStatus.ACTIVE,
        startDate: new Date('2026-06-03T10:00:00.000Z'),
        endDate: new Date('2026-06-03T14:00:00.000Z'),
      },
    });

    const response = await service.accessDesk(
      {
        token: 'invite-token',
        name: 'Gate Lead',
        email: 'gate@example.com',
        pin: '123456',
      },
      { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } },
    );

    expect(prisma.eventTicketAttendant.findUnique).toHaveBeenCalledWith({
      where: { inviteTokenHash: hashSecret('invite-token') },
      include: { event: true },
    });
    expect(prisma.eventTicketAttendantSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendantId: 'attendant-1',
          eventId: 'event-1',
        }),
      }),
    );
    expect(response.data.attendant.email).toBe('ga***@example.com');
    expect(response.data.event.id).toBe('event-1');
    jest.useRealTimers();
  });

  it('builds attendant invite links from frontend URL, not backend APP_URL', () => {
    const configuredService = new TicketAttendantsService(
      prisma,
      {
        get: jest.fn((key: string) => ({
          ATTENDANT_APP_URL: undefined,
          CLIENT_APP_URL: 'http://localhost:3001',
          APP_URL: 'http://localhost:8003',
        })[key]),
      } as any,
      emailService,
    );

    expect((configuredService as any).buildInviteUrl('invite-token')).toBe(
      'http://localhost:3001/ticket-attendant/access?token=invite-token',
    );
  });

  it('blocks a second active attendant session', async () => {
    const pinHash = await bcrypt.hash('123456', 10);
    prisma.eventTicketAttendant.findUnique.mockResolvedValue({
      id: 'attendant-1',
      eventId: 'event-1',
      name: 'Gate Lead',
      email: 'gate@example.com',
      pinHash,
      status: TicketAttendantStatus.ACTIVE,
      sessionActive: true,
      event: {
        id: 'event-1',
        name: 'Launch Night',
        status: EventStatus.LIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 60_000),
      },
    });
    prisma.eventTicketAttendantSession.findFirst.mockResolvedValue({
      id: 'session-1',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.accessDesk(
        {
          token: 'invite-token',
          name: 'Gate Lead',
          email: 'gate@example.com',
          pin: '123456',
        },
        {},
      ),
    ).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
  });

  it('checks in a live event ticket and records the attendant attempt', async () => {
    const session = {
      id: 'session-1',
      attendantId: 'attendant-1',
      eventId: 'event-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      event: {
        id: 'event-1',
        status: EventStatus.LIVE,
        endDate: new Date(Date.now() + 60_000),
      },
      attendant: {
        id: 'attendant-1',
        name: 'Gate Lead',
        email: 'gate@example.com',
        status: TicketAttendantStatus.ACTIVE,
        sessionActive: true,
        lastSessionId: 'session-1',
      },
    };
    prisma.eventTicketAttendantSession.findUnique.mockResolvedValue(session);
    prisma.eventTicket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      eventId: 'event-1',
      ticketRef: 'qr-1',
      ticketNumber: 1,
      status: TicketStatus.ACTIVE,
      checkedInAt: null,
      event: session.event,
      user: { name: 'Guest One', email: 'guest@example.com', phone: '0712345678' },
      ticketCategory: { name: 'VIP' },
      checkedInByAttendant: null,
    });
    prisma.eventTicket.updateMany.mockResolvedValue({ count: 1 });
    prisma.eventTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      ticketRef: 'qr-1',
      ticketNumber: 1,
      status: TicketStatus.USED,
      checkedInAt: new Date(),
      user: { name: 'Guest One', email: 'guest@example.com', phone: '0712345678' },
      ticketCategory: { name: 'VIP' },
      checkedInByAttendant: { id: 'attendant-1', name: 'Gate Lead' },
    });

    const response = await service.checkIn('session-token', {
      ticketRef: 'qr-1',
      source: 'QR',
    });

    expect(prisma.eventTicket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'ticket-1',
          status: TicketStatus.ACTIVE,
          checkedInAt: null,
        },
        data: expect.objectContaining({
          status: TicketStatus.USED,
          checkedInByAttendantId: 'attendant-1',
        }),
      }),
    );
    expect(prisma.ticketCheckInAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'event-1',
        ticketId: 'ticket-1',
        attendantId: 'attendant-1',
        result: TicketCheckInAttemptResult.SUCCESS,
        source: TicketCheckInAttemptSource.QR,
      }),
    });
    expect(response.data.ticketRef).toBe('qr-1');
    expect(response.data.attendee.email).toBe('gu***@example.com');
  });
});
