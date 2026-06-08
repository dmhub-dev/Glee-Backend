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

  it('authenticates using authorization bearer header', async () => {
    const client = createClient();
    client.handshake.headers.authorization = 'Bearer header-token';

    await gateway.handleConnection(client);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('header-token', { secret: 'secret' });
    expect(client.data.user).toEqual(user);
  });

  it('authenticates using token query', async () => {
    const client = createClient();
    client.handshake.query.token = 'query-token';

    await gateway.handleConnection(client);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('query-token', { secret: 'secret' });
    expect(client.data.user).toEqual(user);
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

  it('leaves event room', async () => {
    const client = createClient('token');
    await gateway.handleConnection(client);
    const ack = jest.fn();

    await gateway.handleLeave(client, { eventId: 'event-1' }, ack);

    expect(client.leave).toHaveBeenCalledWith('event:event-1');
    expect(ack).toHaveBeenCalledWith({ success: true, data: { eventId: 'event-1' } });
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

  it('marks an event room as read', async () => {
    const readState = { roomId: 'room-1', userId: 'user-1', lastReadMessageId: 'message-1' };
    eventChatService.markRead.mockResolvedValue(readState);
    const client = createClient('token');
    await gateway.handleConnection(client);
    const ack = jest.fn();

    await gateway.handleRead(
      client,
      { eventId: 'event-1', lastReadMessageId: 'message-1' },
      ack,
    );

    expect(eventChatService.markRead).toHaveBeenCalledWith(
      'event-1',
      { lastReadMessageId: 'message-1' },
      user,
    );
    expect(ack).toHaveBeenCalledWith({ success: true, data: readState });
  });

  it('rejects missing event id before calling service', async () => {
    const client = createClient('token');
    await gateway.handleConnection(client);
    const ack = jest.fn();

    await gateway.handleJoin(client, { eventId: '' }, ack);

    expect(eventChatService.getRoom).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('chat:error', {
      message: 'eventId is required',
      statusCode: 400,
    });
    expect(ack).toHaveBeenCalledWith({
      success: false,
      error: { message: 'eventId is required', statusCode: 400 },
    });
  });

  it('rejects invalid message type and body before calling service', async () => {
    const client = createClient('token');
    await gateway.handleConnection(client);
    const ack = jest.fn();

    await gateway.handleMessage(
      client,
      { eventId: 'event-1', body: '   ', type: 'SYSTEM' as any },
      ack,
    );

    expect(eventChatService.createMessage).not.toHaveBeenCalled();
    expect(server.to).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'body should not be empty, type must be MESSAGE or ANNOUNCEMENT',
        statusCode: 400,
      },
    });
  });

  it('rejects malformed read payload before calling service', async () => {
    const client = createClient('token');
    await gateway.handleConnection(client);
    const ack = jest.fn();

    await gateway.handleRead(
      client,
      { eventId: 'event-1', lastReadMessageId: 123 as any },
      ack,
    );

    expect(eventChatService.markRead).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({
      success: false,
      error: { message: 'lastReadMessageId must be a string', statusCode: 400 },
    });
  });

  it('does not broadcast when create message fails', async () => {
    eventChatService.createMessage.mockRejectedValue(
      new HttpException('Chat is locked', HttpStatus.CONFLICT),
    );
    const client = createClient('token');
    await gateway.handleConnection(client);
    const ack = jest.fn();

    await gateway.handleMessage(client, { eventId: 'event-1', body: 'Hello' }, ack);

    expect(server.to).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({
      success: false,
      error: { message: 'Chat is locked', statusCode: 409 },
    });
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
