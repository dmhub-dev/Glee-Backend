import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventChatService } from './event-chat.service';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { OnesignalService } from '@src/infrastructure/push/onesignal/onesignal.service';

describe('EventChatService access rules', () => {
  let service: EventChatService;
  let prisma: any;

  const activeEvent = {
    id: 'event-1',
    name: 'Glee Sample Weekend Festival',
    vendorId: 'vendor-1',
    status: 'ACTIVE',
    startDate: new Date('2026-06-08T08:00:00Z'),
    endDate: new Date('2026-06-09T22:00:00Z'),
    isDeleted: false,
    createdAt: new Date('2026-06-01T08:00:00Z'),
    endedAt: null,
    updatedAt: new Date('2026-06-08T09:00:00Z'),
  };

  const room = {
    id: 'room-1',
    eventId: 'event-1',
    status: 'ACTIVE',
    finalUpdatesUntil: null,
    lockedAt: null,
    createdAt: new Date('2026-06-08T09:00:00Z'),
    updatedAt: new Date('2026-06-08T09:00:00Z'),
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-08T10:00:00Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventChatService,
        {
          provide: PrismaService,
          useValue: {
            event: { findUnique: jest.fn().mockResolvedValue(activeEvent) },
            eventChatRoom: {
              upsert: jest.fn().mockImplementation(({ create, update }) =>
                Promise.resolve({
                  ...room,
                  ...(create ?? update),
                }),
              ),
            },
            eventChatMessage: {
              count: jest.fn().mockResolvedValue(0),
              create: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            eventChatReadState: {
              findUnique: jest.fn().mockResolvedValue(null),
              upsert: jest.fn(),
            },
            eventTicket: {
              findFirst: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: OnesignalService,
          useValue: { sendNotification: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EventChatService>(EventChatService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows logged-in attendee with active ticket', async () => {
    prisma.eventTicket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      eventId: 'event-1',
      userId: 'attendee-1',
      status: 'ACTIVE',
      guestName: null,
      guestEmail: null,
    });

    const result = await service.getRoom('event-1', {
      id: 'attendee-1',
      role: 'USER',
      permissions: [],
    });

    expect(result.access.canRead).toBe(true);
    expect(result.access.canWrite).toBe(true);
  });

  it('allows logged-in attendee with used ticket', async () => {
    prisma.eventTicket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      eventId: 'event-1',
      userId: 'attendee-1',
      status: 'USED',
      guestName: null,
      guestEmail: null,
    });

    const result = await service.getRoom('event-1', {
      id: 'attendee-1',
      role: 'USER',
      permissions: [],
    });

    expect(prisma.eventTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['ACTIVE', 'USED'] },
          guestName: null,
          guestEmail: null,
        }),
      }),
    );
    expect(result.access.canRead).toBe(true);
    expect(result.access.canWrite).toBe(true);
  });

  it('denies active guest ticket with same user id', async () => {
    prisma.eventTicket.findFirst.mockImplementation(({ where }) =>
      where.guestName === null && where.guestEmail === null
        ? Promise.resolve(null)
        : Promise.resolve({
            id: 'guest-ticket-1',
            eventId: 'event-1',
            userId: 'attendee-1',
            status: 'ACTIVE',
            guestName: 'Guest Buyer',
            guestEmail: 'guest@example.com',
          }),
    );

    await expect(
      service.getRoom('event-1', {
        id: 'attendee-1',
        role: 'USER',
        permissions: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.eventTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          guestName: null,
          guestEmail: null,
        }),
      }),
    );
  });

  it('denies attendee without ticket', async () => {
    prisma.eventTicket.findFirst.mockResolvedValue(null);

    await expect(
      service.getRoom('event-1', {
        id: 'attendee-1',
        role: 'USER',
        permissions: [],
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows vendor owner for own event with read permissions but no moderation access', async () => {
    const result = await service.getRoom('event-1', {
      id: 'vendor-1',
      role: 'VENDOR',
      permissions: ['chat:read'],
    });

    expect(result.access.canRead).toBe(true);
    expect(result.access.canWrite).toBe(false);
    expect(result.access.canModerate).toBe(false);
    expect(result.access.canAnnounce).toBe(false);
  });

  it('denies vendor owner with only read permission from creating messages and announcements', async () => {
    const actor = { id: 'vendor-1', role: 'VENDOR', permissions: ['chat:read'] };

    await expect(
      service.createMessage('event-1', { body: 'Hello', type: 'MESSAGE' }, actor),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.createMessage('event-1', { body: 'Update', type: 'ANNOUNCEMENT' }, actor),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.eventChatMessage.create).not.toHaveBeenCalled();
  });

  it('allows vendor owner with read and create permissions to create messages and announcements', async () => {
    prisma.eventChatMessage.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: data.type === 'ANNOUNCEMENT' ? 'announcement-1' : 'message-1',
        roomId: data.roomId,
        eventId: data.eventId,
        senderId: data.senderId,
        type: data.type,
        body: data.body,
        isPinned: data.isPinned,
        createdAt: new Date('2026-06-08T10:00:00Z'),
        updatedAt: new Date('2026-06-08T10:00:00Z'),
        sender: {
          id: 'vendor-1',
          name: 'Vendor Owner',
          email: 'vendor@example.com',
          role: 'VENDOR',
          profileImage: null,
        },
      }),
    );
    const actor = {
      id: 'vendor-1',
      role: 'VENDOR',
      permissions: ['chat:read', 'chat:create'],
    };

    await service.createMessage('event-1', { body: 'Hello', type: 'MESSAGE' }, actor);
    await service.createMessage('event-1', { body: 'Update', type: 'ANNOUNCEMENT' }, actor);

    expect(prisma.eventChatMessage.create).toHaveBeenCalledTimes(2);
  });

  it('does not leak sensitive sender fields from created messages', async () => {
    prisma.eventChatMessage.create.mockResolvedValue({
      id: 'message-1',
      roomId: 'room-1',
      eventId: 'event-1',
      senderId: 'vendor-1',
      type: 'MESSAGE',
      body: 'Hello',
      isPinned: false,
      createdAt: new Date('2026-06-08T10:00:00Z'),
      updatedAt: new Date('2026-06-08T10:00:00Z'),
      sender: {
        id: 'vendor-1',
        name: 'Vendor Owner',
        email: 'vendor@example.com',
        role: 'VENDOR',
        profileImage: null,
        password: 'hashed-password',
        refreshToken: 'refresh-token',
        twoFactorCode: 123456,
        token: 'session-token',
      },
    });

    const result = await service.createMessage(
      'event-1',
      { body: 'Hello', type: 'MESSAGE' },
      { id: 'vendor-1', role: 'VENDOR', permissions: ['chat:read', 'chat:create'] },
    );

    expect(prisma.eventChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              profileImage: true,
            },
          },
        }),
      }),
    );
    expect(result.sender).toEqual({
      id: 'vendor-1',
      displayName: 'Vendor O.',
      profileImage: null,
    });
    expect(result.sender).not.toHaveProperty('password');
    expect(result.sender).not.toHaveProperty('refreshToken');
    expect(result.sender).not.toHaveProperty('twoFactorCode');
    expect(result.sender).not.toHaveProperty('token');
  });

  it('locks cancelled event room and disables writes', async () => {
    prisma.event.findUnique.mockResolvedValue({
      ...activeEvent,
      status: 'CANCELLED',
    });

    const result = await service.getRoom('event-1', {
      id: 'vendor-1',
      role: 'VENDOR',
      permissions: ['chat:read'],
    });

    expect(result.status).toBe('LOCKED');
    expect(result.access.canRead).toBe(true);
    expect(result.access.canWrite).toBe(false);
    expect(result.access.canAnnounce).toBe(false);
  });

  it('makes ended event read-only within final update window', async () => {
    prisma.event.findUnique.mockResolvedValue({
      ...activeEvent,
      status: 'ENDED',
      endDate: new Date('2026-06-08T09:00:00Z'),
    });
    prisma.eventTicket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      eventId: 'event-1',
      userId: 'attendee-1',
      status: 'ACTIVE',
    });

    const attendeeResult = await service.getRoom('event-1', {
      id: 'attendee-1',
      role: 'USER',
      permissions: [],
    });
    const staffResult = await service.getRoom('event-1', {
      id: 'vendor-1',
      role: 'VENDOR',
      permissions: ['chat:read', 'chat:create'],
    });

    expect(attendeeResult.status).toBe('READ_ONLY');
    expect(attendeeResult.access.canRead).toBe(true);
    expect(attendeeResult.access.canWrite).toBe(false);
    expect(attendeeResult.access.canAnnounce).toBe(false);
    expect(staffResult.status).toBe('READ_ONLY');
    expect(staffResult.access.canWrite).toBe(false);
    expect(staffResult.access.canAnnounce).toBe(true);
  });

  it('locks ended event room after final update window expires', async () => {
    prisma.event.findUnique.mockResolvedValue({
      ...activeEvent,
      status: 'ENDED',
      endDate: new Date('2026-06-05T09:00:00Z'),
    });

    const result = await service.getRoom('event-1', {
      id: 'vendor-1',
      role: 'VENDOR',
      permissions: ['chat:read'],
    });

    expect(result.status).toBe('LOCKED');
    expect(result.finalUpdatesUntil).toEqual(new Date('2026-06-07T09:00:00Z'));
    expect(result.access.canWrite).toBe(false);
    expect(result.access.canAnnounce).toBe(false);
  });

  it('does not reopen ended room when updated after final update window expires', async () => {
    prisma.event.findUnique.mockResolvedValue({
      ...activeEvent,
      status: 'ENDED',
      endDate: null,
      endedAt: new Date('2026-06-05T09:00:00Z'),
      updatedAt: new Date('2026-06-08T09:55:00Z'),
    });

    const result = await service.getRoom('event-1', {
      id: 'vendor-1',
      role: 'VENDOR',
      permissions: ['chat:read'],
    });

    expect(result.status).toBe('LOCKED');
    expect(result.finalUpdatesUntil).toEqual(new Date('2026-06-07T09:00:00Z'));
    expect(result.access.canAnnounce).toBe(false);
  });

  it('sends announcement notifications to active and used ticket holders', async () => {
    prisma.eventChatMessage.create.mockResolvedValue({
      id: 'message-1',
      roomId: 'room-1',
      eventId: 'event-1',
      senderId: 'vendor-1',
      type: 'ANNOUNCEMENT',
      body: 'Schedule update',
      isPinned: true,
      createdAt: new Date('2026-06-08T10:00:00Z'),
      updatedAt: new Date('2026-06-08T10:00:00Z'),
      sender: {
        id: 'vendor-1',
        name: 'Vendor Owner',
        email: 'vendor@example.com',
        role: 'VENDOR',
        profileImage: null,
      },
    });
    prisma.eventTicket.findMany.mockResolvedValue([
      { userId: 'active-attendee' },
      { userId: 'used-attendee' },
    ]);

    await service.createMessage(
      'event-1',
      { body: 'Schedule update', type: 'ANNOUNCEMENT' },
      { id: 'vendor-1', role: 'VENDOR', permissions: ['chat:read', 'chat:create'] },
    );

    expect(prisma.eventTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId: 'event-1',
          status: { in: ['ACTIVE', 'USED'] },
          guestName: null,
          guestEmail: null,
        },
      }),
    );
  });

  it('rejects invalid read-state message id before upsert', async () => {
    prisma.eventChatMessage.findFirst.mockResolvedValue(null);

    await expect(
      service.markRead(
        'event-1',
        { lastReadMessageId: 'missing-message' },
        { id: 'vendor-1', role: 'VENDOR', permissions: ['chat:read'] },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.eventChatReadState.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid before pagination date before querying messages', async () => {
    await expect(
      service.listMessages(
        'event-1',
        { page: 1, limit: 50, before: 'not-a-date' },
        { id: 'vendor-1', role: 'VENDOR', permissions: ['chat:read'] },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.eventChatMessage.findMany).not.toHaveBeenCalled();
  });

  it('denies vendor for another vendor event', async () => {
    await expect(
      service.getRoom('event-1', {
        id: 'other-vendor',
        role: 'VENDOR',
        permissions: ['chat:read'],
      }),
    ).rejects.toThrow(HttpException);
  });

  it('denies non-moderator attendee from pinning or deleting messages', async () => {
    prisma.eventTicket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      eventId: 'event-1',
      userId: 'attendee-1',
      status: 'ACTIVE',
      guestName: null,
      guestEmail: null,
    });
    const actor = { id: 'attendee-1', role: 'USER', permissions: [] };

    await expect(
      service.updateMessagePin('event-1', 'message-1', { isPinned: true }, actor),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.deleteMessage('event-1', 'message-1', { reason: 'Spam' }, actor),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.eventChatMessage.update).not.toHaveBeenCalled();
  });

  it('denies vendor owner with only chat read permission from pinning or deleting messages', async () => {
    const actor = { id: 'vendor-1', role: 'VENDOR', permissions: ['chat:read'] };

    await expect(
      service.updateMessagePin('event-1', 'message-1', { isPinned: true }, actor),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.deleteMessage('event-1', 'message-1', { reason: 'Duplicate' }, actor),
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.eventChatMessage.update).not.toHaveBeenCalled();
  });

  it('allows vendor moderator with chat read and create permissions to pin own event message', async () => {
    prisma.eventChatMessage.findFirst.mockResolvedValue({ id: 'message-1' });
    prisma.eventChatMessage.update.mockResolvedValue({
      id: 'message-1',
      roomId: 'room-1',
      eventId: 'event-1',
      type: 'MESSAGE',
      body: 'Important detail',
      isPinned: true,
      createdAt: new Date('2026-06-08T10:00:00Z'),
      updatedAt: new Date('2026-06-08T10:02:00Z'),
      sender: {
        id: 'vendor-1',
        name: 'Vendor Owner',
        email: 'vendor@example.com',
        role: 'VENDOR',
        profileImage: null,
      },
    });

    const result = await service.updateMessagePin(
      'event-1',
      'message-1',
      { isPinned: true },
      { id: 'vendor-1', role: 'VENDOR', permissions: ['chat:read', 'chat:create'] },
    );

    expect(prisma.eventChatMessage.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'message-1',
        roomId: 'room-1',
        eventId: 'event-1',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.eventChatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'message-1' },
        data: { isPinned: true },
      }),
    );
    expect(result.isPinned).toBe(true);
  });

  it('soft deletes message with moderator identity and reason', async () => {
    prisma.eventChatMessage.findFirst.mockResolvedValue({ id: 'message-1' });
    prisma.eventChatMessage.update.mockResolvedValue({ id: 'message-1' });

    const result = await service.deleteMessage(
      'event-1',
      'message-1',
      { reason: 'Duplicate update' },
      { id: 'vendor-1', role: 'VENDOR', permissions: ['chat:read', 'chat:create'] },
    );

    expect(prisma.eventChatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'message-1' },
        data: expect.objectContaining({
          deletedById: 'vendor-1',
          deleteReason: 'Duplicate update',
        }),
      }),
    );
    expect(result).toEqual({ success: true, messageId: 'message-1' });
  });

  it('returns not found when pin target is missing or outside event room', async () => {
    prisma.eventChatMessage.findFirst.mockResolvedValue(null);

    await expect(
      service.updateMessagePin(
        'event-1',
        'message-from-other-room',
        { isPinned: true },
        { id: 'vendor-1', role: 'VENDOR', permissions: ['chat:read', 'chat:create'] },
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.eventChatMessage.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'message-from-other-room',
        roomId: 'room-1',
        eventId: 'event-1',
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.eventChatMessage.update).not.toHaveBeenCalled();
  });
});
