import { Module } from '@nestjs/common';
import { PurchaseBookingService } from './purchase-booking.service';
import { PurchaseBookingController } from './purchase-booking.controller';
import { AdminPurchasedBookingController } from './Admin.purchase-booking';
import { BookingSharedModule } from '../shared/shared.bookings.module';
import { UsersModule } from 'src/users/users.module';
import { PaystackModule } from '@src/paystack/paystack.module';

@Module({
  imports: [UsersModule, BookingSharedModule, PaystackModule],
  controllers: [PurchaseBookingController, AdminPurchasedBookingController],
  providers: [PurchaseBookingService],
})
export class PurchaseBookingModule {}
