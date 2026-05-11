import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Events, EventsDocument } from '@src/schemas/events.schema';
import { Booking, BookingDocument } from '@src/schemas/booking.schema';
import { Service, ServiceDocument } from '@src/schemas/services.schema';
import * as moment from 'moment';
import { User, UserDocument } from '@src/schemas/user.shema';
import {
  bookingEarningStatsAggregation,
  eventEarningStatsAggregation,
  serviceEarningStatsAggregation,
} from '@src/common.api/aggregation/stats.aggregate';

@Injectable()
export class CommonApi {
  constructor(
    @InjectModel(Events.name)
    private readonly EventModel: Model<EventsDocument>,
    @InjectModel(Booking.name)
    private readonly BookingModel: Model<BookingDocument>,
    @InjectModel(Service.name)
    private readonly ServiceModel: Model<ServiceDocument>,
    @InjectModel(User.name)
    private readonly UserModel: Model<UserDocument>,
  ) {}

  async appSearchApi(search: string) {
    const eventQuery: FilterQuery<EventsDocument> = {
      $text: {
        $search: search,
      },
    };
    const serviceQuery: FilterQuery<ServiceDocument> = {
      $text: {
        $search: search,
      },
    };
    const bookingQuery: FilterQuery<BookingDocument> = {
      $text: {
        $search: search,
      },
    };
    const events = await this.EventModel.find(
      {
        ...eventQuery,
        'date.end': {
          $gte: moment().toDate(),
        },
      },
      {
        name: 1,
        price: 1,
        location: 1,
        date: 1,
        bannerImages: 1,
      },
    ).lean();
    const services = await this.ServiceModel.find(serviceQuery, {
      name: 1,
      price: 1,
      address: 1,
      vendor: 1,
      photos: 1,
    })
      .populate('vendor', {
        name: 1,
      })
      .lean();
    const bookings = await this.BookingModel.find(bookingQuery, {
      name: 1,
      price: 1,
      address: 1,
      capacity: 1,
      photos: 1,
    }).lean();

    return {
      success: true,
      data: {
        events,
        services,
        bookings,
      },
    };
  }

  async dashboardStates() {
    const eventCount = await this.EventModel.count({ isDeleted: false });
    const serviceCount = await this.ServiceModel.count({ isDeleted: false });
    const bookingCount = await this.BookingModel.count({ isDeleted: false });
    const userCount = await this.UserModel.count({ isDeleted: false });
    let eventEarning = 0,
      serviceEarning = 0,
      bookingEarning = 0;
    const eventAgg: any[] = await this.EventModel.aggregate(
      eventEarningStatsAggregation(),
    );
    const serviceAgg: any[] = await this.ServiceModel.aggregate(
      serviceEarningStatsAggregation(),
    );
    const bookingAgg: any[] = await this.BookingModel.aggregate(
      bookingEarningStatsAggregation(),
    );
    if (eventAgg.length > 0) {
      eventEarning = eventAgg[0].totalEarning;
    }
    if (serviceAgg.length > 0) {
      serviceEarning = serviceAgg[0].totalEarning;
    }
    if (bookingAgg.length > 0) {
      bookingEarning = bookingAgg[0].totalEarning;
    }

    return {
      success: true,
      data: {
        eventCount,
        serviceCount,
        bookingCount,
        userCount,
        earning: eventEarning + serviceEarning + bookingEarning,
      },
    };
  }
}
