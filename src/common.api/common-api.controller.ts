import { Controller, Get, Query } from '@nestjs/common';
import { ApiResponses } from '@src/shared/response';
import { Role } from '@src/schemas/enums/role';
import { CommonApi } from '@src/common.api/common-api';

@Controller('common-api')
export class CommonApiController {
  constructor(private readonly commonApiServices: CommonApi) {}

  @ApiResponses(true, [Role.USER])
  @Get('app/global/search')
  appSearchController(@Query('search') search: string) {
    return this.commonApiServices.appSearchApi(search);
  }

  @ApiResponses(true, [Role.ADMIN])
  @Get('dashboard/stats')
  dashboardStats() {
    return this.commonApiServices.dashboardStates();
  }
}
