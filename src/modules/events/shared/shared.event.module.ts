import { Module } from '@nestjs/common';
import { EventSharedService } from './shared.event.service';

@Module({
  providers: [EventSharedService],
  exports: [EventSharedService],
})
export class EventSharedModule {}
