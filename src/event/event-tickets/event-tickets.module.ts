import { Module } from '@nestjs/common';
import { EventTicketsService } from './event-tickets.service';
import { EventTicketsController } from './event-tickets.controller';
import { PaystackModule } from '@src/paystack/paystack.module';
import { AdminEventTicketsController } from './admin.event-tickets.controller';
import { EventSharedModule } from '../shared/shared.event.module';
import { UsersModule } from '../../users/users.module';
import { S3Service } from '@src/shared/s3.service';

@Module({
  imports: [PaystackModule, EventSharedModule, UsersModule],
  controllers: [AdminEventTicketsController, EventTicketsController],
  providers: [EventTicketsService, S3Service],
})
export class EventTicketsModule {}
