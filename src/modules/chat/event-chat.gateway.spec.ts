import { HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '@src/auth/auth.service';
import { EventChatGateway } from './event-chat.gateway';
import { EventChatService } from './event-chat.service';

describe('EventChatGateway', () => {
  let gateway: EventChatGateway;
  let eventChatService: {
    getRoom: jest.Mock;
    createMessage: jest.Mock;
    markRead: jest.Mock;
  };
  let authService: { validateUser: jest.Mock };
  let jwtService: { verifyAsync: jest.Mock };
  let server: { to: jest.Mock };

  const user = {
    id: 'user-1',
    role: 'USER',
    isActive: 'ACTIVE',
    permissions: [],
  };

  const createClient = (token?: string) => {
    const client: any = {
      id: 'socket-1',
      data: {},
      handshake: {
        auth: token ? { token } : {},
        headers: {},
        query: {},
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
    };

    return client;
  };

  beforeEach(() => {
    eventChatService = {
      getRoom: jest.fn(),
      createMessage: jest.fn(),
      markRead: jest.fn(),
    };
    authService = { validateUser: jest.fn().mockResolvedValue(user) };
    jwtService = { verifyAsync: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };

    gateway = new EventChatGateway(
      eventChatService as unknown as EventChatService,
      authService as unknown as AuthService,
      jwtService as unknown as JwtService,
      { get: jest.fn().mockReturnValue('secret') } as unknown as ConfigService,
    );
    (gateway as any).server = server;
  });

  it('disconnects unauthenticated sockets', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid token'));
    const client = createClient('bad-token');

    await gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith('chat:error', {
      message: 'Authentication failed',
      statusCode: 401,
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('joins event room after access check', async () => {
    const room = { id: 'room-1', eventId: 'event-1', access: { canRead: true } };
    eventChatService.getRoom.mockResolvedValue(room);
    const client = createClient('token');
    await gateway.handleConnection(client);
    const ack = jest.fn();

    await gateway.handleJoin(client, { eventId: 'event-1' }, ack);

    expect(eventChatService.getRoom).toHaveBeenCalledWith('event-1', user);
    expect(client.join).toHaveBeenCalledWith('event:event-1');
    expect(client.emit).toHaveBeenCalledWith('chat:room', room);
    expect(ack).toHaveBeenCalledWith({ success: true, data: room });
  });

  it('broadcasts created messages to the event room', async () => {
    const message = { id: 'message-1', eventId: 'event-1', body: 'Hello' };
    const roomEmitter = { emit: jest.fn() };
    server.to.mockReturnValue(roomEmitter);
    eventChatService.createMessage.mockResolvedValue(message);
    const client = createClient('token');
    await gateway.handleConnection(client);
    const ack = jest.fn();

    await gateway.handleMessage(
      client,
      { eventId: 'event-1', body: 'Hello', type: 'MESSAGE' },
      ack,
    );

    expect(eventChatService.createMessage).toHaveBeenCalledWith(
      'event-1',
      { body: 'Hello', type: 'MESSAGE' },
      user,
    );
    expect(server.to).toHaveBeenCalledWith('event:event-1');
    expect(roomEmitter.emit).toHaveBeenCalledWith('chat:message', message);
    expect(ack).toHaveBeenCalledWith({ success: true, data: message });
  });

  it('acknowledges and emits service errors', async () => {
    eventChatService.getRoom.mockRejectedValue(
      new HttpException('Forbidden', HttpStatus.FORBIDDEN),
    );
    const client = createClient('token');
    await gateway.handleConnection(client);
    const ack = jest.fn();

    await gateway.handleJoin(client, { eventId: 'event-1' }, ack);

    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('chat:error', {
      message: 'Forbidden',
      statusCode: 403,
    });
    expect(ack).toHaveBeenCalledWith({
      success: false,
      error: { message: 'Forbidden', statusCode: 403 },
    });
  });
});
