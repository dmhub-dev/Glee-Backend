import { HttpException } from '@nestjs/common';
import { EventStatus, TicketAttendantStatus, UserRole } from '@prisma/client';
import { EventService } from './event.service';

describe('EventService location booking conflicts', () => {
    let service: EventService;
    let prisma: any;
    let s3: any;
    let eventSharedService: any;

    beforeEach(() => {
        prisma = {
            $transaction: jest.fn((callback) => callback(prisma)),
            location: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'loc-1',
                    status: 'ACTIVE',
                }),
            },
            category: { findFirst: jest.fn() },
            event: {
                findFirst: jest.fn(),
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue(0),
                create: jest.fn().mockResolvedValue({ id: 'event-1' }),
                update: jest.fn().mockResolvedValue({ id: 'event-1' }),
                findUnique: jest.fn().mockResolvedValue({ id: 'event-1' }),
            },
            eventTicketAttendant: {
                updateMany: jest.fn(),
            },
            eventTicketAttendantSession: {
                updateMany: jest.fn(),
            },
            auditLog: {
                create: jest.fn(),
            },
            ticketCategory: {
                createMany: jest.fn(),
                deleteMany: jest.fn(),
            },
            ticketWave: {
                findMany: jest.fn().mockResolvedValue([]),
                findUnique: jest.fn(),
                update: jest.fn(),
                create: jest.fn(),
                deleteMany: jest.fn(),
            },
            eventMenuItem: {
                createMany: jest.fn(),
                deleteMany: jest.fn(),
            },
            eventSchedule: {
                createMany: jest.fn(),
                deleteMany: jest.fn(),
            },
            eventTicket: {
                aggregate: jest
                    .fn()
                    .mockResolvedValue({ _sum: { quantity: 0 } }),
            },
        };
        s3 = { uploadMany: jest.fn().mockResolvedValue([]) };
        eventSharedService = {
            getUserPurchasedEventList: jest.fn().mockResolvedValue([]),
        };
        service = new EventService(
            prisma,
            eventSharedService,
            {} as any,
            s3,
            {} as any,
        );
    });

    it('blocks creating an event when the location is already booked on that day', async () => {
        prisma.event.findFirst.mockResolvedValue({
            id: 'existing-event',
            name: 'Existing Event',
            startDate: new Date('2026-07-10T09:00:00Z'),
            endDate: new Date('2026-07-10T12:00:00Z'),
        });

        await expect(
            service.create(
                {
                    name: 'New Event',
                    locationId: 'loc-1',
                    date: {
                        start: new Date('2026-07-10T18:00:00Z'),
                        end: new Date('2026-07-10T22:00:00Z'),
                    },
                } as any,
                [],
            ),
        ).rejects.toThrow(HttpException);
        expect(prisma.event.create).not.toHaveBeenCalled();
    });

    it('allows creating an event at the same location on a different day', async () => {
        prisma.event.findFirst.mockResolvedValue(null);

        await service.create(
            {
                name: 'Next Day Event',
                locationId: 'loc-1',
                status: EventStatus.ACTIVE,
                date: {
                    start: new Date('2026-07-11T18:00:00Z'),
                    end: new Date('2026-07-11T22:00:00Z'),
                },
            } as any,
            [],
        );

        expect(prisma.event.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    locationId: 'loc-1',
                    startDate: new Date('2026-07-11T18:00:00Z'),
                    endDate: new Date('2026-07-11T22:00:00Z'),
                }),
            }),
        );
    });

    it('rolls overnight schedule end times to the next day', async () => {
        prisma.event.findFirst.mockResolvedValue(null);

        await service.create(
            {
                name: 'Overnight Party',
                locationId: 'loc-1',
                status: EventStatus.ACTIVE,
                eventSchedule: [
                    {
                        name: 'Event Itinerary',
                        description: 'Late night program',
                        startDate: '2026-07-10T20:00:00Z',
                        endDate: '2026-07-10T02:00:00Z',
                    },
                ],
            } as any,
            [],
        );

        expect(prisma.eventSchedule.createMany).toHaveBeenCalledWith({
            data: [
                expect.objectContaining({
                    eventId: 'event-1',
                    startDate: new Date('2026-07-10T20:00:00Z'),
                    endDate: new Date('2026-07-11T02:00:00Z'),
                }),
            ],
        });
    });

    it('keeps normal same-day schedules on the selected event day when stale end date is submitted', async () => {
        prisma.event.findFirst.mockResolvedValue(null);

        await service.create(
            {
                name: 'Day Event',
                locationId: 'loc-1',
                status: EventStatus.ACTIVE,
                eventSchedule: [
                    {
                        name: 'Event Itinerary',
                        description: '9am to 6pm program',
                        startDate: '2026-07-10T09:00:00Z',
                        endDate: '2026-05-26T18:00:00Z',
                    },
                ],
            } as any,
            [],
        );

        expect(prisma.eventSchedule.createMany).toHaveBeenCalledWith({
            data: [
                expect.objectContaining({
                    eventId: 'event-1',
                    startDate: new Date('2026-07-10T09:00:00Z'),
                    endDate: new Date('2026-07-10T18:00:00Z'),
                }),
            ],
        });
    });

    it('uses schedule dates for the event lifecycle range when stale top-level dates are submitted', async () => {
        prisma.event.findFirst.mockResolvedValue(null);

        await service.create(
            {
                name: 'Future Scheduled Event',
                locationId: 'loc-1',
                status: EventStatus.ACTIVE,
                date: {
                    start: new Date('2026-06-01T09:00:00Z'),
                    end: new Date('2026-06-01T18:00:00Z'),
                },
                eventSchedule: [
                    {
                        name: 'Future program',
                        description: 'Future event schedule',
                        startDate: '2026-07-10T09:00:00Z',
                        endDate: '2026-07-10T18:00:00Z',
                    },
                ],
            } as any,
            [],
        );

        expect(prisma.event.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    startDate: new Date('2026-07-10T09:00:00Z'),
                    endDate: new Date('2026-07-10T18:00:00Z'),
                }),
            }),
        );
    });

    it('allows a user with purchased tickets to view a non-public event', async () => {
        prisma.event.findFirst.mockResolvedValue({
            id: 'event-1',
            name: 'Past Event',
            status: EventStatus.ENDED,
            isDeleted: false,
        });
        eventSharedService.getUserPurchasedEventList.mockResolvedValue([
            {
                id: 'ticket-1',
                eventId: 'event-1',
                payment: { noOfItems: 2 },
            },
        ]);

        const result = (await service.findOne('event-1', {
            id: 'user-1',
            role: UserRole.USER,
        })) as any;

        expect(result.success).toBe(true);
        expect(result.data.isPurchased).toBe(true);
        expect(result.data.noOfTicketPurchased).toBe(2);
    });

    it('blocks updating an event into another event location-day booking', async () => {
        prisma.event.findFirst
            .mockResolvedValueOnce({
                id: 'event-1',
                name: 'Event To Move',
                locationId: 'loc-2',
                startDate: new Date('2026-07-09T18:00:00Z'),
                endDate: new Date('2026-07-09T22:00:00Z'),
                status: EventStatus.ACTIVE,
                isDeleted: false,
                capacity: 100,
                photos: [],
            })
            .mockResolvedValueOnce({
                id: 'existing-event',
                name: 'Existing Event',
                startDate: new Date('2026-07-10T09:00:00Z'),
                endDate: new Date('2026-07-10T12:00:00Z'),
            });

        await expect(
            service.update(
                'event-1',
                {
                    locationId: 'loc-1',
                    date: {
                        start: new Date('2026-07-10T18:00:00Z'),
                        end: new Date('2026-07-10T22:00:00Z'),
                    },
                } as any,
                {},
            ),
        ).rejects.toThrow(HttpException);
        expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('filters public events by category id', async () => {
        await service.findAll(
            {
                page: 1,
                limit: 10,
                search: undefined,
                categoryId: 'category-1',
            } as any,
            undefined,
        );

        expect(prisma.event.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isDeleted: false,
                    categoryId: 'category-1',
                    status: {
                        in: [
                            EventStatus.ACTIVE,
                            EventStatus.LIVE,
                            EventStatus.POSTPONED,
                            EventStatus.SOLD_OUT,
                        ],
                    },
                }),
            }),
        );
        expect(prisma.event.count).toHaveBeenCalledWith({
            where: expect.objectContaining({
                categoryId: 'category-1',
            }),
        });
    });

    it('filters public events by exact status when status is provided', async () => {
        await service.findAll(
            {
                page: 1,
                limit: 10,
                search: undefined,
                categoryId: undefined,
                status: 'active',
            } as any,
            undefined,
        );

        expect(prisma.event.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isDeleted: false,
                    status: EventStatus.ACTIVE,
                }),
            }),
        );
        expect(prisma.event.count).toHaveBeenCalledWith({
            where: expect.objectContaining({
                status: EventStatus.ACTIVE,
            }),
        });
    });

    it('does not expose non-public statuses through public status filter', async () => {
        await service.findAll(
            {
                page: 1,
                limit: 10,
                search: undefined,
                categoryId: undefined,
                status: 'draft',
            } as any,
            undefined,
        );

        expect(prisma.event.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    isDeleted: false,
                    status: { in: [] },
                }),
            }),
        );
    });

    it('starts an event by marking it live and writing an audit record', async () => {
        prisma.event.findFirst.mockResolvedValue({
            id: 'event-1',
            status: EventStatus.ACTIVE,
            isDeleted: false,
        });
        const liveEvent = { id: 'event-1', status: EventStatus.LIVE };
        prisma.event.update.mockResolvedValue(liveEvent);

        const result = await service.startEvent('event-1', {
            id: 'admin-1',
            role: UserRole.ADMIN,
        });

        expect(prisma.event.update).toHaveBeenCalledWith({
            where: { id: 'event-1' },
            data: { status: EventStatus.LIVE },
            include: expect.objectContaining({
                location: true,
                category: true,
                ticketCategories: true,
            }),
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                actorId: 'admin-1',
                action: 'events.start',
                entity: 'Event',
                entityId: 'event-1',
                metadata: expect.objectContaining({
                    status: EventStatus.LIVE,
                }),
            }),
        });
        expect(result).toEqual({
            success: true,
            message: 'Event started successfully.',
            data: liveEvent,
        });
    });

    it('rejects starting a missing event with a controlled not found error', async () => {
        prisma.event.findFirst.mockResolvedValue(null);

        await expect(
            service.startEvent('event-1', { id: 'admin-1', role: UserRole.ADMIN }),
        ).rejects.toMatchObject({
            status: 404,
            response: 'Event not found',
        });
        expect(prisma.event.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('rejects starting an event from an invalid lifecycle state', async () => {
        prisma.event.findFirst.mockResolvedValue({
            id: 'event-1',
            status: EventStatus.DRAFT,
            isDeleted: false,
        });

        await expect(
            service.startEvent('event-1', { id: 'admin-1', role: UserRole.ADMIN }),
        ).rejects.toMatchObject({
            status: 400,
            response: 'Event cannot be started from its current status',
        });
        expect(prisma.event.update).not.toHaveBeenCalled();
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('ends an event by marking it ended, expiring attendants, revoking sessions, and writing an audit record', async () => {
        prisma.event.findFirst.mockResolvedValue({
            id: 'event-1',
            status: EventStatus.LIVE,
            isDeleted: false,
        });
        const endedEvent = { id: 'event-1', status: EventStatus.ENDED };
        prisma.event.update.mockResolvedValue(endedEvent);

        const result = await service.endEvent('event-1', {
            id: 'admin-1',
            role: UserRole.ADMIN,
        });

        expect(prisma.event.update).toHaveBeenCalledWith({
            where: { id: 'event-1' },
            data: { status: EventStatus.ENDED, endedAt: expect.any(Date) },
            include: expect.objectContaining({
                location: true,
                category: true,
                ticketCategories: true,
            }),
        });
        expect(prisma.eventTicketAttendant.updateMany).toHaveBeenCalledWith({
            where: {
                eventId: 'event-1',
                status: {
                    in: [
                        TicketAttendantStatus.INVITED,
                        TicketAttendantStatus.ACTIVE,
                    ],
                },
            },
            data: {
                status: TicketAttendantStatus.EXPIRED,
                sessionActive: false,
            },
        });
        expect(prisma.eventTicketAttendantSession.updateMany).toHaveBeenCalledWith({
            where: { eventId: 'event-1', revokedAt: null },
            data: { revokedAt: expect.any(Date) },
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                actorId: 'admin-1',
                action: 'events.end',
                entity: 'Event',
                entityId: 'event-1',
                metadata: expect.objectContaining({
                    status: EventStatus.ENDED,
                    endedAt: expect.any(Date),
                }),
            }),
        });
        expect(result).toEqual({
            success: true,
            message: 'Event ended successfully.',
            data: endedEvent,
        });
    });

    it('rejects ending an event from an invalid lifecycle state', async () => {
        prisma.event.findFirst.mockResolvedValue({
            id: 'event-1',
            status: EventStatus.PENDING_APPROVAL,
            isDeleted: false,
        });

        await expect(
            service.endEvent('event-1', { id: 'admin-1', role: UserRole.ADMIN }),
        ).rejects.toMatchObject({
            status: 400,
            response: 'Event cannot be ended from its current status',
        });
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects manual lifecycle changes for another vendor event', async () => {
        prisma.event.findFirst.mockResolvedValue({
            id: 'event-1',
            vendorId: 'vendor-owner',
            status: EventStatus.ACTIVE,
            isDeleted: false,
        });

        await expect(
            service.startEvent('event-1', {
                id: 'other-vendor',
                role: UserRole.VENDOR,
            }),
        ).rejects.toMatchObject({
            status: 403,
            response: 'You do not have access to manage this event lifecycle',
        });
        expect(prisma.event.update).not.toHaveBeenCalled();
    });
});
