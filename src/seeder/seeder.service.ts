import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import {
  SeederCategoryIdsArrayType,
  SeederVendorIdsArrayType,
} from '../types/seeder.type';
import CategorySeeder from './category.seeder';
import VendorSeeder from './vendor.seeder';

@Injectable()
export class SeederService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categorySeeder: CategorySeeder,
    private readonly vendorSeeder: VendorSeeder,
  ) {}

  async getRandomCategory(): Promise<SeederCategoryIdsArrayType> {
    const categories = await this.prisma.category.findMany({ select: { id: true } });
    if (categories.length === 0) {
      await this.categorySeeder.createDummyCategories();
      return [];
    }
    return categories.map((item) => item.id);
  }

  async getRandomVendors(): Promise<SeederVendorIdsArrayType> {
    const vendors = await this.prisma.vendor.findMany({ select: { id: true } });
    if (vendors.length === 0) {
      await this.vendorSeeder.createDummyVendor();
      return [];
    }
    return vendors.map((item) => item.id);
  }
}
