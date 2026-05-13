import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { PurchaseBookingService } from './purchase-booking.service';
import { CreatePurchaseBookingDto } from './dto/create-purchase-booking.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { GetBookingsDataDto } from './dto/public.purchased-booking.dto';

@ApiTags('Public And User Purchased Bookings Routes')
@Controller('purchase-booking')
export class PurchaseBookingController {
  constructor(
    private readonly purchaseBookingService: PurchaseBookingService,
  ) {}

  @ApiResponses(true, [UserRole.USER])
  @Post('purchases')
  create(
    @Body() createPurchasedBookingDto: CreatePurchaseBookingDto,
    @CurrentUser() user: any,
  ) {
    const [expMonth, expYear]: (string | number)[] =
      createPurchasedBookingDto.exp.split('/');
    return this.purchaseBookingService.purchase(
      createPurchasedBookingDto,
      user.id,
      expMonth,
      expYear,
    );
  }

  @ApiResponses(true, [UserRole.USER])
  @Get()
  getAllThePurchasedBookings(
    @Query() getbookingssDataDto: GetBookingsDataDto,
    @CurrentUser() user: any,
  ) {
    return this.purchaseBookingService.getPurchasedBookings(
      getbookingssDataDto,
      user.id,
    );
  }

  @ApiResponses(true, [UserRole.USER])
  @Get('single/:bookingId')
  getPurchasedBooking(
    @Param('bookingId') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.purchaseBookingService.getPurchasedBooking(id, currentUser.id);
  }
}
