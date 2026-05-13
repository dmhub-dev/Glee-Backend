import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { OnesignalModule } from '@src/onesignal/onesignal.module';
import { NotificationModule } from '@src/notification/notification.module';

@Module({
  imports: [OnesignalModule, NotificationModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
