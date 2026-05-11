import { Module } from '@nestjs/common';
import { PurchaseBookingService } from './purchase-booking.service';
import { PurchaseBookingController } from './purchase-booking.controller';
import { AdminPurchasedBookingController } from './Admin.purchase-booking';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from 'src/schemas/booking.schema';
import {
  PurchasedBooking,
  PurchasedBookingSchema,
} from 'src/schemas/purchased-booking.schema';
import {
  BookingTable,
  BookingTableSchema,
} from 'src/schemas/booking-table.schema';
import { BookingSharedModule } from '../shared/shared.bookings.module';
import { UsersModule } from 'src/users/users.module';
import { PaymentModule } from 'src/payment/payment.module';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: PurchasedBooking.name, schema: PurchasedBookingSchema },
      { name: BookingTable.name, schema: BookingTableSchema },
    ]),
    UsersModule,
    BookingSharedModule,
    PaymentModule,
  ],
  controllers: [PurchaseBookingController, AdminPurchasedBookingController],
  providers: [PurchaseBookingService],
})
export class PurchaseBookingModule {}
