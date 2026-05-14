import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { ApiResponses } from 'src/shared/response';
import { CreatePurchaseBookingPaystackDto, PurchaseBookingService } from './purchase-booking.service';
import { GetBookingsDataDto } from './dto/public.purchased-booking.dto';

@ApiTags('Public And User Purchased Bookings Routes')
@Controller('purchase-booking')
export class PurchaseBookingController {
  constructor(private readonly purchaseBookingService: PurchaseBookingService) {}

  @ApiResponses(true, [UserRole.USER])
  @Post('purchases')
  create(
    @Body() dto: CreatePurchaseBookingPaystackDto,
    @CurrentUser() user: any,
  ) {
    return this.purchaseBookingService.purchase(dto, user.id);
  }

  @ApiResponses(true, [UserRole.USER])
  @Get()
  getAllThePurchasedBookings(@Query() dto: GetBookingsDataDto, @CurrentUser() user: any) {
    return this.purchaseBookingService.getPurchasedBookings(dto, user.id);
  }

  @ApiResponses(true, [UserRole.USER])
  @Get('single/:bookingId')
  getPurchasedBooking(@Param('bookingId') id: string, @CurrentUser() currentUser: any) {
    return this.purchaseBookingService.getPurchasedBooking(id, currentUser.id);
  }
}
