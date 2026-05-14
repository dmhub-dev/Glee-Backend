import { AllowAny } from "@src/config/auth-guard";
import { Permissions } from "@src/auth/rbac/permissions.decorator";
import { Permission } from "@src/auth/rbac/permissions.enum";
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ApiResponses } from '../shared/response';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { RetrieveServiceDto } from './dto/retrieve.service.dto';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { UserRole } from '@prisma/client';

@Controller('services')
@ApiTags('Services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  /**
   * Route: /services/
   * Method: GET
   */
  @Permissions(Permission.SERVICES_READ)
  @ApiResponses(true)
  @Get()
  findAll(
    @Query() query: RetrieveServiceDto,
    @CurrentUser() user: any,
  ) {
    return this.servicesService.findAll(
      {
        ...query,
        isDeleted: false,
        search: null,
      },
      user,
    );
  }

  /**
   * Route: /services/
   * Method: GET
   */
  @Permissions(Permission.SERVICES_READ)
  @ApiResponses(false)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id, { isDeleted: false });
  }
}
