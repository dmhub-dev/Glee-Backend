import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { AdminBookingController } from './admin.booking.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from 'src/schemas/booking.schema';
import { PurchaseBookingModule } from './purchase-booking/purchase-booking.module';
import {
  BookingTable,
  BookingTableSchema,
} from 'src/schemas/booking-table.schema';
import { BookingSharedService } from '@src/bookings/shared/shared.bookings.service';
import { BookingSharedModule } from '@src/bookings/shared/shared.bookings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: BookingTable.name, schema: BookingTableSchema },
    ]),
    BookingSharedModule,
    PurchaseBookingModule,
  ],
  controllers: [BookingsController, AdminBookingController],
  providers: [BookingsService],
})
export class BookingsModule {}
