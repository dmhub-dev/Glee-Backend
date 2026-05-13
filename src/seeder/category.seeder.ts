import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export default class CategorySeeder {
  constructor(private readonly prisma: PrismaService) {}

  async createDummyCategories() {
    return this.prisma.category.createMany({
      data: Array.from({ length: 4 }).map(() => ({
        name: faker.music.genre(),
      })),
    });
  }
}
