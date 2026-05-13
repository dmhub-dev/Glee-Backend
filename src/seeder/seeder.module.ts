import { Module } from '@nestjs/common';
import CategorySeeder from './category.seeder';
import { EventsSeeder } from './events.seeder';
import { ServiceSeeder } from './service.seeder';
import VendorSeeder from './vendor.seeder';
import { SeederService } from './seeder.service';

@Module({
  imports: [],
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
