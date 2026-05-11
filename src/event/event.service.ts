import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, UpdateQuery } from 'mongoose';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventTicketsDocument } from 'src/schemas/event.tickets.schema';
import {
  eventMinorDetails,
  Events,
  EventsDocument,
} from 'src/schemas/events.schema';
import { ApiResponses } from 'src/shared/response';
import { NearByEvents } from './dto/nearby-events.dto';
import { EventsSeeder } from '../seeder/events.seeder';
import CategorySeeder from '../seeder/category.seeder';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { EventSharedService } from './shared/shared.event.service';
import { EventStatus } from '../schemas/enums/status';
import { AddImageDto, DeleteImageDto } from './dto/add-image.dto';
import * as mongoose from 'mongoose';
import * as fs from 'fs';
import { PaymentDocument } from '../schemas/payment.schema';
import { IEventTicket } from '../schemas/interfaces/event.ticekt';
import { deleteImages } from '../shared/utils';
import * as moment from 'moment';
import { RetrieveEventDto } from '@src/event/dto/retrieve.event.dto';
import { loggers } from '@src/interceptors/logger.enums';
import { UserDocument } from '@src/schemas/user.shema';

@Injectable()
export class EventService {
  constructor(
    private readonly eventSharedService: EventSharedService,
    @InjectModel(Events.name)
    private EventsModel: Model<EventsDocument>,
    private readonly eventSeeder: EventsSeeder,
    private readonly categorySeeder: CategorySeeder,
    private readonly config: ConfigService,
  ) {}

  // Route Specific Function
  // ===================================================================================================================

  async create(
    createEventDto: CreateEventDto,
    files: Array<Express.Multer.File>,
  ) {
    let photos: string[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        photos.push(
          this.config.get('APP_URL') + '/upload/' + files[i].filename,
        );
      }
      createEventDto.bannerImages = photos;
    }

    const eventDataToCreate = {
      ...createEventDto,
      availableTickets: createEventDto.capacity,
      loc: {
        type: 'Point',
        coordinates: [
          +`${createEventDto.longitude}`,
          +`${createEventDto.latitude}`,
        ],
      },
    };
    delete eventDataToCreate.latitude;
    delete eventDataToCreate.longitude;
    const createEvent: Events = new this.EventsModel(eventDataToCreate);
    const event: Events = await createEvent.save();
    if (!event) {
      return {
        success: false,
        message: 'currently not able to create an event',
        data: [],
      };
    }
    return {
      success: true,
      message: 'event created successfuly!',
      data: createEvent,
    };
  }

  async createEventVendor(
    createEventDto: CreateEventDto,
    files: Array<Express.Multer.File>,
  ) {
    let photos: string[] = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        photos.push(
          this.config.get('APP_URL') + '/upload/' + files[i].filename,
        );
      }
      createEventDto.bannerImages = photos;
    }

    const eventDataToCreate = {
      ...createEventDto,
      availableTickets: createEventDto.capacity,
      loc: {
        type: 'Point',
        coordinates: [
          +`${createEventDto.longitude}`,
          +`${createEventDto.latitude}`,
        ],
      },
    };
    delete eventDataToCreate.latitude;
    delete eventDataToCreate.longitude;
    const createEvent: Events = new this.EventsModel(eventDataToCreate);
    const event: Events = await createEvent.save();
    if (!event) {
      return {
        success: false,
        message: 'currently not able to create an event',
        data: [],
      };
    }
    return {
      success: true,
      message: 'event created successfuly!',
      data: createEvent,
    };
  }

  async eventEarningService(id: string) {
    if (!mongoose.isValidObjectId(id))
      throw new HttpException(
        { message: 'Invalid reference id provided.', success: false },
        HttpStatus.BAD_REQUEST,
      );

    const result = await this.eventSharedService.calculateEventEarning(id);
    if (!Array.isArray(result) || result.length === 0)
      return {
        success: true,
        adminEarning: 0,
        vendorEarning: 0,
      };

    return {
      success: true,
      data: result[0],
    };
  }

  async findAll({ page, limit, search }: RetrieveEventDto) {
    let query: Partial<FilterQuery<EventsDocument>> = {
      isDeleted: false,
    };
    if (search)
      query.$text = {
        $search: search,
      };
    const data: Array<EventsDocument> = await this.EventsModel.find(query)
      .populate('category')
      .populate('vendor')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort('-createdAt');

    const docCount = await this.EventsModel.count(query);

    if (!data) {
      return {
        success: false,
        message: 'There is currently no events',
        data: [],
      };
    }
    return {
      success: true,
      data,
      page,
      limit,
      totalPages: Math.ceil(docCount / limit),
    };
  }

  async findAllByVendorId({ page, limit, search }: RetrieveEventDto,user) {
    let query: Partial<FilterQuery<EventsDocument>> = {
      isDeleted: false,
      vendor:user.vendor_id,
    };
    if (search)
      query.$text = {
        $search: search,
      };
    const data: Array<EventsDocument> = await this.EventsModel.find(query)
      .populate('category')
      .populate('vendor')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort('-createdAt');

    const docCount = await this.EventsModel.count(query);

    if (!data) {
      return {
        success: false,
        message: 'There is currently no events',
        data: [],
      };
    }
    return {
      success: true,
      data,
      page,
      limit,
      totalPages: Math.ceil(docCount / limit),
    };
  }

  async findOne(id: string, userId: string) {
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(id))
      throw new HttpException('Invalid Request Data', HttpStatus.BAD_REQUEST);

    const event: EventsDocument = await this.EventsModel.findById({
      _id: id,
    })
      .populate('category')
      .populate('vendor')
      .lean();

    let purchasedEvent: IEventTicket[] =
      await this.eventSharedService.getUserPurchasedEventList(userId, id); // @todo add event id too

    let noOfTicketPurchased = 0;
    purchasedEvent.map((v) => {
      noOfTicketPurchased += (v.paymentId as PaymentDocument)?.noOfItems;
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
        isPurchased:
          purchasedEvent.findIndex(
            (e) => e.eventId.toString() == event._id.toString(),
          ) > -1,
        totalTicketPurchased: event.capacity - event.availableTickets,
        noOfTicketPurchased,
        lastTicket: purchasedEvent[0]?._id,
      },
    };
  }

  async findOneEventByVendorId(id: string, userId: string) {
    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(id))
      throw new HttpException('Invalid Request Data', HttpStatus.BAD_REQUEST);

    const event: EventsDocument = await this.EventsModel.findById({
      _id: id,
    })
      .populate('category')
      .populate('vendor')
      .lean();

    let purchasedEvent: IEventTicket[] =
      await this.eventSharedService.getUserPurchasedEventList(userId, id); // @todo add event id too

    let noOfTicketPurchased = 0;
    purchasedEvent.map((v) => {
      noOfTicketPurchased += (v.paymentId as PaymentDocument)?.noOfItems;
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
        isPurchased:
          purchasedEvent.findIndex(
            (e) => e.eventId.toString() == event._id.toString(),
          ) > -1,
        totalTicketPurchased: event.capacity - event.availableTickets,
        noOfTicketPurchased,
        lastTicket: purchasedEvent[0]?._id,
      },
    };
  }

  async eventParticipants(
    filter: FilterQuery<EventTicketsDocument>,
    me: UserDocument,
  ) {
    if (
        !mongoose.isValidObjectId(filter.eventId) ||
        !mongoose.isValidObjectId(filter.userId)
    )
      throw new HttpException('Invalid Request Data', HttpStatus.BAD_REQUEST);
    const event: EventsDocument = await this.EventsModel.findById(
        filter.eventId,
    );

    if (moment(event.date?.end).isBefore(moment()))
      throw new HttpException('Event has been expired', HttpStatus.BAD_REQUEST);
    loggers.info('event id: %O', event);
    if (!event) {
      return {
        success: false,
        message: 'There is no event with this id',
        data: [],
      };
    }

    const {data: eventParticipants, count} =
      await this.eventSharedService.helperGetEventParticipants(filter, me);

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
    if (!mongoose.isValidObjectId(addImagetDto.eventId))
      throw new HttpException('Invalid Request Data', HttpStatus.BAD_REQUEST);

    let photos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      photos.push(this.config.get('APP_URL') + '/upload/' + files[i].filename);
    }

    let updatedEvent: EventsDocument = await this.EventsModel.findOneAndUpdate(
      { _id: addImagetDto.eventId },
      { $push: { photos: { $each: [...photos] } } },
      { new: true },
    );

    if (!updatedEvent) {
      throw new HttpException(
        {
          success: false,
          message: 'there doesnot exist any event with given credentials',
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
      await deleteImages(deleteImagetDto.imageUrls);

      let updatedEvent = await this.EventsModel.findOneAndUpdate(
        { _id: deleteImagetDto.eventId },
        {
          $pullAll: {
            photos: deleteImagetDto.imageUrls,
            bannerImages: deleteImagetDto.imageUrls,
          },
        },
        { new: true },
      );

      if (!updatedEvent) {
        throw new HttpException(
          {
            success: false,
            message: 'event does not exists',
          },
          HttpStatus.FORBIDDEN,
        );
      }

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
    let maxNear: number = 1000;
    const { page, limit } = paginationDto;
    let search: FilterQuery<EventsDocument> = {};
    if (filter.radius) maxNear = filter.radius * 1000;
    if (filter.name) {
      search.$or = [
        { name: { $regex: filter.name, $options: 'i' } },
        { 'category.name': { $regex: filter.name, $options: 'i' } },
      ];
    }
    if (filter.latitude && filter.longitude) {
      search.loc = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [filter.longitude, filter.latitude],
          },
          $maxDistance: maxNear,
        },
      };
    }

    let allData = await this.EventsModel.find(
      {
        ...search,
        isDeleted: false,
        isActive: EventStatus.ACTIVE,
        'date.end': {
          $gte: moment().startOf('day').toISOString(),
        },
      },
      { ...eventMinorDetails },
    );

    let nearByEventsData = await this.EventsModel.find(
      {
        ...search,
        isDeleted: false,
        isActive: EventStatus.ACTIVE,
        'date.end': {
          $gte: moment().startOf('day').toISOString(),
        },
      },
      { ...eventMinorDetails },
    )
      .skip((page - 1) * limit)
      .limit(limit)
      .sort('date')
      .lean();

    let userPurchasedEvents = [];
    let normalizeData = [];
    if (userId) {
      userPurchasedEvents =
        await this.eventSharedService.getUserPurchasedEventList(userId);
      nearByEventsData.map((val) => {
        if (userPurchasedEvents.includes(val._id))
          normalizeData.push({ ...val, isPurchased: true });
        normalizeData.push({ ...val, isPurchased: false });
      });
    }

    let totalEvents: number = allData.length;
    let totalPages = Math.ceil(totalEvents / limit);
    return {
      success: true,
      msg: 'Events fetched Successfuly',
      data: userId ? normalizeData : nearByEventsData,
      page,
      limit,
      totalPages,
    };
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    uploadImages: {
      files: Array<Express.Multer.File>;
      photos: Array<Express.Multer.File>;
    },
  ) {
    let eventToUpdate: EventsDocument = await this.EventsModel.findById(id);
    const query: UpdateQuery<EventsDocument> = { ...updateEventDto };
    const photos: string[] = [];
    const bannerImages: string[] = [];
    if (uploadImages?.files) {
      for (let i = 0; i < uploadImages?.files.length; i++) {
        bannerImages.push(
          this.config.get('APP_URL') +
            '/upload/' +
            uploadImages?.files[i].filename,
        );
      }
      delete updateEventDto.bannerImages;
      query.$push = {
        bannerImages: {
          $each: bannerImages,
        },
      };
    }

    if (updateEventDto.latitude)
      query['loc.coordinates.1'] = updateEventDto.latitude;
    if (updateEventDto.longitude)
      query['loc.coordinates.0'] = updateEventDto.longitude;

    if (uploadImages?.photos) {
      for (let i = 0; i < uploadImages?.photos.length; i++) {
        photos.push(
          this.config.get('APP_URL') +
            '/upload/' +
            uploadImages?.photos[i].filename,
        );
      }
      delete updateEventDto.photos;
      query.$push = {
        photos: {
          $each: photos,
        },
      };
    }

    if (updateEventDto.capacity) {
      const availableTicket = +`${eventToUpdate.availableTickets}`;
      const capacity = +`${eventToUpdate.capacity}`;
      const ticketPurchased = capacity - availableTicket;
      if (!eventToUpdate.capacity) query.capacity = updateEventDto.capacity;
      if (+`${updateEventDto.capacity}` >= ticketPurchased) {
        const ticketToAddInCapacity =
          +`${updateEventDto.capacity}` - ticketPurchased;
        query.availableTickets = ticketToAddInCapacity;
      } else {
        throw new HttpException(
          'Total capacity can not be less than tickets purchased.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updatedEvent: Events = await this.EventsModel.findByIdAndUpdate(
      id,
      query,
      { new: true },
    );

    if (!updatedEvent) {
      return {
        success: false,
        message: 'There is no event with this id',
        data: [],
      };
    }
    return {
      success: true,
      message: 'Event updated Successfuly',
      data: updatedEvent,
    };
  }

  async updateEventVendor(
    id: string,
    updateEventDto: UpdateEventDto,
    uploadImages: {
      files: Array<Express.Multer.File>;
      photos: Array<Express.Multer.File>;
    },
  ) {
    let eventToUpdate: EventsDocument = await this.EventsModel.findById(id);
    const query: UpdateQuery<EventsDocument> = { ...updateEventDto };
    const photos: string[] = [];
    const bannerImages: string[] = [];
    if (uploadImages?.files) {
      for (let i = 0; i < uploadImages?.files.length; i++) {
        bannerImages.push(
          this.config.get('APP_URL') +
            '/upload/' +
            uploadImages?.files[i].filename,
        );
      }
      delete updateEventDto.bannerImages;
      query.$push = {
        bannerImages: {
          $each: bannerImages,
        },
      };
    }

    if (updateEventDto.latitude)
      query['loc.coordinates.1'] = updateEventDto.latitude;
    if (updateEventDto.longitude)
      query['loc.coordinates.0'] = updateEventDto.longitude;

    if (uploadImages?.photos) {
      for (let i = 0; i < uploadImages?.photos.length; i++) {
        photos.push(
          this.config.get('APP_URL') +
            '/upload/' +
            uploadImages?.photos[i].filename,
        );
      }
      delete updateEventDto.photos;
      query.$push = {
        photos: {
          $each: photos,
        },
      };
    }

    if (updateEventDto.capacity) {
      const availableTicket = +`${eventToUpdate.availableTickets}`;
      const capacity = +`${eventToUpdate.capacity}`;
      const ticketPurchased = capacity - availableTicket;
      if (!eventToUpdate.capacity) query.capacity = updateEventDto.capacity;
      if (+`${updateEventDto.capacity}` >= ticketPurchased) {
        const ticketToAddInCapacity =
          +`${updateEventDto.capacity}` - ticketPurchased;
        query.availableTickets = ticketToAddInCapacity;
      } else {
        throw new HttpException(
          'Total capacity can not be less than tickets purchased.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updatedEvent: Events = await this.EventsModel.findByIdAndUpdate(
      id,
      query,
      { new: true },
    );

    if (!updatedEvent) {
      return {
        success: false,
        message: 'There is no event with this id',
        data: [],
      };
    }
    return {
      success: true,
      message: 'Event updated Successfuly',
      data: updatedEvent,
    };
  }

  async remove(id: string) {
    const checkEvent: EventsDocument = await this.getEvent(id, true);
    if (!checkEvent) {
      return {
        success: false,
        message: 'There is no event with this id or already deleted',
        data: [],
      };
    }

    const eventData: EventsDocument = await this.EventsModel.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
      { new: true },
    );
    return {
      success: true,
      message: 'This event is deleted successfuly',
      data: [eventData],
    };
  }

  async getEvent(
    id: string,
    Alreaydelted: boolean,
  ): Promise<null | EventsDocument> {
    let query: Object;
    if (Alreaydelted) {
      query = { isDeleted: false };
    }

    const event: EventsDocument = await this.EventsModel.findOne({
      _id: id,
      ...query,
    });
    return event ? event : null;
  }

  async removepermanent(id: string): Promise<any | typeof ApiResponses> {
    const checkEvent: EventsDocument = await this.getEvent(id, false);
    if (!checkEvent) {
      return {
        success: false,
        message: 'There is no event with this id or already deleted',
        data: [],
      };
    }

    await this.eventSharedService.helperEventTicketUpdateMany(
      { eventId: id },
      { deletedEventData: checkEvent },
    );
    await this.EventsModel.findByIdAndDelete({ _id: id });
    return {
      success: true,
      message: 'This event is deleted successfuly',
      data: [],
    };
  }

  async dbDataFiller() {
    let filledData = await this.eventSeeder.createDummyEvents();
    return {
      success: true,
      filledData,
    };
  }

  async clearEventCL() {
    await this.EventsModel.deleteMany({});
    return {
      success: true,
    };
  }
}
