import { Module } from '@nestjs/common';
import { WalletModule } from '@src/modules/wallets/wallet/wallet.module';
import { AdminReservationsController } from './admin-reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [WalletModule],
  controllers: [AdminReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
