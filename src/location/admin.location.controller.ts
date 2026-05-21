import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from 'src/shared/response';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationService } from './location.service';

@ApiTags('Admin Locations')
@Controller('admin/locations')
export class AdminLocationController {
  constructor(private readonly locationService: LocationService) {}

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

  @Permissions(Permission.LOCATION_DELETE)
  @ApiResponses(false)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.locationService.remove(id);
  }
}
