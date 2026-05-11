import { CategoryDocument } from '../schemas/categories.schema';
import { Events, EventsDocument } from '../schemas/events.schema';
import { faker } from '@faker-js/faker';
import { EventStatus } from '../schemas/enums/status';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import {
  SeederCategoryIdsArrayType,
  SeederVendorIdsArrayType,
} from '../types/seeder.type';
import { SeederService } from './seeder.service';
import * as moment from 'moment';

@Injectable()
export class EventsSeeder {
  constructor(
    @InjectModel(Events.name)
    private EventsModel: Model<EventsDocument>,
    private readonly seederService: SeederService,
  ) {}

  /**
   * Note: To Create Single Category Document of random data
   * @param categories
   */
  createDocument(
    categories: SeederCategoryIdsArrayType,
    vendors: SeederVendorIdsArrayType,
  ): EventsDocument {
    const capacity = faker.datatype.number({ max: 500 });
    const eventDate = faker.date.future();
    return {
      name: faker.name.firstName(),
      vendor: faker.helpers.arrayElement(vendors),
      state: faker.address.state(),
      description: faker.lorem.lines(5),
      category: faker.helpers.arrayElement(categories),
      country: faker.address.countryCode(),
      loc: {
        type: 'Point',
        coordinates: [
          // faker.helpers.arrayElement([
          //   -122.40642, -121.40642, -116.40642, -122.40642,
          // ]),
          // faker.helpers.arrayElement([37.78583, 36.78583, 32.78583, 37.78583]),
          67.086927, 24.878558,
        ],
      },
      location: faker.address.streetAddress(true),
      city: faker.address.city(),
      date: {
        start: faker.date.future(),
        end: faker.date.future(),
      },
      capacity: capacity,
      availableTickets: capacity,
      bannerImages: Array.from({ length: 5 }).map((): string =>
        faker.image.business(),
      ),
      price: faker.datatype.number({ max: 100000, min: 1000 }),
      isActive: faker.helpers.arrayElement([
        EventStatus.ACTIVE,
        EventStatus.SUSPENDED,
        EventStatus.DONE,
      ]),
      maxTicketPurchased: faker.datatype.number({ max: 100, min: 10 }),
      eventSchedule: faker.helpers.arrayElements(
        Array.from({ length: 20 }).map((val, index) => ({
          note: faker.lorem.words(5),
          time: moment(eventDate)
            .add(index * 5, 'minutes')
            .toDate(),
        })),
        4,
      ),
      isDeleted: false,
      deletedAt: new Date(),
    } as EventsDocument;
  }

  /**
   * Note: Insert randomly filled document to database
   * @param categories
   */
  async createDummyEvents() {
    let categories = await this.seederService.getRandomCategory();
    let vendors = await this.seederService.getRandomVendors();
    return await this.EventsModel.insertMany(
      Array.from({ length: 50 }).map(() =>
        this.createDocument(categories, vendors),
      ),
    );
  }
}
