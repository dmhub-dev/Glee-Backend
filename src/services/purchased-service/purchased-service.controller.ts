import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { PurchasedServiceService } from './purchased-service.service';
import { CreatePurchasedServiceDto } from './dto/create-purchased-service.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import { UserDocument } from 'src/schemas/user.shema';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { Role } from 'src/schemas/enums/role';
import { GetServicesDataDto } from './dto/public.purchased-service.dto';
import { User } from './../../schemas/user.shema';

@ApiTags('Public and User Purchased-service Routes')
@Controller('purchased/service')
export class PurchasedServiceController {
  constructor(
    private readonly purchasedServiceService: PurchasedServiceService,
  ) {}

  @ApiResponses(true, [Role.USER])
  @Post('purchases')
  create(
    @Body() createPurchasedServiceDto: CreatePurchasedServiceDto,
    @CurrentUser() user: UserDocument,
  ) {
    const [expMonth, expYear]: (string | number)[] =
      createPurchasedServiceDto.exp.split('/');
    return this.purchasedServiceService.purchase(
      createPurchasedServiceDto,
      user._id,
      expMonth,
      expYear,
    );
  }

  @ApiResponses(true, [Role.USER])
  @Get()
  getAllThePurchasedServices(
    @Query() getServicesDataDto: GetServicesDataDto,
    @CurrentUser() user: User,
  ) {
    return this.purchasedServiceService.getPurchasedServices(
      getServicesDataDto,
      user._id,
    );
  }

  @ApiResponses(true, [Role.USER])
  @Get('single/:purhaseId')
  getPurchasedService(
    @Param('purhaseId') id: string,
    @CurrentUser() CurrentUser: UserDocument,
  ) {
    return this.purchasedServiceService.getPurchasedService(
      id,
      CurrentUser._id,
    );
  }
}
