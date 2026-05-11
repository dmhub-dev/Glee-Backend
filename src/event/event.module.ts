import { forwardRef, Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Events, EventSchema } from 'src/schemas/events.schema';
import { SeederModule } from '../seeder/seeder.module';
import { AdminEventController } from './admin.event.controller';
import { EventTicketsModule } from './event-tickets/event-tickets.module';
import { UsersModule } from '../users/users.module';
import {
  EventTickets,
  EventTicketsSchema,
} from '../schemas/event.tickets.schema';
import { EventSharedModule } from './shared/shared.event.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Events.name, schema: EventSchema },
      {
        name: EventTickets.name,
        schema: EventTicketsSchema,
      },
    ]),
    SeederModule,
    UsersModule,
    EventSharedModule,
    EventTicketsModule,
  ],

  controllers: [AdminEventController, EventController],
  providers: [EventService],
})
export class EventModule {}
