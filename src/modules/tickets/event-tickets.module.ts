import { Module } from '@nestjs/common';
import { EventTicketsService } from './event-tickets.service';
import { EventTicketsController } from './event-tickets.controller';
import { PaystackModule } from '@src/infrastructure/payments/paystack/paystack.module';
import { AdminEventTicketsController } from './admin.event-tickets.controller';
import { EventSharedModule } from '@src/modules/events/shared/shared.event.module';
import { UsersModule } from '@src/modules/identity/users/users.module';
import { WalletModule } from '@src/modules/wallets/wallet/wallet.module';
import { PlatformSettingsModule } from '@src/modules/settings/platform-settings.module';
import { EmailModule } from '@src/infrastructure/email/email.module';
import { TicketAttendantsController } from './ticket-attendants.controller';
import { TicketAttendantsService } from './ticket-attendants.service';
@Module({
  imports: [
    PaystackModule,
    EventSharedModule,
    UsersModule,
    WalletModule,
    PlatformSettingsModule,
    EmailModule,
  ],
  controllers: [
    AdminEventTicketsController,
    EventTicketsController,
    TicketAttendantsController,
  ],
  providers: [EventTicketsService, TicketAttendantsService],
})
export class EventTicketsModule {}
