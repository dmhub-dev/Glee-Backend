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
      const eventId = this.validateEventId(payload?.eventId);
      const room = await this.eventChatService.getRoom(eventId, client.data.user);
      await client.join(this.eventRoom(eventId));
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
      const eventId = this.validateEventId(payload?.eventId);
      await client.leave(this.eventRoom(eventId));
      return { eventId };
    });
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eventId: string } & CreateEventChatMessageDto,
    ack?: (response: any) => void,
  ) {
    return this.safeHandle(client, ack, async () => {
      const eventId = this.validateEventId(payload?.eventId);
      const dto = this.validateMessagePayload(payload);
      const message = await this.eventChatService.createMessage(
        eventId,
        dto,
        client.data.user,
      );
      this.server.to(this.eventRoom(eventId)).emit('chat:message', message);
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
      const eventId = this.validateEventId(payload?.eventId);
      const dto = this.validateReadPayload(payload);
      return this.eventChatService.markRead(
        eventId,
        dto,
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

  private validateEventId(eventId: unknown) {
    if (typeof eventId !== 'string' || !eventId.trim()) {
      throw new HttpException('eventId is required', HttpStatus.BAD_REQUEST);
    }

    return eventId.trim();
  }

  private validateMessagePayload(payload: any): CreateEventChatMessageDto {
    const errors: string[] = [];
    const body = typeof payload?.body === 'string' ? payload.body.trim() : payload?.body;
    const type = payload?.type;

    if (typeof payload?.body !== 'string') {
      errors.push('body must be a string');
    } else if (!body) {
      errors.push('body should not be empty');
    } else if (body.length > 1000) {
      errors.push('body must be shorter than or equal to 1000 characters');
    }

    if (type !== undefined && type !== 'MESSAGE' && type !== 'ANNOUNCEMENT') {
      errors.push('type must be MESSAGE or ANNOUNCEMENT');
    }

    if (errors.length) {
      throw new HttpException(errors.join(', '), HttpStatus.BAD_REQUEST);
    }

    return {
      body,
      ...(type ? { type } : {}),
    };
  }

  private validateReadPayload(payload: any): MarkEventChatReadDto {
    const lastReadMessageId = payload?.lastReadMessageId;
    if (lastReadMessageId !== undefined && typeof lastReadMessageId !== 'string') {
      throw new HttpException('lastReadMessageId must be a string', HttpStatus.BAD_REQUEST);
    }

    return {
      ...(lastReadMessageId ? { lastReadMessageId: lastReadMessageId.trim() } : {}),
    };
  }

  broadcastMessage(eventId: string, message: any) {
    this.server.to(this.eventRoom(eventId)).emit('chat:message', message);
  }

  broadcastMessageUpdate(eventId: string, message: any) {
    this.server.to(this.eventRoom(eventId)).emit('chat:message:updated', message);
  }

  broadcastMessageDelete(eventId: string, messageId: string) {
    this.server.to(this.eventRoom(eventId)).emit('chat:message:deleted', { messageId, eventId });
  }

  private eventRoom(eventId: string) {
    return `event:${eventId}`;
  }
}
