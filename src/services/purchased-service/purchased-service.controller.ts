import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { ApiResponses } from 'src/shared/response';
import { CreatePurchasedServicePaystackDto, PurchasedServiceService } from './purchased-service.service';
import { GetServicesDataDto } from './dto/public.purchased-service.dto';

@ApiTags('Public and User Purchased-service Routes')
@Controller('purchased/service')
export class PurchasedServiceController {
  constructor(private readonly purchasedServiceService: PurchasedServiceService) {}

  @ApiResponses(true, ['USER'])
  @Post('purchases')
  create(@Body() dto: CreatePurchasedServicePaystackDto, @CurrentUser() user: any) {
    return this.purchasedServiceService.purchase(dto, user.id);
  }

  @ApiResponses(true, ['USER'])
  @Get()
  getAllThePurchasedServices(@Query() dto: GetServicesDataDto, @CurrentUser() user: any) {
    return this.purchasedServiceService.getPurchasedServices(dto, user.id);
  }

  @ApiResponses(true, ['USER'])
  @Get('single/:purchaseId')
  getPurchasedService(@Param('purchaseId') id: string, @CurrentUser() currentUser: any) {
    return this.purchasedServiceService.getPurchasedService(id, currentUser.id);
  }
}
