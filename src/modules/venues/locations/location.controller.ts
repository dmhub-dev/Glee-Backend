import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { FilterLocationDto } from './dto/filter-location.dto';
import { LocationService } from './location.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Permissions(Permission.LOCATION_READ)
  @ApiResponses(false)
  @Get()
  findAll(@Query() filters: FilterLocationDto, @CurrentUser() user: any) {
    return this.locationService.findAll(filters, user);
  }

  @Permissions(Permission.LOCATION_READ)
  @ApiResponses(false)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.locationService.findOne(id, user);
  }
}
