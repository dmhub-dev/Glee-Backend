import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { AdminServiceController } from './admin.service.controller';
import { PurchasedServiceModule } from './purchased-service/purchased-service.module';
import { SharedServicesModule } from './Shared/shared.service.module';

@Module({
  imports: [PurchasedServiceModule, SharedServicesModule],
  controllers: [ServicesController, AdminServiceController],
  providers: [ServicesService],
})
export class ServicesModule {}
