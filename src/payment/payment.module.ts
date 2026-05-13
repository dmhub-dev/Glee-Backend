import { Module } from '@nestjs/common';
import { ConfigService } from './ConfigService';
import { StripeModule } from '../stripe';
import { ConfigModule } from './ConfigModule';
import { PaymentService } from './payment.service';

@Module({
  imports: [
    ConfigModule,
    StripeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.getStripeConfig(),
    }),
  ],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
