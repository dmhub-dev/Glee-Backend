import { Module } from '@nestjs/common';
import { PaystackModule } from '@src/infrastructure/payments/paystack/paystack.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [PaystackModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
