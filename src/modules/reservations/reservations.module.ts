import { Module } from '@nestjs/common';
import { PaystackModule } from '@src/infrastructure/payments/paystack/paystack.module';
import { WalletModule } from '@src/modules/wallets/wallet/wallet.module';
import { AdminReservationsController } from './admin-reservations.controller';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [WalletModule, PaystackModule],
  controllers: [ReservationsController, AdminReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
