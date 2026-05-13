import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { AdminBookingController } from './admin.booking.controller';
import { PurchaseBookingModule } from './purchase-booking/purchase-booking.module';
import { BookingSharedModule } from '@src/bookings/shared/shared.bookings.module';

@Module({
  imports: [BookingSharedModule, PurchaseBookingModule],
  controllers: [BookingsController, AdminBookingController],
  providers: [BookingsService],
})
export class BookingsModule {}
