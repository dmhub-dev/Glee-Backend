import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFiles } from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiImageFile, UploadType } from '@src/common/decorators/check-mime-type.decorator';
import { ApiResponses } from '@src/common/responses/response';
import { CreateLocationDto } from './dto/create-location.dto';
import { FilterLocationDto } from './dto/filter-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationService } from './location.service';

@ApiTags('Admin Locations')
@Controller('admin/locations')
export class AdminLocationController {
  constructor(private readonly locationService: LocationService) {}

  @Permissions(Permission.LOCATION_READ)
  @ApiResponses(true)
  @Get()
  findAll(@Query() filters: FilterLocationDto, @CurrentUser() user: any) {
    return this.locationService.findAll(filters, user);
  }

  @Permissions(Permission.LOCATION_READ)
  @ApiResponses(true)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.locationService.findOne(id, user);
  }

  @Permissions(Permission.LOCATION_CREATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Post()
  create(@Body() dto: CreateLocationDto, @CurrentUser() user: any) {
    return this.locationService.create(dto, user);
  }

  @Permissions(Permission.LOCATION_UPDATE)
  @ApiResponses(true)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto, @CurrentUser() user: any) {
    return this.locationService.update(id, dto, user);
  }

  @Permissions(Permission.LOCATION_UPDATE)
  @ApiResponses(true)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('pictures', { type: UploadType.ARRAY, maxCount: 6 })
  @Post(':id/pictures')
  uploadPictures(
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @CurrentUser() user: any,
  ) {
    return this.locationService.uploadPictures(id, files, user);
  }

  @Permissions(Permission.LOCATION_DELETE)
  @ApiResponses(true)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.locationService.remove(id, user);
  }
}
