import { EventStatus, TicketAttendantStatus } from '@prisma/client';
import { EventStatusScheduler } from './event-status.scheduler';

describe('EventStatusScheduler', () => {
  let scheduler: EventStatusScheduler;
  let prisma: any;
  const now = new Date('2026-06-03T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    prisma = {
      $transaction: jest.fn((callback) => callback(prisma)),
      event: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      eventTicketAttendant: {
        updateMany: jest.fn(),
      },
      eventTicketAttendantSession: {
        updateMany: jest.fn(),
      },
    };
    scheduler = new EventStatusScheduler(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves active events to live only when their effective start date has elapsed', async () => {
    prisma.event.findMany
      .mockResolvedValueOnce([
        {
          id: 'event-1',
          startDate: new Date('2026-06-01T12:00:00.000Z'),
          schedules: [],
        },
        {
          id: 'event-2',
          startDate: new Date('2026-06-01T12:00:00.000Z'),
          schedules: [{ startDate: new Date('2026-07-01T12:00:00.000Z') }],
        },
      ])
      .mockResolvedValueOnce([]);

    await scheduler.syncEventStatuses();

    expect(prisma.event.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        isDeleted: false,
        status: EventStatus.ACTIVE,
        OR: [
          { startDate: { not: null, lte: now } },
          { schedules: { some: { startDate: { lte: now } } } },
        ],
      },
      select: {
        id: true,
        startDate: true,
        schedules: {
          select: { startDate: true },
          orderBy: { startDate: 'asc' },
        },
      },
    });
    expect(prisma.event.update).toHaveBeenCalledTimes(1);
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { status: EventStatus.LIVE },
    });
  });

  it('moves live events with a non-null elapsed end date to ended and expires attendant access', async () => {
    prisma.event.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'event-1',
          endDate: new Date('2026-06-01T12:00:00.000Z'),
          schedules: [],
        },
        {
          id: 'event-2',
          endDate: new Date('2026-06-01T12:00:00.000Z'),
          schedules: [{ endDate: new Date('2026-07-01T12:00:00.000Z') }],
        },
      ]);

    await scheduler.syncEventStatuses();

    expect(prisma.event.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        isDeleted: false,
        status: EventStatus.LIVE,
        OR: [
          { endDate: { not: null, lte: now } },
          { schedules: { some: { endDate: { lte: now } } } },
        ],
      },
      select: {
        id: true,
        endDate: true,
        schedules: {
          select: { endDate: true },
          orderBy: { endDate: 'desc' },
        },
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.event.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'event-1' },
      data: {
        status: EventStatus.ENDED,
        endedAt: new Date('2026-06-01T12:00:00.000Z'),
      },
    });
    expect(prisma.eventTicketAttendant.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        eventId: 'event-1',
        status: {
          in: [TicketAttendantStatus.INVITED, TicketAttendantStatus.ACTIVE],
        },
      },
      data: {
        status: TicketAttendantStatus.EXPIRED,
        sessionActive: false,
      },
    });
    expect(prisma.eventTicketAttendantSession.updateMany).toHaveBeenNthCalledWith(1, {
      where: { eventId: 'event-1', revokedAt: null },
      data: { revokedAt: now },
    });
  });

  it('returns after active to live update when there are no live events to end', async () => {
    prisma.event.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await scheduler.syncEventStatuses();

    expect(prisma.event.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.eventTicketAttendant.updateMany).not.toHaveBeenCalled();
    expect(prisma.eventTicketAttendantSession.updateMany).not.toHaveBeenCalled();
  });
});
