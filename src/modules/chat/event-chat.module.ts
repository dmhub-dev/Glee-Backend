import { Module } from '@nestjs/common';
import { AuthModule } from '@src/auth/auth.module';
import { OnesignalModule } from '@src/infrastructure/push/onesignal/onesignal.module';
import { EventChatController } from './event-chat.controller';
import { EventChatGateway } from './event-chat.gateway';
import { EventChatService } from './event-chat.service';

@Module({
  imports: [OnesignalModule, AuthModule],
  controllers: [EventChatController],
  providers: [EventChatService, EventChatGateway],
  exports: [EventChatService],
})
export class EventChatModule {}
