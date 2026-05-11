import { faker } from '@faker-js/faker';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../schemas/categories.schema';
import { Injectable } from '@nestjs/common';

@Injectable()
export default class CategorySeeder {
  constructor(
    @InjectModel(Category.name)
    private CategoryModel: Model<CategoryDocument>,
  ) {}

  /**
   * Note: Insert randomly generated category documents to database
   */
  async createDummyCategories() {
    return await this.CategoryModel.create(
      Array.from({ length: 4 }).map(() => {
        return {
          name: faker.music.genre(),
          color: faker.color.human(),
        };
      }),
    );
  }
}
