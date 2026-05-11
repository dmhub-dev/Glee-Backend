import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchasedService, PurchasedServiceSchema } from 'src/schemas/purchased-service.schema';
import { Service, ServiceSchema } from 'src/schemas/services.schema';
import { ServiceSharedService } from './shared.services.service';

@Module({
  imports: [
  MongooseModule.forFeature([{ name: Service.name, schema: ServiceSchema },
        { name: PurchasedService.name, schema: PurchasedServiceSchema },
    ]),
  ],
  providers: [ServiceSharedService],
  exports:[ServiceSharedService]
})
export class SharedServicesModule {}
