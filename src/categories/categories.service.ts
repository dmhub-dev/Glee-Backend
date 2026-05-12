import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const category = await this.prisma.category.create({ data: createCategoryDto });
    return { success: true, message: 'category created successfuly!', data: category };
  }

  async findAll() {
    const categories = await this.prisma.category.findMany({ orderBy: { createdAt: 'desc' } });
    if (categories.length === 0) {
      return { success: false, message: 'There is currently no categories', data: [] };
    }
    return { success: true, message: 'categories Fetched Successfuly', data: categories };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException({ success: false, message: 'There is no category with this id' });
    }
    return { success: true, message: 'category Fetched Successfuly', data: category };
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const updatedCategory = await this.prisma.category
      .update({ where: { id }, data: updateCategoryDto })
      .catch(() => null);
    if (!updatedCategory) {
      return { success: false, message: 'There is no category with this id or any issues happen during update', data: [] };
    }
    return { success: true, message: 'category updated Successfuly', data: updatedCategory };
  }

  async getCategory(id: string): Promise<boolean> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    return !!category;
  }

  async remove(id: string) {
    const exists = await this.getCategory(id);
    if (!exists) {
      return { success: false, message: 'There is no Category with this id or already deleted', data: [] };
    }
    await this.prisma.category.delete({ where: { id } });
    return { success: true, message: 'This category is deleted successfuly', data: [] };
  }
}
