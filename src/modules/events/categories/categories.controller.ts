import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from '@src/common/responses/response';
import { CategoriesService } from './categories.service';
@ApiTags('Category for ALL')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Permissions(Permission.CATEGORIES_READ)
  @ApiResponses(false)
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Permissions(Permission.CATEGORIES_READ)
  @ApiResponses(false)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }
}
