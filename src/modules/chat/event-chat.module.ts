import { Module } from '@nestjs/common';
import { OnesignalModule } from '@src/infrastructure/push/onesignal/onesignal.module';
import { EventChatController } from './event-chat.controller';
import { EventChatGateway } from './event-chat.gateway';
import { EventChatService } from './event-chat.service';

@Module({
  imports: [OnesignalModule],
  controllers: [EventChatController],
  providers: [EventChatService, EventChatGateway],
  exports: [EventChatService],
})
export class EventChatModule {}
