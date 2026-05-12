import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { PurchasedServiceService } from './purchased-service.service';
import { CreatePurchasedServiceDto } from './dto/create-purchased-service.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { GetServicesDataDto } from './dto/public.purchased-service.dto';

@ApiTags('Public and User Purchased-service Routes')
@Controller('purchased/service')
export class PurchasedServiceController {
  constructor(private readonly purchasedServiceService: PurchasedServiceService) {}

  @ApiResponses(true, ['USER'])
  @Post('purchases')
  create(@Body() createPurchasedServiceDto: CreatePurchasedServiceDto, @CurrentUser() user: any) {
    const [expMonth, expYear]: (string | number)[] = createPurchasedServiceDto.exp.split('/');
    return this.purchasedServiceService.purchase(createPurchasedServiceDto, user.id, expMonth as string, expYear as string);
  }

  @ApiResponses(true, ['USER'])
  @Get()
  getAllThePurchasedServices(@Query() getServicesDataDto: GetServicesDataDto, @CurrentUser() user: any) {
    return this.purchasedServiceService.getPurchasedServices(getServicesDataDto, user.id);
  }

  @ApiResponses(true, ['USER'])
  @Get('single/:purhaseId')
  getPurchasedService(@Param('purhaseId') id: string, @CurrentUser() currentUser: any) {
    return this.purchasedServiceService.getPurchasedService(id, currentUser.id);
  }
}
