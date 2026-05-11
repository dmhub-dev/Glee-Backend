import { Controller, Get, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ApiResponses } from '../shared/response';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { RetrieveServiceDto } from './dto/retrieve.service.dto';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { UserDocument } from 'src/schemas/user.shema';
import { Role } from 'src/schemas/enums/role';

@Controller('services')
@ApiTags('Services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  /**
   * Route: /services/
   * Method: GET
   */
  @ApiResponses(true, [Role.USER])
  @Get()
  findAll(
    @Query() query: RetrieveServiceDto,
    @CurrentUser() user: UserDocument,
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
  @ApiResponses(false, [Role.USER])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id, { isDeleted: false });
  }
}
