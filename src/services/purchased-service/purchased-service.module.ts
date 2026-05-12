import { Module } from '@nestjs/common';
import { PurchasedServiceService } from './purchased-service.service';
import { PurchasedServiceController } from './purchased-service.controller';
import { AdminPurchasedServiceController } from './admin.purchased-service.controller';
import { UsersModule } from '../../users/users.module';
import { PaymentModule } from 'src/payment/payment.module';
import { SharedServicesModule } from '../Shared/shared.service.module';

@Module({
  imports: [UsersModule, SharedServicesModule, PaymentModule],
  controllers: [PurchasedServiceController, AdminPurchasedServiceController],
  providers: [PurchasedServiceService],
})
export class PurchasedServiceModule {}
