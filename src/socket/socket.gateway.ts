import { Logger, UseGuards } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  // SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
// import { SocketType } from 'dgram';
import { SocketAuthGuard } from './socket-auth.guard';
import { SocketEventHandler } from './socket_event.handler';
import { Socket } from 'socket.io';
import { Model } from 'mongoose';
import { User, UserDocument } from '@src/schemas/user.shema';
import { InjectModel } from '@nestjs/mongoose';
import { UsersService } from '@src/users/users.service';
import { ChatService } from '@src/chat/chat.service';

// import { OnesignalService } from 'src/onesignal/onesignal.service';

@UseGuards(SocketAuthGuard)
@WebSocketGateway({ cors: '*' })
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private socketEventHandler: SocketEventHandler,
    private readonly chatService: ChatService,
  ) {}

  @WebSocketServer()
  static server: any;

  afterInit(server: any) {
    SocketGateway.server = server;
  }

  @SubscribeMessage('read-all')
  async handleMessageRoom(
    client: Socket,
    message: { id: string; from: string; message: string },
  ) {
    // await this.userService.readChat(message.id);
    const data = await this.chatService.findAll(message.from, message.id);
    SocketGateway.emitEvent(
      'refetch',
      { from: message.from, to: message.id, data },
      message.id,
    );

    console.log(message, 'sendermessageRoom');

    console.log(message, 'data');
    // this.wss.emit('messageRoom', message);
  }

  @SubscribeMessage('get-data')
  async getData(
    client: Socket,
    message: { id: string; from: string; message: string },
  ) {
    const data = await this.chatService.findAll(message.from, message.id);
    SocketGateway.emitEvent('init', { data }, message.from);
  }

  async handleConnection(client) {
    console.log('connect');
    this.socketEventHandler.onConnect(client);
  }

  async handleDisconnect(client: Socket) {
    this.socketEventHandler.onDisconnect(client);
  }

  static emitEvent(eventType: string, event, userId: string) {
    SocketGateway.server.to(userId).emit(eventType, event);
  }
}
