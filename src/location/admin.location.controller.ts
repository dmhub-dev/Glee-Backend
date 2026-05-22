import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFiles } from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiImageFile, UploadType } from 'src/decorators/check-mime-type.decorator';
import { ApiResponses } from 'src/shared/response';
import { CreateLocationDto } from './dto/create-location.dto';
import { FilterLocationDto } from './dto/filter-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationService } from './location.service';

@ApiTags('Admin Locations')
@Controller('admin/locations')
export class AdminLocationController {
  constructor(private readonly locationService: LocationService) {}

  @Permissions(Permission.LOCATION_READ)
  @ApiResponses(false)
  @Get()
  findAll(@Query() filters: FilterLocationDto) {
    return this.locationService.findAll(filters);
  }

  @Permissions(Permission.LOCATION_READ)
  @ApiResponses(false)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationService.findOne(id);
  }

  @Permissions(Permission.LOCATION_CREATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Post()
  create(@Body() dto: CreateLocationDto) {
    return this.locationService.create(dto);
  }

  @Permissions(Permission.LOCATION_UPDATE)
  @ApiResponses(false)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationService.update(id, dto);
  }

  @Permissions(Permission.LOCATION_UPDATE)
  @ApiResponses(false)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('pictures', { type: UploadType.ARRAY, maxCount: 6 })
  @Post(':id/pictures')
  uploadPictures(
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.locationService.uploadPictures(id, files);
  }

  @Permissions(Permission.LOCATION_DELETE)
  @ApiResponses(false)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.locationService.remove(id);
  }
}
