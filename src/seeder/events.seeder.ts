import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import {
  SeederCategoryIdsArrayType,
  SeederVendorIdsArrayType,
} from '../types/seeder.type';
import { SeederService } from './seeder.service';
import * as moment from 'moment';
import { EntityStatus } from '@prisma/client';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class EventsSeeder {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seederService: SeederService,
  ) {}

  /**
   * Note: To Create Single Category Document of random data
   * @param categories
   */
  createDocument(
    categories: SeederCategoryIdsArrayType,
    vendors: SeederVendorIdsArrayType,
  ) {
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
      status: faker.helpers.arrayElement([
        EntityStatus.ACTIVE,
        EntityStatus.INACTIVE,
        EntityStatus.DONE,
        EntityStatus.SUSPENDED,
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
    } as any;
  }

  /**
   * Note: Insert randomly filled document to database
   * @param categories
   */
  async createDummyEvents() {
    let categories = await this.seederService.getRandomCategory();
    let vendors = await this.seederService.getRandomVendors();
    return this.prisma.event.createMany({
      data: Array.from({ length: 50 }).map(() => this.createDocument(categories, vendors)) as any[],
    });
  }
}
