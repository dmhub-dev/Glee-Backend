import { faker } from '@faker-js/faker';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { Vendor, VendorDocument } from '../schemas/vendor.schema';
import { AccountStatus } from '../schemas/enums/status';

@Injectable()
export default class VendorSeeder {
  constructor(
    @InjectModel(Vendor.name)
    private VendorModel: Model<VendorDocument>,
  ) {}

  /**
   * Note: Insert randomly generated category documents to database
   */
  async createDummyVendor() {
    return await this.VendorModel.create(
      Array.from({ length: 5 }).map(() => {
        return {
          name: faker.company.name(),
          phone: faker.phone.number('+92 ### #######'),
          email: faker.internet.email(),
          state: faker.address.state(),
          country: faker.address.country(),
          address: faker.address.streetAddress(true),
          city: faker.address.city(),
          profileImage: faker.image.people(),
          routingNumber: faker.datatype.number(),
          businessAccount: faker.lorem.words(2),
          isActive: faker.helpers.arrayElement([
            AccountStatus.ACTIVE,
            AccountStatus.INACTIVE,
          ]),
          isDeleted: faker.helpers.arrayElement([true, true, false]),
          deletedAt: faker.date.past(),
        };
      }),
    );
  }
}
