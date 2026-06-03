import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { AdminEventController } from './admin.event.controller';
import { UsersModule } from '@src/modules/identity/users/users.module';
import { EventSharedModule } from './shared/shared.event.module';
import { S3Service } from '@src/infrastructure/storage/s3.service';
import { EventStatusScheduler } from './event-status.scheduler';

@Module({
  imports: [UsersModule, EventSharedModule],
  controllers: [AdminEventController, EventController],
  providers: [EventService, S3Service, EventStatusScheduler],
})
export class EventModule {}
