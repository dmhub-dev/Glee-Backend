import { CategoryDocument } from '../schemas/categories.schema';
import { faker } from '@faker-js/faker';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { Service, ServiceDocument } from '../schemas/services.schema';
import {
  SeederCategoryIdsArrayType,
  SeederVendorIdsArrayType,
} from '../types/seeder.type';
import { SeederService } from './seeder.service';

@Injectable()
export class ServiceSeeder {
  constructor(
    @InjectModel(Service.name)
    private ServiceModel: Model<ServiceDocument>,
    private seederService: SeederService,
  ) {}

  /**
   * Note: To Create Single Service Document of random data
   * @param categories
   */
  createDocument(
    categories: SeederCategoryIdsArrayType,
    vendors: SeederVendorIdsArrayType,
  ): ServiceDocument {
    return {
      name: faker.name.firstName(),
      vendor: faker.helpers.arrayElement(vendors),
      loc: {
        type: 'Point',
        coordinates: [
          faker.helpers.arrayElement([
            -122.40642, -121.40642, -116.40642, -122.40642,
          ]),
          faker.helpers.arrayElement([37.78583, 36.78583, 32.78583, 37.78583]),
        ],
      },
      serviceDetails: faker.helpers.arrayElements([
        'Helth with taste',
        'High standereds of Quality',
        'best serving service',
        'world class packaging',
      ]),
      description: faker.lorem.lines(5),
      category: faker.helpers.arrayElement(categories),
      address: faker.address.streetAddress(true),
      photos: Array.from({ length: 5 }).map((): string =>
        faker.image.business(),
      ),
      price: faker.datatype.number({ max: 100000, min: 1000 }),
      isDeleted: false,
      deletedAt: new Date(),
    } as ServiceDocument;
  }

  /**
   * Note: Insert randomly filled document to database
   * @param categories
   */
  async createDummyEvents() {
    let categories = await this.seederService.getRandomCategory();
    let vendors = await this.seederService.getRandomVendors();
    return await this.ServiceModel.insertMany(
      Array.from({ length: 50 }).map(() =>
        this.createDocument(categories, vendors),
      ),
    );
  }
}
