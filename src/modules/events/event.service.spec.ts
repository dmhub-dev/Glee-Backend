import { HttpException } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { EventService } from './event.service';

describe('EventService location booking conflicts', () => {
    let service: EventService;
    let prisma: any;
    let s3: any;

    beforeEach(() => {
        prisma = {
            location: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'loc-1',
                    status: 'ACTIVE',
                }),
            },
            category: { findFirst: jest.fn() },
            event: {
                findFirst: jest.fn(),
                create: jest.fn().mockResolvedValue({ id: 'event-1' }),
                update: jest.fn().mockResolvedValue({ id: 'event-1' }),
                findUnique: jest.fn().mockResolvedValue({ id: 'event-1' }),
            },
            ticketCategory: {
                createMany: jest.fn(),
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
        service = new EventService(prisma, {} as any, {} as any, s3);
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
});
