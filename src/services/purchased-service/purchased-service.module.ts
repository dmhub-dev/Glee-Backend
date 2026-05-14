import { Module } from '@nestjs/common';
import { PurchasedServiceService } from './purchased-service.service';
import { PurchasedServiceController } from './purchased-service.controller';
import { AdminPurchasedServiceController } from './admin.purchased-service.controller';
import { UsersModule } from '../../users/users.module';
import { PaystackModule } from '@src/paystack/paystack.module';
import { SharedServicesModule } from '../Shared/shared.service.module';

@Module({
  imports: [UsersModule, SharedServicesModule, PaystackModule],
  controllers: [PurchasedServiceController, AdminPurchasedServiceController],
  providers: [PurchasedServiceService],
})
export class PurchasedServiceModule {}
