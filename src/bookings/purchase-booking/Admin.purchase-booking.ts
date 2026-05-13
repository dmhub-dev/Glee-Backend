import { Controller, Get, Param, Query,Version } from '@nestjs/common';
import { PurchaseBookingService } from './purchase-booking.service';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import { UserRole } from '@prisma/client';
import { AdminGetBookingsDataDto } from './dto/Admin.purchased-booking.dto';

@ApiTags('Admin Purchased Bookings Routes')
@Controller('Admin/purchased/Booking')
export class AdminPurchasedBookingController {
  constructor(private readonly purchaseBookingService: PurchaseBookingService) {}

  
  @ApiResponses(true,[UserRole.ADMIN])
  @Get()
  getAllThePurchasedBookings(@Query() getBookingDataDto:AdminGetBookingsDataDto){
    return this.purchaseBookingService.getPurchasedBookings(getBookingDataDto,getBookingDataDto.userId); 
  }

  @Version('2')
  @ApiResponses(true,[UserRole.VENDOR])
  @Get()
  getAllThePurchasedBookingsV2(@Query() getBookingDataDto:AdminGetBookingsDataDto){
    return this.purchaseBookingService.getPurchasedBookings(getBookingDataDto,getBookingDataDto.userId); 
  }  

  @ApiResponses(true, [UserRole.ADMIN])
  @Get('single/:purhaseId')
  getPurchasedBooking(@Param('purhaseId') id: string) {
    return this.purchaseBookingService.getPurchasedBooking(id);
  }
}
