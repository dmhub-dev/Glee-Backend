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
        updateMany: jest.fn(),
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

  it('moves active events with a non-null elapsed start date to live', async () => {
    prisma.event.findMany.mockResolvedValue([]);

    await scheduler.syncEventStatuses();

    expect(prisma.event.updateMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        status: EventStatus.ACTIVE,
        startDate: { not: null, lte: now },
      },
      data: { status: EventStatus.LIVE },
    });
  });

  it('moves live events with a non-null elapsed end date to ended and expires attendant access', async () => {
    prisma.event.findMany.mockResolvedValue([{ id: 'event-1' }, { id: 'event-2' }]);

    await scheduler.syncEventStatuses();

    expect(prisma.event.findMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        status: EventStatus.LIVE,
        endDate: { not: null, lte: now },
      },
      select: { id: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.event.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'event-1' },
      data: { status: EventStatus.ENDED },
    });
    expect(prisma.event.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'event-2' },
      data: { status: EventStatus.ENDED },
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
    expect(prisma.eventTicketAttendant.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        eventId: 'event-2',
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
    expect(prisma.eventTicketAttendantSession.updateMany).toHaveBeenNthCalledWith(2, {
      where: { eventId: 'event-2', revokedAt: null },
      data: { revokedAt: now },
    });
  });

  it('returns after active to live update when there are no live events to end', async () => {
    prisma.event.findMany.mockResolvedValue([]);

    await scheduler.syncEventStatuses();

    expect(prisma.event.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.eventTicketAttendant.updateMany).not.toHaveBeenCalled();
    expect(prisma.eventTicketAttendantSession.updateMany).not.toHaveBeenCalled();
  });
});
