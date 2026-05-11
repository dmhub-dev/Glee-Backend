import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from 'src/schemas/categories.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private CategoryModel: Model<CategoryDocument>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const createCategory: Category = new this.CategoryModel(createCategoryDto);
    const category: Category = await createCategory.save();
    return {
      success: true,
      message: 'category created successfuly!',
      data: category,
    };
  }

  async findAll() {
    const categories: Array<Category> = await this.CategoryModel.find({
      isDeleted: false,
    }).sort('-createdAt');
    if (categories.length == 0) {
      return {
        success: false,
        message: 'There is currently no categories',
        data: [],
      };
    }
    return {
      success: true,
      message: 'categories Fetched Successfuly',
      data: categories,
    };
  }

  async findOne(id: string) {
    const category: Category = await this.CategoryModel.findById({
      _id: id,
    });
    if (!category) {
      throw new NotFoundException({
        success: false,
        message: 'There is no category with this id',
      });
    }
    return {
      success: true,
      message: 'category Fetched Successfuly',
      data: category,
    };
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const updatedCategory: Category =
      await this.CategoryModel.findByIdAndUpdate(id, updateCategoryDto, {
        new: true,
      });

    if (!updatedCategory) {
      return {
        success: false,
        message:
          'There is no category with this id or any issues happen during update',
        data: [],
      };
    }
    return {
      success: true,
      message: 'category updated Successfuly',
      data: updatedCategory,
    };
  }

  async getCategory(id: string): Promise<boolean> {
    const category: Category = await this.CategoryModel.findOne({ _id: id });
    return category ? true : false;
  }

  async remove(id: string) {
    const checkCategory = await this.getCategory(id);
    if (!checkCategory) {
      return {
        success: false,
        message: 'There is no Category with this id or already deleted',
        data: [],
      };
    }
    await this.CategoryModel.findByIdAndDelete({ _id: id });
    return {
      success: true,
      message: 'This category is deleted successfuly',
      data: [],
    };
  }
}
