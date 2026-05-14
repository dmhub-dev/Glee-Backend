import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PrismaModule } from '@src/prisma/prisma.module';
import { CurrencyModule } from '@src/currency/currency.module';
import { PaystackModule } from '@src/paystack/paystack.module';

@Module({
  imports: [PrismaModule, CurrencyModule, PaystackModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
