import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking,BookingSchema } from 'src/schemas/booking.schema';
import { PurchasedBooking,PurchasedBookingSchema } from 'src/schemas/purchased-booking.schema';
import { BookingSharedService } from './shared.bookings.service';

@Module({
  imports: [

  MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      {
        name: PurchasedBooking.name,
        schema: PurchasedBookingSchema,
      },
    ]),
  ],
  providers: [BookingSharedService],
  exports: [BookingSharedService],
})
export class BookingSharedModule {}
