import { Module } from '@nestjs/common';
import { S3Service } from '@src/infrastructure/storage/s3.service';
import { AdminLocationController } from './admin.location.controller';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  controllers: [LocationController, AdminLocationController],
  providers: [LocationService, S3Service],
})
export class LocationModule {}
