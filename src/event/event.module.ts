import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { AdminEventController } from './admin.event.controller';
import { UsersModule } from '../users/users.module';
import { EventSharedModule } from './shared/shared.event.module';
import { S3Service } from '../shared/s3.service';

@Module({
  imports: [UsersModule, EventSharedModule],
  controllers: [AdminEventController, EventController],
  providers: [EventService, S3Service],
})
export class EventModule {}
