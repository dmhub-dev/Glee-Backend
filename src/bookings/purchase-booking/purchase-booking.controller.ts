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
import { Role } from 'src/schemas/enums/role';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { User, UserDocument } from 'src/schemas/user.shema';
import { GetBookingsDataDto } from './dto/public.purchased-booking.dto';

@ApiTags('Public And User Purchased Bookings Routes')
@Controller('purchase-booking')
export class PurchaseBookingController {
  constructor(
    private readonly purchaseBookingService: PurchaseBookingService,
  ) {}

  @ApiResponses(true, [Role.USER])
  @Post('purchases')
  create(
    @Body() createPurchasedBookingDto: CreatePurchaseBookingDto,
    @CurrentUser() user: UserDocument,
  ) {
    const [expMonth, expYear]: (string | number)[] =
      createPurchasedBookingDto.exp.split('/');
    return this.purchaseBookingService.purchase(
      createPurchasedBookingDto,
      user._id,
      expMonth,
      expYear,
    );
  }

  @ApiResponses(true, [Role.USER])
  @Get()
  getAllThePurchasedBookings(
    @Query() getbookingssDataDto: GetBookingsDataDto,
    @CurrentUser() user: User,
  ) {
    return this.purchaseBookingService.getPurchasedBookings(
      getbookingssDataDto,
      user._id,
    );
  }

  @ApiResponses(true, [Role.USER])
  @Get('single/:bookingId')
  getPurchasedBooking(
    @Param('bookingId') id: string,
    @CurrentUser() CurrentUser: UserDocument,
  ) {
    return this.purchaseBookingService.getPurchasedBooking(id, CurrentUser._id);
  }
}
