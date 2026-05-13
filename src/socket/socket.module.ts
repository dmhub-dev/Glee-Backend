import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { OnesignalModule } from 'src/onesignal/onesignal.module';
import { UsersModule } from 'src/users/users.module';

import { SocketAuthGuard } from './socket-auth.guard';
import { SocketGateway } from './socket.gateway';
import { SocketEventHandler } from './socket_event.handler';

import { ChatModule } from '@src/chat/chat.module';

@Module({
  imports: [AuthModule, UsersModule, OnesignalModule, ChatModule],
  providers: [SocketGateway, SocketAuthGuard, SocketEventHandler],
  exports: [SocketGateway],
})
export class SocketModule {}
