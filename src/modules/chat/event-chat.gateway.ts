import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AuthService } from '@src/auth/auth.service';
import { Server, Socket } from 'socket.io';
import {
  CreateEventChatMessageDto,
  MarkEventChatReadDto,
} from './dto/event-chat.dto';
import { EventChatService } from './event-chat.service';

@WebSocketGateway({ namespace: '/event-chat', cors: { origin: '*' } })
export class EventChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly eventChatService: EventChatService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      client.data.user = await this.authenticate(client);
    } catch {
      const error = this.formatError(
        new HttpException('Authentication failed', HttpStatus.UNAUTHORIZED),
      );
      client.emit('chat:error', error);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eventId: string },
    ack?: (response: any) => void,
  ) {
    return this.safeHandle(client, ack, async () => {
      const room = await this.eventChatService.getRoom(payload?.eventId, client.data.user);
      await client.join(this.eventRoom(payload.eventId));
      client.emit('chat:room', room);
      return room;
    });
  }

  @SubscribeMessage('chat:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eventId: string },
    ack?: (response: any) => void,
  ) {
    return this.safeHandle(client, ack, async () => {
      await client.leave(this.eventRoom(payload?.eventId));
      return { eventId: payload?.eventId };
    });
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eventId: string } & CreateEventChatMessageDto,
    ack?: (response: any) => void,
  ) {
    return this.safeHandle(client, ack, async () => {
      const message = await this.eventChatService.createMessage(
        payload?.eventId,
        { body: payload?.body, type: payload?.type },
        client.data.user,
      );
      this.server.to(this.eventRoom(payload.eventId)).emit('chat:message', message);
      return message;
    });
  }

  @SubscribeMessage('chat:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eventId: string } & MarkEventChatReadDto,
    ack?: (response: any) => void,
  ) {
    return this.safeHandle(client, ack, async () => {
      return this.eventChatService.markRead(
        payload?.eventId,
        { lastReadMessageId: payload?.lastReadMessageId },
        client.data.user,
      );
    });
  }

  private async authenticate(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      throw new HttpException('Missing token', HttpStatus.UNAUTHORIZED);
    }

    const payload = await this.jwtService.verifyAsync(token, {
      secret: this.configService.get('SECRETKEY'),
    });
    const user = await this.authService.validateUser({ userId: payload.id });

    if (!user || user.isActive === 'INACTIVE') {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    return {
      ...user,
      role: payload.role ?? user.role?.name ?? user.role,
      isSuperAdmin: payload.isSuperAdmin,
      isAdmin: payload.isAdmin,
      isOperationsManager: payload.isOperationsManager,
      isCommercialManager: payload.isCommercialManager,
      isFinance: payload.isFinance,
      isVendor: payload.isVendor,
      isVendorStaff: payload.isVendorStaff,
      isCustomerSupport: payload.isCustomerSupport,
      isContentManager: payload.isContentManager,
      isUser: payload.isUser,
    };
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake?.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();

    const authorization = client.handshake?.headers?.authorization;
    const authorizationValue = Array.isArray(authorization) ? authorization[0] : authorization;
    const bearer = authorizationValue?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer) return bearer.trim();

    const queryToken = client.handshake?.query?.token;
    if (Array.isArray(queryToken)) return queryToken[0];
    if (typeof queryToken === 'string') return queryToken.trim();

    return null;
  }

  private async safeHandle(
    client: Socket,
    ack: ((response: any) => void) | undefined,
    handler: () => Promise<any>,
  ) {
    try {
      const data = await handler();
      const response = { success: true, data };
      if (typeof ack === 'function') ack(response);
      return response;
    } catch (error) {
      const formatted = this.formatError(error);
      client.emit('chat:error', formatted);
      const response = { success: false, error: formatted };
      if (typeof ack === 'function') ack(response);
      return response;
    }
  }

  private formatError(error: any) {
    const response = error?.getResponse?.();
    const message =
      typeof response === 'string'
        ? response
        : response?.message ?? error?.message ?? 'Chat request failed';

    return {
      message: Array.isArray(message) ? message.join(', ') : message,
      statusCode: error?.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  private eventRoom(eventId: string) {
    return `event:${eventId}`;
  }
}
