import { Module } from '@nestjs/common';
import { EventTicketsService } from './event-tickets.service';
import { EventTicketsController } from './event-tickets.controller';
import {
  EventTickets,
  EventTicketsSchema,
} from 'src/schemas/event.tickets.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentModule } from '../../payment/payment.module';
import { AdminEventTicketsController } from './admin.event-tickets.controller';
import { EventSharedModule } from '../shared/shared.event.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventTickets.name, schema: EventTicketsSchema },
    ]),
    PaymentModule,
    EventSharedModule,
    UsersModule,
  ],
  controllers: [AdminEventTicketsController, EventTicketsController],
  providers: [EventTicketsService],
})
export class EventTicketsModule {}
