import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from '@src/common/responses/response';
import { CategoriesService } from './categories.service';
@ApiTags('Category for ALL')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiResponses(false)
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @ApiResponses(false)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }
}
