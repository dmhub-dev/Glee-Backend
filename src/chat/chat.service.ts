import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { PrismaService } from '@src/prisma/prisma.service';
import { SocketGateway } from '@src/socket/socket.gateway';
import { OnesignalService } from '@src/onesignal/onesignal.service';
import { NotificationService } from '@src/notification/notification.service';
import { NotificationType } from '@prisma/client';
import * as moment from 'moment';
import { loggers } from '@src/interceptors/logger.enums';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifyService: OnesignalService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(createChatDto: CreateChatDto, user: any) {
    const event = await this.prisma.event.findUnique({
      where: { id: createChatDto.eventId },
    });

    if (!event || moment(event.endDate).isBefore(moment())) {
      throw new HttpException('Event has been expired', HttpStatus.BAD_REQUEST);
    }

    const toUser = await this.prisma.user.findUnique({
      where: { id: createChatDto.to },
    });

    if (!toUser) {
      throw new HttpException('User Does not Exist', HttpStatus.BAD_REQUEST);
    }

    if (toUser.profileStatus === false) {
      throw new HttpException('User is inactive.', HttpStatus.BAD_REQUEST);
    }

    const isBlocked = await this.prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: toUser.id,
          blockedId: user.id,
        },
      },
    });

    if (isBlocked) {
      throw new HttpException('You have been blocked by user', HttpStatus.BAD_REQUEST);
    }

    const data = await this.prisma.chat.create({
      data: {
        senderId: user.id,
        receiverId: createChatDto.to,
        message: createChatDto.message,
        isRead: false,
      },
    });

    SocketGateway.emitEvent(
      'chat',
      {
        id: data.id,
        user: {
          id: user?.id,
          name: user?.name,
          avatar: user?.profileImage,
        },
        text: createChatDto.message,
        createdAt: data.createdAt,
      },
      toUser.id,
    );

    await this.notificationService.addNotification({
      type: NotificationType.CHAT,
      userId: toUser.id,
    } as any);

    await this.notifyService.sendNotification(
      data.message,
      toUser.id,
      'logo.png',
      '',
      {
        headings: {
          en: user.name,
        },
        large_icon: user.profileImage,
      },
    );

    await this.prisma.user.update({
      where: { id: toUser.id },
      data: { isAllChatRead: false },
    });

    return {
      success: true,
      data: {
        id: data.id,
        user: {
          id: user?.id,
          name: user?.name,
          avatar: user?.profileImage,
        },
        text: createChatDto.message,
        createdAt: data.createdAt,
      },
    };
  }

  async findAll(from: string, to: string) {
    loggers.info('from: ', from, 'to: ', to);

    // Mark all messages from 'to' to 'from' as read
    await this.prisma.chat.updateMany({
      where: {
        AND: [
          { senderId: to },
          { receiverId: from },
        ],
      },
      data: { isRead: true },
    });

    // Get all chat messages between these two users
    const data = await this.prisma.chat.findMany({
      where: {
        OR: [
          { AND: [{ senderId: from }, { receiverId: to }] },
          { AND: [{ senderId: to }, { receiverId: from }] },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: data.map(msg => ({
        id: msg.id,
        user: {
          id: msg.sender.id,
          name: msg.sender.name,
          avatar: msg.sender.profileImage,
        },
        createdAt: msg.createdAt,
        text: msg.message,
        received: msg.isRead,
      })),
    };
  }

  async getChat(from: string, to: string) {
    const data = await this.prisma.chat.findMany({
      where: {
        OR: [
          { AND: [{ senderId: from }, { receiverId: to }] },
          { AND: [{ senderId: to }, { receiverId: from }] },
        ],
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return data.map(msg => ({
      id: msg.id,
      user: {
        id: msg.sender.id,
        name: msg.sender.name,
        avatar: msg.sender.profileImage,
      },
      createdAt: msg.createdAt,
      text: msg.message,
      received: msg.isRead,
    }));
  }

  async findOne(id: string) {
    const data = await this.prisma.chat.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        id: data?.id,
        from: data?.sender,
        to: data?.receiver,
        message: data?.message,
        isRead: data?.isRead,
        createdAt: data?.createdAt,
      },
    };
  }

  async update(id: string) {
    const data = await this.prisma.chat.update({
      where: { id },
      data: { isRead: true },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        id: data.id,
        from: data.sender,
        to: data.receiver,
        message: data.message,
        isRead: data.isRead,
        createdAt: data.createdAt,
      },
    };
  }
}
