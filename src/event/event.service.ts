import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityStatus } from '@prisma/client';
import { PrismaService } from '@src/prisma/prisma.service';
import { AddImageDto, DeleteImageDto } from './dto/add-image.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { NearByEvents } from './dto/nearby-events.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { RetrieveEventDto } from './dto/retrieve.event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventSharedService } from './shared/shared.event.service';
import { S3Service } from '../shared/s3.service';

const EVENT_INCLUDE = { vendor: true, category: true, schedules: true, ticketCategories: true };

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventSharedService: EventSharedService,
    private readonly config: ConfigService,
    private readonly s3: S3Service,
  ) {}

  async create(createEventDto: CreateEventDto, files: Array<Express.Multer.File>) {
    const bannerImages = await this.s3.uploadMany(files);
    const dto = createEventDto as any;

    const event = await this.prisma.event.create({
      data: {
        name: createEventDto.name,
        vendorId: createEventDto.vendor ?? null,
        categoryId: createEventDto.category ?? null,
        locationName: createEventDto.location,
        city: createEventDto.city ?? null,
        country: createEventDto.country ?? null,
        latitude: createEventDto.latitude ? +createEventDto.latitude : null,
        longitude: createEventDto.longitude ? +createEventDto.longitude : null,
        price: createEventDto.price ?? 0,
        capacity: createEventDto.capacity ? +createEventDto.capacity : null,
        maxTicketPurchased: createEventDto.maxTicketPurchased ? +createEventDto.maxTicketPurchased : null,
        availableTickets: createEventDto.capacity ? +createEventDto.capacity : null,
        bannerImages: bannerImages.length ? bannerImages : [],
        startDate: dto.date?.start ?? null,
        endDate: dto.date?.end ?? null,
      },
    });

    const tiers = Array.isArray(createEventDto.ticketCategories)
      ? createEventDto.ticketCategories
      : [];
    if (tiers.length > 0) {
      await this.prisma.ticketCategory.createMany({
        data: tiers.map(t => ({
          eventId: event.id,
          name: t.name,
          price: t.price,
          capacity: t.capacity ?? null,
          available: t.capacity ?? null,
        })),
      });
    }

    const full = await this.prisma.event.findUnique({
      where: { id: event.id },
      include: EVENT_INCLUDE,
    });

    return { success: true, message: 'Event created successfully.', data: full };
  }

  async createEventVendor(createEventDto: CreateEventDto, files: Array<Express.Multer.File>) {
    return this.create(createEventDto, files);
  }

  async eventEarningService(id: string) {
    const result = await this.eventSharedService.calculateEventEarning(id);
    if (!Array.isArray(result) || result.length === 0) {
      return { success: true, adminEarning: 0, vendorEarning: 0 };
    }
    return { success: true, data: result[0] };
  }

  async findAll({ page, limit, search }: RetrieveEventDto) {
    const where: any = { isDeleted: false };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, docCount] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: EVENT_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.event.count({ where }),
    ]);

    return { success: true, data, page, limit, totalPages: Math.ceil(docCount / limit) };
  }

  async findAllByVendorId({ page, limit, search }: RetrieveEventDto, user: any) {
    const where: any = { isDeleted: false, vendorId: user.vendor_id ?? user.vendorId };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, docCount] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: EVENT_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.event.count({ where }),
    ]);

    return { success: true, data, page, limit, totalPages: Math.ceil(docCount / limit) };
  }

  async findOne(id: string, userId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, isDeleted: false },
      include: EVENT_INCLUDE,
    });

    const purchasedTickets = await this.eventSharedService.getUserPurchasedEventList(userId, id);
    let noOfTicketPurchased = 0;
    purchasedTickets.forEach(t => { noOfTicketPurchased += (t.payment as any)?.noOfItems ?? 0; });

    if (!event) {
      return { success: false, message: 'There is no event with this id', data: [] };
    }

    return {
      success: true,
      message: 'Event Fetched Successfuly',
      data: {
        ...event,
        isPurchased: purchasedTickets.some(t => t.eventId === event.id),
        totalTicketPurchased: (event.capacity ?? 0) - (event.availableTickets ?? 0),
        noOfTicketPurchased,
        lastTicket: purchasedTickets[0]?.id,
      },
    };
  }

  async findOneEventByVendorId(id: string, userId: string) {
    return this.findOne(id, userId);
  }

  async eventParticipants(filter: { eventId: string; userId: string }, me: any) {
    const event = await this.prisma.event.findFirst({ where: { id: filter.eventId, isDeleted: false } });
    if (!event) {
      return { success: false, message: 'There is no event with this id', data: [] };
    }
    if (event.endDate && new Date(event.endDate) < new Date()) {
      throw new HttpException('Event has been expired', HttpStatus.BAD_REQUEST);
    }

    const { data: eventParticipants, count } = await this.eventSharedService.helperGetEventParticipants(filter, me);
    if (eventParticipants.length === 0) {
      return { success: true, message: 'currently there are no participants in this event', data: [] };
    }

    return { success: true, message: 'Event paticipants Fetched Successfuly', data: eventParticipants, count };
  }

  async addExtraImages(files: Array<Express.Multer.File>, addImagetDto: AddImageDto) {
    const photos = await this.s3.uploadMany(files);
    const updatedEvent = await this.prisma.event.update({
      where: { id: addImagetDto.eventId },
      data: { photos: { push: photos } },
    }).catch(() => null);

    if (!updatedEvent) {
      throw new HttpException(
        { success: false, message: 'there doesnot exist any event with given credentials' },
        HttpStatus.FORBIDDEN,
      );
    }
    return { success: true, message: 'Event Images uploadeded successfuly..', data: updatedEvent };
  }

  async deleteEventImages(deleteImagetDto: DeleteImageDto) {
    try {
      await Promise.all(deleteImagetDto.imageUrls.map(url => this.s3.delete(url)));
      const event = await this.prisma.event.findUnique({ where: { id: deleteImagetDto.eventId } });
      if (!event) {
        throw new HttpException({ success: false, message: 'event does not exists' }, HttpStatus.FORBIDDEN);
      }
      const updatedEvent = await this.prisma.event.update({
        where: { id: deleteImagetDto.eventId },
        data: {
          photos: event.photos.filter(p => !deleteImagetDto.imageUrls.includes(p)),
          bannerImages: event.bannerImages.filter(p => !deleteImagetDto.imageUrls.includes(p)),
        },
      });
      return { success: true, message: 'provided Images urls are deleted successfuly..', data: updatedEvent };
    } catch (e) {
      if (e instanceof HttpException) throw e;
      throw new HttpException('Something went wrong', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async nearByEvents(filter: NearByEvents, userId: string, paginationDto?: PaginationQueryDto) {
    const { page, limit } = paginationDto;
    const offset = (page - 1) * limit;
    const now = new Date();

    let events: any[];

    if (filter.latitude && filter.longitude) {
      const lat = +filter.latitude;
      const lng = +filter.longitude;
      events = await this.prisma.$queryRaw<any[]>`
        SELECT *,
          (6371 * acos(
            cos(radians(${lat})) * cos(radians(latitude)) *
            cos(radians(longitude) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(latitude))
          )) AS distance_km
        FROM "Event"
        WHERE "isDeleted" = false
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND status = 'ACTIVE'
          AND ("endDate" IS NULL OR "endDate" >= ${now})
        ORDER BY distance_km
        LIMIT ${limit} OFFSET ${offset}
      `;
      if (filter.name) {
        const name = filter.name.toLowerCase();
        events = events.filter(e => e.name?.toLowerCase().includes(name));
      }
    } else {
      const where: any = { isDeleted: false, status: EntityStatus.ACTIVE };
      where.OR = [{ endDate: null }, { endDate: { gte: now } }];
      if (filter.name) where.name = { contains: filter.name, mode: 'insensitive' };
      events = await this.prisma.event.findMany({ where, orderBy: { startDate: 'asc' }, skip: offset, take: limit });
    }

    const userPurchasedTickets = userId ? await this.eventSharedService.getUserPurchasedEventList(userId) : [];
    const purchasedEventIds = new Set(userPurchasedTickets.map(t => t.eventId));
    const data = events.map(e => ({ ...e, isPurchased: purchasedEventIds.has(e.id) }));

    return { success: true, msg: 'Events fetched Successfuly', data, page, limit, totalPages: Math.ceil(events.length / limit) };
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    uploadImages: { files?: Express.Multer.File[]; photos?: Express.Multer.File[] },
  ) {
    const eventToUpdate = await this.prisma.event.findFirst({ where: { id, isDeleted: false } });
    if (!eventToUpdate) {
      return { success: false, message: 'There is no event with this id', data: [] };
    }

    const data: any = {};
    const simple = ['name', 'locationName', 'city', 'state', 'country', 'description', 'price', 'maxTicketPurchased', 'status'];
    simple.forEach(k => { if ((updateEventDto as any)[k] !== undefined) data[k] = (updateEventDto as any)[k]; });

    if (updateEventDto.latitude) data.latitude = +updateEventDto.latitude;
    if (updateEventDto.longitude) data.longitude = +updateEventDto.longitude;

    if (uploadImages?.files?.length) {
      const uploaded = await this.s3.uploadMany(uploadImages.files);
      data.bannerImages = [...(eventToUpdate.bannerImages ?? []), ...uploaded];
    }
    if (uploadImages?.photos?.length) {
      const uploaded = await this.s3.uploadMany(uploadImages.photos);
      data.photos = [...(eventToUpdate.photos ?? []), ...uploaded];
    }

    if (updateEventDto.capacity) {
      const available = eventToUpdate.availableTickets ?? 0;
      const capacity = eventToUpdate.capacity ?? 0;
      const ticketPurchased = capacity - available;
      const newCapacity = +updateEventDto.capacity;
      if (newCapacity >= ticketPurchased) {
        data.capacity = newCapacity;
        data.availableTickets = newCapacity - ticketPurchased;
      } else {
        throw new HttpException('Total capacity can not be less than tickets purchased.', HttpStatus.BAD_REQUEST);
      }
    }

    await this.prisma.event.update({ where: { id }, data });

    if (Array.isArray(updateEventDto.ticketCategories)) {
      await this.prisma.ticketCategory.deleteMany({ where: { eventId: id } });
      if (updateEventDto.ticketCategories.length > 0) {
        await this.prisma.ticketCategory.createMany({
          data: updateEventDto.ticketCategories.map(t => ({
            eventId: id,
            name: t.name,
            price: t.price,
            capacity: t.capacity ?? null,
            available: t.capacity ?? null,
          })),
        });
      }
    }

    const full = await this.prisma.event.findUnique({
      where: { id },
      include: EVENT_INCLUDE,
    });

    return { success: true, message: 'Event updated successfully.', data: full };
  }

  async updateEventVendor(id: string, updateEventDto: UpdateEventDto, files: any) {
    return this.update(id, updateEventDto, files);
  }

  async remove(id: string) {
    const event = await this.prisma.event.findFirst({ where: { id, isDeleted: false } });
    if (!event) {
      return { success: false, message: 'There is no event with this id or already deleted', data: [] };
    }
    const eventData = await this.prisma.event.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    return { success: true, message: 'This event is deleted successfuly', data: [eventData] };
  }

  async getEvent(id: string, filterDeleted: boolean) {
    const where: any = { id };
    if (filterDeleted) where.isDeleted = false;
    return this.prisma.event.findFirst({ where });
  }

  async removepermanent(id: string) {
    const event = await this.getEvent(id, false);
    if (!event) {
      return { success: false, message: 'There is no event with this id or already deleted', data: [] };
    }
    await this.eventSharedService.helperEventTicketUpdateMany({ eventId: id }, {});
    await this.prisma.event.delete({ where: { id } });
    return { success: true, message: 'This event is deleted successfuly', data: [] };
  }

  async dbDataFiller() {
    return { success: false, message: 'Seeder not available in Prisma mode' };
  }

  async clearEventCL() {
    await this.prisma.event.deleteMany({});
    return { success: true };
  }
}
