import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { OnesignalService } from '@src/infrastructure/push/onesignal/onesignal.service';
import {
  ChatPaginationQueryDto,
  CreateEventChatMessageDto,
  DeleteEventChatMessageDto,
  MarkEventChatReadDto,
  UpdateEventChatMessageDto,
} from './dto/event-chat.dto';

type ChatMessageType = 'MESSAGE' | 'ANNOUNCEMENT' | 'SYSTEM';
type ChatRoomStatus = 'ACTIVE' | 'READ_ONLY' | 'LOCKED';

export type ChatAccess = {
  canRead: boolean;
  canWrite: boolean;
  canModerate: boolean;
  canAnnounce: boolean;
  canPin: boolean;
};

const SAFE_SENDER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  profileImage: true,
};

@Injectable()
export class EventChatService {
  private readonly FINAL_UPDATE_HOURS = 48;
  private readonly MAX_MESSAGES_PER_MINUTE = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly oneSignalService: OnesignalService,
  ) {}

  async getRoom(eventId: string, actor: any) {
    const event = await this.findEventOrThrow(eventId);
    const room = await this.ensureRoom(event);
    const access = await this.resolveAccess(event, room, actor);

    if (!access.canRead) {
      throw new HttpException('You do not have access to this chat', HttpStatus.FORBIDDEN);
    }

    const unreadCount = await this.getUnreadCount(room, actor?.id);
    return this.serializeRoom(room, event, access, unreadCount);
  }

  async listMessages(eventId: string, query: ChatPaginationQueryDto, actor: any) {
    const roomResult = await this.getRoom(eventId, actor);
    const page = Math.max(Number(query?.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query?.limit ?? 50), 1), 100);
    const skip = (page - 1) * limit;
    const before = query?.before ? new Date(query.before) : null;

    if (query?.before && Number.isNaN(before.getTime())) {
      throw new HttpException('Invalid before date', HttpStatus.BAD_REQUEST);
    }

    const where: any = {
      roomId: roomResult.id,
      eventId,
      deletedAt: null,
    };

    if (before) {
      where.createdAt = { lt: before };
    }

    const messages = await (this.prisma as any).eventChatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        roomId: true,
        eventId: true,
        type: true,
        body: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
        sender: { select: SAFE_SENDER_SELECT },
      },
    });

    return {
      data: messages.map((message) => this.serializeMessage(message)),
      meta: { page, limit },
    };
  }

  async createMessage(eventId: string, dto: CreateEventChatMessageDto, actor: any) {
    const event = await this.findEventOrThrow(eventId);
    const room = await this.ensureRoom(event);
    const access = await this.resolveAccess(event, room, actor);
    const type = dto.type ?? 'MESSAGE';

    this.assertCanWrite(room, access, type);
    await this.assertRateLimit(room.id, actor?.id);

    const message = await (this.prisma as any).eventChatMessage.create({
      data: {
        roomId: room.id,
        eventId,
        senderId: actor?.id ?? null,
        type,
        body: dto.body,
        isPinned: type === 'ANNOUNCEMENT',
      },
      select: {
        id: true,
        roomId: true,
        eventId: true,
        type: true,
        body: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
        sender: { select: SAFE_SENDER_SELECT },
      },
    });

    if (type === 'ANNOUNCEMENT') {
      await this.notifyAnnouncement(event, message);
    }

    return this.serializeMessage(message);
  }

  async markRead(eventId: string, dto: MarkEventChatReadDto, actor: any) {
    const event = await this.findEventOrThrow(eventId);
    const room = await this.ensureRoom(event);
    const access = await this.resolveAccess(event, room, actor);

    if (!access.canRead) {
      throw new HttpException('You do not have access to this chat', HttpStatus.FORBIDDEN);
    }

    if (!actor?.id) {
      throw new HttpException('Login required', HttpStatus.UNAUTHORIZED);
    }

    if (dto?.lastReadMessageId) {
      const message = await (this.prisma as any).eventChatMessage.findFirst({
        where: {
          id: dto.lastReadMessageId,
          roomId: room.id,
          eventId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!message) {
        throw new HttpException('Invalid last read message', HttpStatus.BAD_REQUEST);
      }
    }

    const readState = await (this.prisma as any).eventChatReadState.upsert({
      where: { roomId_userId: { roomId: room.id, userId: actor.id } },
      create: {
        roomId: room.id,
        eventId,
        userId: actor.id,
        lastReadMessageId: dto?.lastReadMessageId ?? null,
        lastReadAt: new Date(),
      },
      update: {
        lastReadMessageId: dto?.lastReadMessageId ?? null,
        lastReadAt: new Date(),
      },
    });

    return readState;
  }

  async updateMessagePin(
    eventId: string,
    messageId: string,
    dto: UpdateEventChatMessageDto,
    actor: any,
  ) {
    const { room } = await this.getModerationContext(eventId, actor);
    const message = await this.findActiveMessageOrThrow(room.id, eventId, messageId);

    const updatedMessage = await (this.prisma as any).eventChatMessage.update({
      where: { id: message.id },
      data: { isPinned: dto.isPinned },
      select: this.messageSelect(),
    });

    return this.serializeMessage(updatedMessage);
  }

  async deleteMessage(
    eventId: string,
    messageId: string,
    dto: DeleteEventChatMessageDto,
    actor: any,
  ) {
    const { room } = await this.getModerationContext(eventId, actor);
    const message = await this.findActiveMessageOrThrow(room.id, eventId, messageId);

    await (this.prisma as any).eventChatMessage.update({
      where: { id: message.id },
      data: {
        deletedAt: new Date(),
        deletedById: actor.id,
        deleteReason: dto?.reason ?? null,
      },
    });

    return { success: true, messageId: message.id };
  }

  async updateSettings(eventId: string, dto: { staffOnly: boolean }, actor: any) {
    const event = await this.findEventOrThrow(eventId);
    const room = await this.ensureRoom(event);
    const access = await this.resolveAccess(event, room, actor);

    if (!access.canModerate) {
      throw new HttpException('You do not have moderation access to this chat', HttpStatus.FORBIDDEN);
    }

    const updated = await (this.prisma as any).eventChatRoom.update({
      where: { id: room.id },
      data: { staffOnly: dto.staffOnly },
    });

    const unreadCount = await this.getUnreadCount(updated, actor?.id);
    return this.serializeRoom(updated, event, access, unreadCount);
  }

  private async findEventOrThrow(eventId: string) {
    const event = await (this.prisma as any).event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        vendorId: true,
        status: true,
        startDate: true,
        endDate: true,
        endedAt: true,
        createdAt: true,
        isDeleted: true,
      },
    });

    if (!event || event.isDeleted) {
      throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
    }

    return event;
  }

  private async ensureRoom(event: any) {
    const roomState = this.resolveRoomStatus(event);
    return (this.prisma as any).eventChatRoom.upsert({
      where: { eventId: event.id },
      create: {
        eventId: event.id,
        status: roomState.status,
        finalUpdatesUntil: roomState.finalUpdatesUntil,
        lockedAt: roomState.lockedAt,
        staffOnly: false,
      },
      update: {
        status: roomState.status,
        finalUpdatesUntil: roomState.finalUpdatesUntil,
        lockedAt: roomState.lockedAt,
      },
    });
  }

  private async getModerationContext(eventId: string, actor: any) {
    const event = await this.findEventOrThrow(eventId);
    const room = await this.ensureRoom(event);
    const access = await this.resolveAccess(event, room, actor);

    if (!access.canRead) {
      throw new HttpException('You do not have access to this chat', HttpStatus.FORBIDDEN);
    }

    if (!access.canModerate) {
      throw new HttpException('You do not have moderation access to this chat', HttpStatus.FORBIDDEN);
    }

    return { event, room, access };
  }

  private async findActiveMessageOrThrow(roomId: string, eventId: string, messageId: string) {
    const message = await (this.prisma as any).eventChatMessage.findFirst({
      where: {
        id: messageId,
        roomId,
        eventId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!message) {
      throw new HttpException('Chat message not found', HttpStatus.NOT_FOUND);
    }

    return message;
  }

  private resolveRoomStatus(event: any) {
    const now = new Date();

    if (event.status === 'CANCELLED' || event.status === 'REJECTED') {
      return { status: 'LOCKED' as ChatRoomStatus, finalUpdatesUntil: null, lockedAt: now };
    }

    if (event.status === 'POSTPONED') {
      return { status: 'READ_ONLY' as ChatRoomStatus, finalUpdatesUntil: null, lockedAt: null };
    }

    if (event.status === 'ENDED') {
      const endedAt = new Date(event.endedAt ?? event.endDate ?? event.createdAt);
      const finalUpdatesUntil = this.addHours(endedAt, this.FINAL_UPDATE_HOURS);

      if (now <= finalUpdatesUntil) {
        return { status: 'READ_ONLY' as ChatRoomStatus, finalUpdatesUntil, lockedAt: null };
      }

      return { status: 'LOCKED' as ChatRoomStatus, finalUpdatesUntil, lockedAt: finalUpdatesUntil };
    }

    if (!event.endDate) {
      return { status: 'ACTIVE' as ChatRoomStatus, finalUpdatesUntil: null, lockedAt: null };
    }

    const eventEnd = new Date(event.endDate);
    const finalUpdatesUntil = this.addHours(eventEnd, this.FINAL_UPDATE_HOURS);

    if (now <= eventEnd) {
      return { status: 'ACTIVE' as ChatRoomStatus, finalUpdatesUntil: null, lockedAt: null };
    }

    if (now <= finalUpdatesUntil) {
      return { status: 'READ_ONLY' as ChatRoomStatus, finalUpdatesUntil, lockedAt: null };
    }

    return { status: 'LOCKED' as ChatRoomStatus, finalUpdatesUntil, lockedAt: finalUpdatesUntil };
  }

  private async resolveAccess(event: any, room: any, actor: any): Promise<ChatAccess> {
    const noAccess = {
      canRead: false,
      canWrite: false,
      canModerate: false,
      canAnnounce: false,
      canPin: false,
    };

    if (!actor?.id) return noAccess;

    const permissions = Array.isArray(actor.permissions) ? actor.permissions : [];
    const hasChatRead = permissions.includes('chat:read');
    const hasChatCreate = permissions.includes('chat:create');
    const isLocked = room.status === 'LOCKED';
    const isActive = room.status === 'ACTIVE';
    const canAnnounce = room.status === 'ACTIVE' || room.status === 'READ_ONLY';
    const fullStaffAccess = {
      canRead: true,
      canWrite: isActive,
      canModerate: true,
      canAnnounce: !isLocked && canAnnounce,
      canPin: true,
    };
    const permissionedStaffAccess = {
      canRead: true,
      canWrite: isActive && hasChatCreate,
      canModerate: hasChatCreate,
      canAnnounce: !isLocked && canAnnounce && hasChatCreate,
      canPin: hasChatCreate,
    };

    if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN') {
      return fullStaffAccess;
    }

    if ((actor.role === 'OPERATIONS_MANAGER' || actor.role === 'CUSTOMER_SUPPORT') && hasChatRead) {
      return permissionedStaffAccess;
    }

    if (actor.role === 'VENDOR' && hasChatRead) {
      if (event.vendorId !== actor.id) return noAccess;
      return permissionedStaffAccess;
    }

    if (actor.role === 'VENDOR_STAFF' && hasChatRead) {
      if (event.vendorId !== actor.vendorAccountId) return noAccess;
      return permissionedStaffAccess;
    }

    const activeTicket = await (this.prisma as any).eventTicket.findFirst({
      where: {
        eventId: event.id,
        userId: actor.id,
        status: { not: 'CANCELLED' },
      },
      select: { id: true },
    });

    if (!activeTicket) return noAccess;

    return {
      canRead: true,
      canWrite: isActive && !room.staffOnly,
      canModerate: false,
      canAnnounce: false,
      canPin: true,
    };
  }

  private assertCanWrite(room: any, access: ChatAccess, type: ChatMessageType) {
    if (room.status === 'LOCKED') {
      throw new HttpException('Chat is locked', HttpStatus.CONFLICT);
    }

    if (type === 'ANNOUNCEMENT') {
      if (!access.canAnnounce) {
        throw new HttpException('Only staff can post announcements', HttpStatus.FORBIDDEN);
      }
      return;
    }

    if (room.status === 'READ_ONLY') {
      throw new HttpException('Chat is read only', HttpStatus.FORBIDDEN);
    }

    if (!access.canWrite) {
      throw new HttpException('You do not have write access to this chat', HttpStatus.FORBIDDEN);
    }
  }

  private async assertRateLimit(roomId: string, senderId?: string) {
    if (!senderId) {
      throw new HttpException('Login required', HttpStatus.UNAUTHORIZED);
    }

    const since = new Date(Date.now() - 60 * 1000);
    const count = await (this.prisma as any).eventChatMessage.count({
      where: {
        roomId,
        senderId,
        createdAt: { gte: since },
        deletedAt: null,
      },
    });

    if (count >= this.MAX_MESSAGES_PER_MINUTE) {
      throw new HttpException('Too many chat messages', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async getUnreadCount(room: any, userId?: string) {
    if (!userId) return 0;

    const readState = await (this.prisma as any).eventChatReadState.findUnique({
      where: { roomId_userId: { roomId: room.id, userId } },
      select: { lastReadMessage: { select: { createdAt: true } }, lastReadAt: true },
    });

    const where: any = {
      roomId: room.id,
      deletedAt: null,
    };

    const lastReadAt = readState?.lastReadMessage?.createdAt ?? readState?.lastReadAt;
    if (lastReadAt) where.createdAt = { gt: lastReadAt };

    return (this.prisma as any).eventChatMessage.count({ where });
  }

  private serializeRoom(room: any, event: any, access: ChatAccess, unreadCount: number) {
    return {
      id: room.id,
      eventId: room.eventId,
      event: { id: event.id, name: event.name },
      status: room.status,
      finalUpdatesUntil: room.finalUpdatesUntil,
      lockedAt: room.lockedAt,
      staffOnly: room.staffOnly,
      access,
      unreadCount,
    };
  }

  private messageSelect() {
    return {
      id: true,
      roomId: true,
      eventId: true,
      type: true,
      body: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      sender: { select: SAFE_SENDER_SELECT },
    };
  }

  private serializeMessage(message: any) {
    return {
      id: message.id,
      roomId: message.roomId,
      eventId: message.eventId,
      type: message.type,
      body: message.body,
      isPinned: message.isPinned,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: this.serializeSender(message.sender),
    };
  }

  private serializeSender(sender: any) {
    if (!sender) return null;

    const parts = String(sender.name ?? '').trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? 'User';
    const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : '';
    const role = typeof sender.role === 'object' ? (sender.role?.name ?? null) : (sender.role ?? null);

    return {
      id: sender.id,
      displayName: [firstName, lastInitial].filter(Boolean).join(' '),
      profileImage: sender.profileImage ?? null,
      role,
    };
  }

  private async notifyAnnouncement(event: any, message: any) {
    const tickets = await (this.prisma as any).eventTicket.findMany({
      where: {
        eventId: event.id,
        status: { in: ['ACTIVE', 'USED'] },
        guestName: null,
        guestEmail: null,
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    await Promise.all(
      tickets.map((ticket) =>
        this.oneSignalService.sendNotification(
          `${event.name}: ${message.body}`,
          ticket.userId,
          '',
          `/event/${event.id}`,
          { type: 'EVENT_CHAT_ANNOUNCEMENT', eventId: event.id, messageId: message.id },
        ),
      ),
    );
  }

  private addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
  }
}
