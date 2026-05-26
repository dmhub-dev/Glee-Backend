import { Module } from '@nestjs/common';
import { EventTicketsService } from './event-tickets.service';
import { EventTicketsController } from './event-tickets.controller';
import { PaystackModule } from '@src/infrastructure/payments/paystack/paystack.module';
import { AdminEventTicketsController } from './admin.event-tickets.controller';
import { EventSharedModule } from '@src/modules/events/shared/shared.event.module';
import { UsersModule } from '@src/modules/identity/users/users.module';
@Module({
  imports: [PaystackModule, EventSharedModule, UsersModule],
  controllers: [AdminEventTicketsController, EventTicketsController],
  providers: [EventTicketsService],
})
export class EventTicketsModule {}
