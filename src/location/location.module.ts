import { Module } from '@nestjs/common';
import { AdminLocationController } from './admin.location.controller';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  controllers: [LocationController, AdminLocationController],
  providers: [LocationService],
})
export class LocationModule {}
