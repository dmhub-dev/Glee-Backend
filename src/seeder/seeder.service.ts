import { Category, CategoryDocument } from '../schemas/categories.schema';
import { Events, EventsDocument } from '../schemas/events.schema';
import { faker } from '@faker-js/faker';
import { EventStatus } from '../schemas/enums/status';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { Vendor, VendorDocument } from '../schemas/vendor.schema';
import {
  SeederCategoryIdsArrayType,
  SeederVendorIdsArrayType,
} from '../types/seeder.type';
import CategorySeeder from './category.seeder';
import VendorSeeder from './vendor.seeder';

@Injectable()
export class SeederService {
  constructor(
    @InjectModel(Category.name)
    private CategoryModel: Model<CategoryDocument>,
    @InjectModel(Vendor.name)
    private VendorModel: Model<VendorDocument>,
    private readonly categorySeeder: CategorySeeder,
    private readonly vendorSeeder: VendorSeeder,
  ) {}

  async getRandomCategory(): Promise<SeederCategoryIdsArrayType> {
    let cat: SeederCategoryIdsArrayType = await this.CategoryModel.find()
      .select({ _id: 1 })
      .lean();
    if (cat?.length == 0) {
      let createdCategories = await this.categorySeeder.createDummyCategories();
      return Array.from(createdCategories).map((val) => val._id.toString());
    }
    return Array.from(cat).map((item) => item._id.toString());
  }

  async getRandomVendors(): Promise<SeederVendorIdsArrayType> {
    let vendors: SeederVendorIdsArrayType = await this.VendorModel.find()
      .select({ _id: 1 })
      .lean();
    if (vendors?.length == 0) {
      let createdVendors = await this.vendorSeeder.createDummyVendor();

      return Array.from(createdVendors).map((val) => val._id.toString());
    }
    return Array.from(vendors).map((item) => item._id.toString());
  }
}
