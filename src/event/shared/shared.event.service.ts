import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, QueryOptions, UpdateQuery } from 'mongoose';
import {
  EventTickets,
  EventTicketsDocument,
} from 'src/schemas/event.tickets.schema';
import { UserDocument, userPublicFields } from 'src/schemas/user.shema';

import {
  IFetchEventTicketOptions,
  IPaginationOptions,
} from '../event-tickets/interfaces/ticket.service';
import {
  aggregateEventEarning,
  aggregateEventTicket,
} from '../event-tickets/aggregations/aggregation.event-ticket';
import { Events, EventsDocument } from '../../schemas/events.schema';
import { IEventSelectableFields } from '../../schemas/interfaces/event';

@Injectable()
export class EventSharedService {
  constructor(
    @InjectModel(Events.name)
    private EventsModel: Model<EventsDocument>,
    @InjectModel(EventTickets.name)
    private EventTicketsModel: Model<EventTicketsDocument>,
  ) {}

  // Helper Functions
  // ===================================================================================================================

  async getEventTicketsData(
    filter: FilterQuery<EventTicketsDocument>,
    pagination?: IPaginationOptions,
    options?: IFetchEventTicketOptions,
  ): Promise<EventTicketsDocument[]> {
    let populate;
    let populateOptions = {
      userId: {
        path: 'userId',
        select: userPublicFields,
      },
    };

    if (options.populateAll) {
      populate = [populateOptions.userId, 'eventId', 'paymentId'];
    } else if (options.populate) {
      populate = options.populate;
    } else {
      populate = [
        ...Object.keys(filter).map((v) =>
          options?.skipPopulates.includes(v)
            ? ''
            : populateOptions[v]
            ? populateOptions[v]
            : v,
        ),
      ];
    }

    let paginationOptions: QueryOptions = {};
    if (pagination && pagination.page && pagination.limit) {
      paginationOptions.skip = (pagination.page - 1) * pagination.limit;
      paginationOptions.limit = pagination.limit;
    }
    let projections = { ...Object.keys(filter).map((v) => ({ [v]: 1 })) };

    return this.EventTicketsModel.find(filter, projections, {
      populate,
      ...paginationOptions,
    });
  }

  async helperEventTicketUpdateMany(
    filter: FilterQuery<EventTicketsDocument>,
    update: UpdateQuery<EventTicketsDocument>,
  ) {
    return this.EventTicketsModel.updateMany(filter, update);
  }

  async helperGetEventParticipants(
    filter: FilterQuery<EventTicketsDocument>,
    me: UserDocument,
  ) {
    let data = await this.EventTicketsModel.aggregate(
      aggregateEventTicket(filter, me),
    );
    return { data, count: data.length };
  }

  async helperEventFindById(_id: string) {
    return this.EventsModel.findById(_id).populate('vendor', 'email');
  }

  async helperSingleEventFilter(
    filter: FilterQuery<EventsDocument>,
    projection?: IEventSelectableFields,
    options?: QueryOptions,
  ) {
    return this.EventsModel.findOne(filter, projection, options);
  }

  async getUserPurchasedEventList(
    userId: string,
    eventId?: string,
  ): Promise<Array<EventTicketsDocument>> {
    const query: FilterQuery<EventTicketsDocument> = {};
    if (userId) query.userId = userId;
    if (eventId) query.eventId = eventId;
    return this.EventTicketsModel.find({ userId, eventId })
      .sort({ 'date.start': -1 })
      .populate('paymentId')
      .lean();
  }

  async calculateEventEarning(id) {
    return this.EventTicketsModel.aggregate(aggregateEventEarning(id));
  }
}
