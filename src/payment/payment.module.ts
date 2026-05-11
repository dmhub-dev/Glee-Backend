import { Module } from '@nestjs/common';
import { ConfigService } from './ConfigService';
import { StripeModule } from '../stripe';
import { ConfigModule } from './ConfigModule';
import { PaymentService } from './payment.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from '../schemas/payment.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
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
