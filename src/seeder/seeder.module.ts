import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Events, EventSchema } from '../schemas/events.schema';
import { Category, CategorySchema } from '../schemas/categories.schema';
import CategorySeeder from './category.seeder';
import { EventsSeeder } from './events.seeder';
import { ServiceSeeder } from './service.seeder';
import { Service, ServiceSchema } from '../schemas/services.schema';
import { Vendor, VendorSchema } from '../schemas/vendor.schema';
import VendorSeeder from './vendor.seeder';
import { SeederService } from './seeder.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Events.name, schema: EventSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  providers: [
    CategorySeeder,
    EventsSeeder,
    ServiceSeeder,
    VendorSeeder,
    SeederService,
  ],
  exports: [CategorySeeder, EventsSeeder, ServiceSeeder, VendorSeeder],
})
export class SeederModule {}
