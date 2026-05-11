import { Module } from '@nestjs/common';
import { PurchasedServiceService } from './purchased-service.service';
import { PurchasedServiceController } from './purchased-service.controller';
import { AdminPurchasedServiceController } from './admin.purchased-service.controller';
import { UsersModule } from '../../users/users.module';
import { PaymentModule } from 'src/payment/payment.module';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchasedServiceSchema, PurchasedService } from 'src/schemas/purchased-service.schema';
import { SharedServicesModule } from './../Shared/shared.service.module';

@Module({
  imports:[
  MongooseModule.forFeature([
      { name: PurchasedService.name, schema: PurchasedServiceSchema },
    ]),
    UsersModule,
    SharedServicesModule,
    PaymentModule,
  ],
  controllers: [PurchasedServiceController,AdminPurchasedServiceController],
  providers: [PurchasedServiceService]
})
export class PurchasedServiceModule {}
