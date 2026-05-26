import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { FilterLocationDto } from './dto/filter-location.dto';
import { LocationService } from './location.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationController {
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
}
