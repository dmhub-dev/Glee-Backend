import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { AdminEventController } from './admin.event.controller';
import { EventTicketsModule } from './event-tickets/event-tickets.module';
import { UsersModule } from '../users/users.module';
import { EventSharedModule } from './shared/shared.event.module';

@Module({
  imports: [UsersModule, EventSharedModule, EventTicketsModule],
  controllers: [AdminEventController, EventController],
  providers: [EventService],
})
export class EventModule {}
