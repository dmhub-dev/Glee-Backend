import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Service, ServiceSchema } from '../schemas/services.schema';
import { SeederModule } from '../seeder/seeder.module';
// import { PurchaseServiceModule } from './purchase.service/purchase.service.module';
import { AdminServiceController } from './admin.service.controller';
import { PurchasedServiceModule } from './purchased-service/purchased-service.module';
import { SharedServicesModule } from './Shared/shared.service.module';

@Module({
  imports: [
  MongooseModule.forFeature([{ name: Service.name, schema: ServiceSchema }]),
    SeederModule,
    PurchasedServiceModule,
    SharedServicesModule
  ],
  controllers: [ServicesController, AdminServiceController],
  providers: [ServicesService],
})
export class ServicesModule {}
