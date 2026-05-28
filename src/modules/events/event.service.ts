import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventStatus, Prisma, TicketWaveStatus, UserRole } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { AddImageDto, DeleteImageDto } from './dto/add-image.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { NearByEvents } from './dto/nearby-events.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { RetrieveEventDto } from './dto/retrieve.event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventSharedService } from './shared/shared.event.service';
import { S3Service } from '@src/infrastructure/storage/s3.service';

const EVENT_INCLUDE: Prisma.EventInclude = {
    location: true,
    category: true,
    ticketCategories: true,
    ticketWaves: {
        include: { ticketCategories: true },
        orderBy: { sequence: 'asc' },
    },
    menuItems: true,
    schedules: { orderBy: { startDate: 'asc' } },
    vendor: { select: { id: true, name: true, email: true, role: true } },
};

@Injectable()
export class EventService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventSharedService: EventSharedService,
        private readonly config: ConfigService,
        private readonly s3: S3Service,
    ) {}

    async create(
        createEventDto: CreateEventDto,
        files: Array<Express.Multer.File>,
    ) {
        return this.createInternal(
            createEventDto,
            files,
            (createEventDto as any).vendor ?? null,
        );
    }

    async createEventVendor(
        createEventDto: CreateEventDto,
        files: Array<Express.Multer.File>,
        user: any,
    ) {
        const vendorId = this.resolveVendorAccountId(user);
        return this.createInternal(createEventDto, files, vendorId);
    }

    private async createInternal(
        createEventDto: CreateEventDto,
        files: Array<Express.Multer.File>,
        vendorId?: string | null,
    ) {
        const photos = await this.s3.uploadMany(files);
        const dto = createEventDto as any;
        const ticketCapacity = this.sumTicketCapacity(createEventDto);
        const capacity =
            createEventDto.capacity !== undefined &&
            Number(createEventDto.capacity) > 0
                ? +createEventDto.capacity
                : ticketCapacity;
        const locationId = await this.resolveLocationId(
            createEventDto.locationId,
            true,
        );
        const categoryId = await this.resolveCategoryId(
            createEventDto.category,
        );
        const menuItems =
            createEventDto.menuItems ?? createEventDto.preOrderMenu ?? [];
        const schedules = this.normalizeEventSchedules(
            createEventDto.eventSchedule,
        );
        const dateRange = this.resolveEventDateRange(dto.date, schedules);
        const status =
            createEventDto.status ??
            createEventDto.isActive ??
            EventStatus.DRAFT;

        await this.assertLocationIsAvailable({
            locationId,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            status,
        });

        const event = await this.prisma.event.create({
            data: {
                name: createEventDto.name,
                description: createEventDto.description ?? null,
                locationId,
                capacity,
                photos: photos.length ? photos : [],
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                status,
                categoryId,
                vendorId: vendorId ?? null,
            },
        });

        if (createEventDto.ticketWaves?.length) {
            await this.createTicketWaves(event.id, createEventDto.ticketWaves);
        } else if (createEventDto.ticketCategories?.length) {
            await this.prisma.ticketCategory.createMany({
                data: createEventDto.ticketCategories.map((tc) => ({
                    eventId: event.id,
                    name: tc.name,
                    price: tc.price,
                    capacity: tc.capacity ?? null,
                    available: tc.capacity ?? null,
                })),
            });
        }

        if (menuItems.length) {
            await this.prisma.eventMenuItem.createMany({
                data: menuItems.map((m) => ({
                    eventId: event.id,
                    name: m.name,
                    category: m.category ?? 'other',
                    price: m.price,
                    description: m.description ?? null,
                })),
            });
        }

        if (schedules.length) {
            await this.prisma.eventSchedule.createMany({
                data: schedules.map((schedule) => ({
                    eventId: event.id,
                    ...schedule,
                })),
            });
        }

        const full = await this.prisma.event.findUnique({
            where: { id: event.id },
            include: EVENT_INCLUDE,
        });

        return {
            success: true,
            message: 'Event created successfully.',
            data: full,
        };
    }

    async eventEarningService(id: string) {
        const result = await this.eventSharedService.calculateEventEarning(id);
        if (!Array.isArray(result) || result.length === 0) {
            return { success: true, adminEarning: 0, vendorEarning: 0 };
        }
        return { success: true, data: result[0] };
    }

    async eventEarningForVendor(id: string, user: any) {
        const vendorId = this.resolveVendorAccountId(user);
        await this.assertVendorEventAccess(id, vendorId);
        return this.eventEarningService(id);
    }

    async findAll({ page, limit, search }: RetrieveEventDto) {
        const where: any = { isDeleted: false };
        if (search) where.name = { contains: search, mode: 'insensitive' };

        const [rawData, docCount] = await Promise.all([
            this.prisma.event.findMany({
                where,
                include: EVENT_INCLUDE,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.event.count({ where }),
        ]);
        await this.syncTicketWavesForEvents(rawData.map((event) => event.id));
        const data = await this.prisma.event.findMany({
            where,
            include: EVENT_INCLUDE,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        return {
            success: true,
            data,
            page,
            limit,
            totalPages: Math.ceil(docCount / limit),
        };
    }

    async findAllByVendorId(
        { page, limit, search }: RetrieveEventDto,
        user: any,
    ) {
        const vendorId = this.resolveVendorAccountId(user);
        const where: any = { isDeleted: false, vendorId };
        if (search) where.name = { contains: search, mode: 'insensitive' };

        const [rawData, docCount] = await Promise.all([
            this.prisma.event.findMany({
                where,
                include: EVENT_INCLUDE,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.event.count({ where }),
        ]);
        await this.syncTicketWavesForEvents(rawData.map((event) => event.id));
        const data = await this.prisma.event.findMany({
            where,
            include: EVENT_INCLUDE,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        return {
            success: true,
            data,
            page,
            limit,
            totalPages: Math.ceil(docCount / limit),
        };
    }

    async findOne(id: string, userId: string) {
        await this.syncTicketWavesForEvents([id]);
        const event = await this.prisma.event.findFirst({
            where: { id, isDeleted: false },
            include: EVENT_INCLUDE,
        });

        const purchasedTickets =
            await this.eventSharedService.getUserPurchasedEventList(userId, id);
        let noOfTicketPurchased = 0;
        purchasedTickets.forEach((t) => {
            noOfTicketPurchased += (t.payment as any)?.noOfItems ?? 0;
        });

        if (!event) {
            return {
                success: false,
                message: 'There is no event with this id',
                data: [],
            };
        }

        return {
            success: true,
            message: 'Event Fetched Successfuly',
            data: {
                ...event,
                isPurchased: purchasedTickets.some(
                    (t) => t.eventId === event.id,
                ),
                totalTicketPurchased: await this.countPurchasedTickets(
                    event.id,
                ),
                noOfTicketPurchased,
                lastTicket: purchasedTickets[0]?.id,
            },
        };
    }

    async findOneEventByVendorId(id: string, user: any) {
        const vendorId = this.resolveVendorAccountId(user);
        await this.assertVendorEventAccess(id, vendorId);
        return this.findOne(id, user.id);
    }

    async eventParticipants(
        filter: { eventId: string; userId: string },
        me: any,
    ) {
        const event = await this.prisma.event.findFirst({
            where: { id: filter.eventId, isDeleted: false },
        });
        if (!event) {
            return {
                success: false,
                message: 'There is no event with this id',
                data: [],
            };
        }
        if (event.endDate && new Date(event.endDate) < new Date()) {
            throw new HttpException(
                'Event has been expired',
                HttpStatus.BAD_REQUEST,
            );
        }
        if ([UserRole.VENDOR, UserRole.VENDOR_STAFF].includes(me.role)) {
            const vendorId = this.resolveVendorAccountId(me);
            if (event.vendorId !== vendorId) {
                throw new HttpException(
                    'You do not have access to this event',
                    HttpStatus.FORBIDDEN,
                );
            }
        }

        const { data: eventParticipants, count } =
            await this.eventSharedService.helperGetEventParticipants(
                filter,
                me,
            );
        if (eventParticipants.length === 0) {
            return {
                success: true,
                message: 'currently there are no participants in this event',
                data: [],
            };
        }

        return {
            success: true,
            message: 'Event paticipants Fetched Successfuly',
            data: eventParticipants,
            count,
        };
    }

    async addExtraImages(
        files: Array<Express.Multer.File>,
        addImagetDto: AddImageDto,
    ) {
        const photos = await this.s3.uploadMany(files);
        const updatedEvent = await this.prisma.event
            .update({
                where: { id: addImagetDto.eventId },
                data: { photos: { push: photos } },
            })
            .catch(() => null);

        if (!updatedEvent) {
            throw new HttpException(
                {
                    success: false,
                    message:
                        'there doesnot exist any event with given credentials',
                },
                HttpStatus.FORBIDDEN,
            );
        }
        return {
            success: true,
            message: 'Event Images uploadeded successfuly..',
            data: updatedEvent,
        };
    }

    async deleteEventImages(deleteImagetDto: DeleteImageDto) {
        try {
            await Promise.all(
                deleteImagetDto.imageUrls.map((url) => this.s3.delete(url)),
            );
            const event = await this.prisma.event.findUnique({
                where: { id: deleteImagetDto.eventId },
            });
            if (!event) {
                throw new HttpException(
                    { success: false, message: 'event does not exists' },
                    HttpStatus.FORBIDDEN,
                );
            }
            const updatedEvent = await this.prisma.event.update({
                where: { id: deleteImagetDto.eventId },
                data: {
                    photos: event.photos.filter(
                        (p) => !deleteImagetDto.imageUrls.includes(p),
                    ),
                },
            });
            return {
                success: true,
                message: 'provided Images urls are deleted successfuly..',
                data: updatedEvent,
            };
        } catch (e) {
            if (e instanceof HttpException) throw e;
            throw new HttpException(
                'Something went wrong',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async nearByEvents(
        filter: NearByEvents,
        userId: string,
        paginationDto?: PaginationQueryDto,
    ) {
        const { page, limit } = paginationDto;
        const offset = (page - 1) * limit;
        const now = new Date();

        let events: any[];

        if (filter.latitude && filter.longitude) {
            const lat = +filter.latitude;
            const lng = +filter.longitude;
            events = await this.prisma.$queryRaw<any[]>`
        SELECT e.*,
          (6371 * acos(
            cos(radians(${lat})) * cos(radians(l.latitude)) *
            cos(radians(l.longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(l.latitude))
          )) AS distance_km
        FROM "Event" e
        JOIN "locations" l ON l.id = e."locationId"
        WHERE e."isDeleted" = false
          AND e.status = 'ACTIVE'::"EventStatus"
          AND (e."endDate" IS NULL OR e."endDate" >= ${now})
        ORDER BY distance_km
        LIMIT ${limit} OFFSET ${offset}
      `;
            if (filter.name) {
                const name = filter.name.toLowerCase();
                events = events.filter((e) =>
                    e.name?.toLowerCase().includes(name),
                );
            }
        } else {
            const where: any = { isDeleted: false, status: EventStatus.ACTIVE };
            where.OR = [{ endDate: null }, { endDate: { gte: now } }];
            if (filter.name)
                where.name = { contains: filter.name, mode: 'insensitive' };
            events = await this.prisma.event.findMany({
                where,
                orderBy: { startDate: 'asc' },
                skip: offset,
                take: limit,
            });
        }

        const userPurchasedTickets = userId
            ? await this.eventSharedService.getUserPurchasedEventList(userId)
            : [];
        const purchasedEventIds = new Set(
            userPurchasedTickets.map((t) => t.eventId),
        );
        const data = events.map((e) => ({
            ...e,
            isPurchased: purchasedEventIds.has(e.id),
        }));

        return {
            success: true,
            msg: 'Events fetched Successfuly',
            data,
            page,
            limit,
            totalPages: Math.ceil(events.length / limit),
        };
    }

    async update(
        id: string,
        updateEventDto: UpdateEventDto,
        uploadImages: {
            files?: Express.Multer.File[];
            photos?: Express.Multer.File[];
        },
    ) {
        const eventToUpdate = await this.prisma.event.findFirst({
            where: { id, isDeleted: false },
        });
        if (!eventToUpdate) {
            return {
                success: false,
                message: 'There is no event with this id',
                data: [],
            };
        }

        const data: any = {};
        const simple = ['name', 'description', 'status'];
        simple.forEach((k) => {
            if ((updateEventDto as any)[k] !== undefined)
                data[k] = (updateEventDto as any)[k];
        });

        if ((updateEventDto as any).isActive !== undefined)
            data.status = (updateEventDto as any).isActive;
        if (updateEventDto.category !== undefined) {
            data.categoryId = await this.resolveCategoryId(
                updateEventDto.category,
            );
        }

        if (updateEventDto.locationId !== undefined) {
            data.locationId = updateEventDto.locationId
                ? await this.resolveLocationId(updateEventDto.locationId)
                : null;
        }

        if (uploadImages?.files?.length) {
            const uploaded = await this.s3.uploadMany(uploadImages.files);
            data.photos = [...(eventToUpdate.photos ?? []), ...uploaded];
        }
        if (uploadImages?.photos?.length) {
            const uploaded = await this.s3.uploadMany(uploadImages.photos);
            data.photos = [...(eventToUpdate.photos ?? []), ...uploaded];
        }

        if (updateEventDto.capacity !== undefined) {
            const capacity = eventToUpdate.capacity;
            const ticketPurchased = await this.countPurchasedTickets(id);
            const newCapacity = +updateEventDto.capacity;
            if (newCapacity >= ticketPurchased) {
                data.capacity = newCapacity;
            } else {
                throw new HttpException(
                    'Total capacity can not be less than tickets purchased.',
                    HttpStatus.BAD_REQUEST,
                );
            }
        }

        const schedulesForDateRange =
            updateEventDto.eventSchedule !== undefined
                ? this.normalizeEventSchedules(updateEventDto.eventSchedule)
                : undefined;
        const dateRange = this.resolveEventDateRange(
            updateEventDto.date,
            schedulesForDateRange,
            {
                startDate: eventToUpdate.startDate,
                endDate: eventToUpdate.endDate,
            },
        );
        const nextLocationId =
            data.locationId !== undefined
                ? data.locationId
                : eventToUpdate.locationId;
        const nextStatus =
            data.status !== undefined ? data.status : eventToUpdate.status;

        data.startDate = dateRange.startDate;
        data.endDate = dateRange.endDate;

        await this.assertLocationIsAvailable({
            locationId: nextLocationId,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            status: nextStatus,
            excludeEventId: id,
        });

        await this.prisma.event.update({ where: { id }, data });

        if (
            (updateEventDto as any).ticketWaves?.length ||
            (updateEventDto as any).ticketCategories?.length
        ) {
            const newTicketCapacity = this.sumTicketCapacity(updateEventDto as any);
            const ticketPurchased = await this.countPurchasedTickets(id);
            if (newTicketCapacity < ticketPurchased) {
                throw new HttpException(
                    'Total ticket capacity can not be less than tickets purchased.',
                    HttpStatus.BAD_REQUEST,
                );
            }
            await this.prisma.event.update({
                where: { id },
                data: { capacity: newTicketCapacity },
            });
            await this.prisma.ticketCategory.deleteMany({
                where: { eventId: id },
            });
            await this.prisma.ticketWave.deleteMany({ where: { eventId: id } });
            if ((updateEventDto as any).ticketWaves?.length) {
                await this.createTicketWaves(
                    id,
                    (updateEventDto as any).ticketWaves,
                );
            } else if ((updateEventDto as any).ticketCategories?.length) {
                await this.prisma.ticketCategory.createMany({
                    data: (updateEventDto as any).ticketCategories.map(
                        (tc: {
                            name: string;
                            price: number;
                            capacity?: number;
                        }) => ({
                            eventId: id,
                            name: tc.name,
                            price: tc.price,
                            capacity: tc.capacity ?? null,
                            available: tc.capacity ?? null,
                        }),
                    ),
                });
            }
        }

        const menuItems =
            updateEventDto.menuItems ?? updateEventDto.preOrderMenu;
        if (menuItems !== undefined) {
            await this.prisma.eventMenuItem.deleteMany({
                where: { eventId: id },
            });
            if (menuItems.length) {
                await this.prisma.eventMenuItem.createMany({
                    data: menuItems.map((m) => ({
                        eventId: id,
                        name: m.name,
                        category: m.category ?? 'other',
                        price: m.price,
                        description: m.description ?? null,
                    })),
                });
            }
        }

        if (updateEventDto.eventSchedule !== undefined) {
            const schedules = schedulesForDateRange ?? [];
            await this.prisma.eventSchedule.deleteMany({
                where: { eventId: id },
            });
            if (schedules.length) {
                await this.prisma.eventSchedule.createMany({
                    data: schedules.map((schedule) => ({
                        eventId: id,
                        ...schedule,
                    })),
                });
            }
        }

        const full = await this.prisma.event.findUnique({
            where: { id },
            include: EVENT_INCLUDE,
        });

        return {
            success: true,
            message: 'Event updated successfully.',
            data: full,
        };
    }

    async updateEventForVendor(
        id: string,
        updateEventDto: UpdateEventDto,
        files: any,
        user: any,
    ) {
        const vendorId = this.resolveVendorAccountId(user);
        await this.assertVendorEventAccess(id, vendorId);
        return this.update(id, updateEventDto, files);
    }

    async remove(id: string) {
        const event = await this.prisma.event.findFirst({
            where: { id, isDeleted: false },
        });
        if (!event) {
            return {
                success: false,
                message: 'There is no event with this id or already deleted',
                data: [],
            };
        }
        const eventData = await this.prisma.event.update({
            where: { id },
            data: { isDeleted: true },
        });
        return {
            success: true,
            message: 'This event is deleted successfuly',
            data: [eventData],
        };
    }

    async removeForVendor(id: string, user: any) {
        const vendorId = this.resolveVendorAccountId(user);
        await this.assertVendorEventAccess(id, vendorId);
        return this.remove(id);
    }

    async getEvent(id: string, filterDeleted: boolean) {
        const where: any = { id };
        if (filterDeleted) where.isDeleted = false;
        return this.prisma.event.findFirst({ where });
    }

    async removepermanent(id: string) {
        const event = await this.getEvent(id, false);
        if (!event) {
            return {
                success: false,
                message: 'There is no event with this id or already deleted',
                data: [],
            };
        }
        await this.eventSharedService.helperEventTicketUpdateMany(
            { eventId: id },
            {},
        );
        await this.prisma.event.delete({ where: { id } });
        return {
            success: true,
            message: 'This event is deleted successfuly',
            data: [],
        };
    }

    async dbDataFiller() {
        return {
            success: false,
            message: 'Seeder not available in Prisma mode',
        };
    }

    async clearEventCL() {
        await this.prisma.event.deleteMany({});
        return { success: true };
    }

    private resolveVendorAccountId(user: any) {
        if (user?.role === UserRole.VENDOR) return user.id;
        if (user?.role === UserRole.VENDOR_STAFF && user.vendorAccountId)
            return user.vendorAccountId;
        throw new HttpException(
            'Vendor account scope is required',
            HttpStatus.FORBIDDEN,
        );
    }

    private async resolveLocationId(
        locationId?: string | null,
        required = false,
    ) {
        if (!locationId) {
            if (required) {
                throw new HttpException(
                    'Location is required',
                    HttpStatus.BAD_REQUEST,
                );
            }
            return null;
        }
        const location = await this.prisma.location.findUnique({
            where: { id: locationId },
            select: { id: true, status: true },
        });
        if (!location)
            throw new HttpException(
                'Location not found',
                HttpStatus.BAD_REQUEST,
            );
        if (location.status !== 'ACTIVE') {
            throw new HttpException(
                'Location is not active',
                HttpStatus.BAD_REQUEST,
            );
        }
        return location.id;
    }

    private async resolveCategoryId(category?: string | null) {
        if (!category) return null;
        const existing = await this.prisma.category.findFirst({
            where: { OR: [{ id: category }, { name: category }] },
            select: { id: true },
        });
        if (!existing)
            throw new HttpException(
                'Category not found',
                HttpStatus.BAD_REQUEST,
            );
        return existing.id;
    }

    private async countPurchasedTickets(eventId: string) {
        const result = await this.prisma.eventTicket.aggregate({
            where: { eventId },
            _sum: { quantity: true },
        });
        return result._sum.quantity ?? 0;
    }

    private normalizeEventSchedules(schedules?: any[]) {
        if (!Array.isArray(schedules)) return [];
        return schedules.map((schedule) => {
            const startDate = schedule.startDate ?? schedule.startsAt;
            const endDate = schedule.endDate ?? schedule.endsAt;
            if (!schedule.name || !startDate || !endDate) {
                throw new HttpException(
                    'Each event schedule item requires name, startDate, and endDate',
                    HttpStatus.BAD_REQUEST,
                );
            }
            const parsedStartDate = new Date(startDate);
            const parsedEndDate = new Date(endDate);
            if (
                Number.isNaN(parsedStartDate.getTime()) ||
                Number.isNaN(parsedEndDate.getTime())
            ) {
                throw new HttpException(
                    'Event schedule contains an invalid date',
                    HttpStatus.BAD_REQUEST,
                );
            }
            if (parsedEndDate < parsedStartDate) {
                parsedEndDate.setFullYear(
                    parsedStartDate.getFullYear(),
                    parsedStartDate.getMonth(),
                    parsedStartDate.getDate(),
                );
            }
            if (parsedEndDate < parsedStartDate) {
                parsedEndDate.setTime(parsedEndDate.getTime() + 24 * 60 * 60 * 1000);
            }
            if (parsedEndDate < parsedStartDate) {
                throw new HttpException(
                    'Event schedule endDate cannot be before startDate',
                    HttpStatus.BAD_REQUEST,
                );
            }

            return {
                name: schedule.name,
                description: schedule.description ?? null,
                startDate: parsedStartDate,
                endDate: parsedEndDate,
            };
        });
    }

    private resolveEventDateRange(
        date?: { start?: Date | string; end?: Date | string } | null,
        schedules?: { startDate: Date; endDate: Date }[],
        fallback?: { startDate?: Date | null; endDate?: Date | null },
    ) {
        const scheduleStarts =
            schedules?.map((schedule) => schedule.startDate) ?? [];
        const scheduleEnds =
            schedules?.map((schedule) => schedule.endDate) ?? [];
        const startDate = this.parseOptionalDate(
            date?.start ??
                (scheduleStarts.length
                    ? new Date(
                          Math.min(
                              ...scheduleStarts.map((schedule) =>
                                  schedule.getTime(),
                              ),
                          ),
                      )
                    : fallback?.startDate),
        );
        const endDate = this.parseOptionalDate(
            date?.end ??
                (scheduleEnds.length
                    ? new Date(
                          Math.max(
                              ...scheduleEnds.map((schedule) =>
                                  schedule.getTime(),
                              ),
                          ),
                      )
                    : fallback?.endDate ?? startDate),
        );

        if (startDate && endDate && endDate < startDate) {
            throw new HttpException(
                'Event end date cannot be before start date',
                HttpStatus.BAD_REQUEST,
            );
        }

        return { startDate, endDate };
    }

    private parseOptionalDate(value?: Date | string | null) {
        if (!value) return null;
        const parsed = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw new HttpException(
                'Event date contains an invalid date',
                HttpStatus.BAD_REQUEST,
            );
        }
        return parsed;
    }

    private async assertLocationIsAvailable(input: {
        locationId?: string | null;
        startDate?: Date | null;
        endDate?: Date | null;
        status?: EventStatus;
        excludeEventId?: string;
    }) {
        if (
            !input.locationId ||
            !input.startDate ||
            input.status === EventStatus.CANCELLED
        ) {
            return;
        }

        const startDay = this.startOfUtcDay(input.startDate);
        const endDay = this.endOfUtcDay(input.endDate ?? input.startDate);

        const conflict = await this.prisma.event.findFirst({
            where: {
                id: input.excludeEventId
                    ? { not: input.excludeEventId }
                    : undefined,
                locationId: input.locationId,
                isDeleted: false,
                status: { not: EventStatus.CANCELLED },
                startDate: { not: null, lte: endDay },
                OR: [
                    { endDate: { gte: startDay } },
                    {
                        endDate: null,
                        startDate: { gte: startDay, lte: endDay },
                    },
                ],
            },
            select: { id: true, name: true, startDate: true, endDate: true },
        });

        if (conflict) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Location is already booked for this event date',
                    data: { conflictingEvent: conflict },
                },
                HttpStatus.CONFLICT,
            );
        }
    }

    private startOfUtcDay(date: Date) {
        return new Date(
            Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                0,
                0,
                0,
                0,
            ),
        );
    }

    private endOfUtcDay(date: Date) {
        return new Date(
            Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate(),
                23,
                59,
                59,
                999,
            ),
        );
    }

    private sumTicketCapacity(input: {
        ticketCategories?: Array<{ capacity?: number | null }>;
        ticketWaves?: Array<{
            ticketCategories?: Array<{ capacity?: number | null }>;
        }>;
    }) {
        if (input.ticketWaves?.length) {
            return input.ticketWaves.reduce(
                (sum, wave) =>
                    sum + this.sumTicketCategoryCapacity(wave.ticketCategories),
                0,
            );
        }
        return this.sumTicketCategoryCapacity(input.ticketCategories);
    }

    private sumTicketCategoryCapacity(
        ticketCategories?: Array<{ capacity?: number | null }>,
    ) {
        return (ticketCategories ?? []).reduce(
            (sum, category) => sum + Number(category.capacity ?? 0),
            0,
        );
    }

    private async createTicketWaves(
        eventId: string,
        waves: Array<{
            name: string;
            description?: string;
            startsAt: Date | string;
            endsAt: Date | string;
            ticketCategories?: Array<{
                name: string;
                price: number;
                capacity?: number | null;
                description?: string;
            }>;
        }>,
    ) {
        const now = new Date();
        for (const [index, wave] of waves.entries()) {
            const startsAt = new Date(wave.startsAt);
            const endsAt = new Date(wave.endsAt);
            if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
                throw new HttpException(
                    'Ticket wave dates are invalid',
                    HttpStatus.BAD_REQUEST,
                );
            }
            if (endsAt <= startsAt) {
                throw new HttpException(
                    'Ticket wave end date must be after start date',
                    HttpStatus.BAD_REQUEST,
                );
            }

            const status =
                index === 0 && startsAt <= now
                    ? TicketWaveStatus.ACTIVE
                    : TicketWaveStatus.UPCOMING;
            const created = await this.prisma.ticketWave.create({
                data: {
                    eventId,
                    name: wave.name,
                    description: wave.description ?? null,
                    sequence: index + 1,
                    startsAt,
                    endsAt,
                    status,
                },
            });

            const categories = wave.ticketCategories ?? [];
            if (categories.length) {
                await this.prisma.ticketCategory.createMany({
                    data: categories.map((tc) => ({
                        eventId,
                        waveId: created.id,
                        name: tc.name,
                        price: tc.price,
                        capacity: tc.capacity ?? null,
                        available: tc.capacity ?? null,
                    })),
                });
            }
        }
    }

    private async syncTicketWavesForEvents(eventIds: string[]) {
        for (const eventId of eventIds.filter(Boolean)) {
            await this.syncTicketWaves(eventId);
        }
    }

    private async syncTicketWaves(eventId: string) {
        const waves = await this.prisma.ticketWave.findMany({
            where: { eventId, status: { not: TicketWaveStatus.CANCELLED } },
            include: { ticketCategories: true },
            orderBy: { sequence: 'asc' },
        });
        if (!waves.length) return;

        const now = new Date();
        let activeIndex = waves.findIndex(
            (wave) => wave.status === TicketWaveStatus.ACTIVE,
        );
        if (activeIndex === -1) {
            const firstReadyIndex = waves.findIndex(
                (wave) =>
                    wave.status === TicketWaveStatus.UPCOMING &&
                    wave.startsAt <= now,
            );
            if (firstReadyIndex === -1) return;
            await this.prisma.ticketWave.update({
                where: { id: waves[firstReadyIndex].id },
                data: { status: TicketWaveStatus.ACTIVE },
            });
            activeIndex = firstReadyIndex;
            waves[activeIndex].status = TicketWaveStatus.ACTIVE;
        }

        for (let index = activeIndex; index < waves.length; index += 1) {
            const wave = await this.prisma.ticketWave.findUnique({
                where: { id: waves[index].id },
                include: { ticketCategories: true },
            });
            if (!wave || wave.status !== TicketWaveStatus.ACTIVE) continue;

            const available = this.sumTicketCategoryAvailable(
                wave.ticketCategories,
            );
            const isSoldOut = available <= 0;
            const isExpired = wave.endsAt <= now;
            if (!isSoldOut && !isExpired) break;

            await this.prisma.ticketWave.update({
                where: { id: wave.id },
                data: { status: TicketWaveStatus.COMPLETED },
            });

            const nextWave = waves
                .slice(index + 1)
                .find((candidate) => candidate.status === TicketWaveStatus.UPCOMING);
            if (!nextWave) break;

            await this.prisma.ticketWave.update({
                where: { id: nextWave.id },
                data: {
                    status: TicketWaveStatus.ACTIVE,
                    startsAt: nextWave.startsAt > now ? now : nextWave.startsAt,
                },
            });
            nextWave.status = TicketWaveStatus.ACTIVE;
        }
    }

    private sumTicketCategoryAvailable(
        ticketCategories: Array<{ available: number | null; capacity: number | null }>,
    ) {
        return ticketCategories.reduce(
            (sum, category) =>
                sum + Number(category.available ?? category.capacity ?? 0),
            0,
        );
    }

    private async assertVendorEventAccess(eventId: string, vendorId: string) {
        const event = await this.prisma.event.findFirst({
            where: { id: eventId, isDeleted: false },
            select: { id: true, vendorId: true },
        });
        if (!event)
            throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
        if (event.vendorId !== vendorId) {
            throw new HttpException(
                'You do not have access to this event',
                HttpStatus.FORBIDDEN,
            );
        }
    }
}
