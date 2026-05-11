import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Events, EventSchema } from 'src/schemas/events.schema';

import {
  EventTickets,
  EventTicketsSchema,
} from '../../schemas/event.tickets.schema';
import { EventSharedService } from './shared.event.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Events.name, schema: EventSchema },
      {
        name: EventTickets.name,
        schema: EventTicketsSchema,
      },
    ]),
  ],
  providers: [EventSharedService],
  exports: [EventSharedService],
})
export class EventSharedModule {}
