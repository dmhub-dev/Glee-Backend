import { Module } from '@nestjs/common';
import { BookingSharedService } from './shared.bookings.service';

@Module({
  providers: [BookingSharedService],
  exports: [BookingSharedService],
})
export class BookingSharedModule {}
