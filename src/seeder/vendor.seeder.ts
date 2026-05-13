import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export default class VendorSeeder {
  constructor(private readonly prisma: PrismaService) {}

  async createDummyVendor() {
    return this.prisma.vendor.createMany({
      data: Array.from({ length: 5 }).map(() => ({
        name: faker.company.name(),
        phone: faker.phone.number('+92 ### #######'),
        email: faker.internet.email(),
        state: faker.address.state(),
        country: faker.address.country(),
        address: faker.address.streetAddress(true),
        city: faker.address.city(),
        profileImage: faker.image.people(),
        routingNumber: faker.datatype.number().toString(),
        businessAccount: faker.lorem.words(2),
      })),
    });
  }
}
