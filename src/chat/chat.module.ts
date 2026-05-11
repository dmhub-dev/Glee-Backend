import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from '@src/schemas/chat.schema';
import { User, UserSchema } from '@src/schemas/user.shema';
import { OnesignalModule } from '@src/onesignal/onesignal.module';
import { Events, EventSchema } from '@src/schemas/events.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Chat.name,
        schema: ChatSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: Events.name,
        schema: EventSchema,
      },
    ]),
    OnesignalModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
