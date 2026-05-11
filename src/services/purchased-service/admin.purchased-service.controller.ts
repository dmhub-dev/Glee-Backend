import { Controller, Get, Post, Body, Patch, Param, Delete, Query,Version } from '@nestjs/common';
import { PurchasedServiceService } from './purchased-service.service';
import { CreatePurchasedServiceDto } from './dto/create-purchased-service.dto';

import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import { Role } from 'src/schemas/enums/role';
import { AdminGetServicesDataDto } from './dto/admin.purchased-sercvices.dto';

@ApiTags('Admin Purchasede-service Routes')
@Controller('Admin/purchased/service')
export class AdminPurchasedServiceController {
  constructor(private readonly purchasedServiceService: PurchasedServiceService) {}

  @ApiResponses(true,[Role.ADMIN])
  @Get()
  getAllThePurchasedServices(@Query() getServicesDataDto:AdminGetServicesDataDto){
    return this.purchasedServiceService.getPurchasedServices(getServicesDataDto,getServicesDataDto.userId); 
  }
  @Version('2')
  @ApiResponses(true,[Role.VENDOR])
  @Get()
  getAllThePurchasedServicesByVendor(@Query() getServicesDataDto:AdminGetServicesDataDto){
    return this.purchasedServiceService.getPurchasedServices(getServicesDataDto,getServicesDataDto.userId); 
  } 

  @ApiResponses(true, [Role.ADMIN])
  @Get('single/:purhaseId')
  getPurchasedService(@Param('purhaseId') id: string) {
    return this.purchasedServiceService.getPurchasedService(id);
  }
}
