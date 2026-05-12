import { Module } from '@nestjs/common';
import { EventTicketsService } from './event-tickets.service';
import { EventTicketsController } from './event-tickets.controller';
import { PaymentModule } from '../../payment/payment.module';
import { AdminEventTicketsController } from './admin.event-tickets.controller';
import { EventSharedModule } from '../shared/shared.event.module';
import { UsersModule } from '../../users/users.module';

@Module({
  imports: [PaymentModule, EventSharedModule, UsersModule],
  controllers: [AdminEventTicketsController, EventTicketsController],
  providers: [EventTicketsService],
})
export class EventTicketsModule {}
