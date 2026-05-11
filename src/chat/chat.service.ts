import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { Model } from 'mongoose';
import { User, UserDocument } from '@src/schemas/user.shema';
import { InjectModel } from '@nestjs/mongoose';
import { Chat, ChatDocument } from '@src/schemas/chat.schema';
import { SocketGateway } from '@src/socket/socket.gateway';
import { OnesignalService } from '@src/onesignal/onesignal.service';
import { aggregateGetAllChat } from '@src/chat/aggregation/chat.aggregate';
import { NotificationService } from '@src/notification/notification.service';
import { Events, EventsDocument } from '@src/schemas/events.schema';
import { NotificationType } from '@src/schemas/enums/notification-enum';
import { NotificationDocument } from '@src/schemas/notification.schema';
import * as moment from 'moment';
import { loggers } from '@src/interceptors/logger.enums';
import mongoose from 'mongoose';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Events.name)
    private readonly eventModel: Model<EventsDocument>,
    @InjectModel(Chat.name)
    private readonly chatModel: Model<ChatDocument>,
    private readonly notifyService: OnesignalService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(createChatDto: CreateChatDto, user) {
    const event: EventsDocument = await this.eventModel.findById(
      createChatDto.eventId,
    );

    if (!event || moment(event.date?.end).isBefore(moment()))
      throw new HttpException('Event has been expired', HttpStatus.BAD_REQUEST);

    let toUser: UserDocument = await this.userModel.findById(createChatDto.to);
    if (!toUser)
      throw new HttpException('User Does not Exist', HttpStatus.BAD_REQUEST);

    if (toUser.profileStatus === false)
      throw new HttpException('User is inactive.', HttpStatus.BAD_REQUEST);

    const isBlocked = toUser.blockedUsersList.includes(user._id.toString());
    if (isBlocked)
      throw new HttpException(
        'You have been blocked by user',
        HttpStatus.BAD_REQUEST,
      );
    const data: ChatDocument = await this.chatModel.create({
      from: user._id.toString(),
      to: createChatDto.to,
      message: createChatDto.message,
      isRead: false,
      eventId: event._id.toString(),
    });

    SocketGateway.emitEvent(
      'chat',
      {
        _id: data.createdAt,
        user: {
          _id: user?._id.toString(),
          name: user?.name,
          avatar: user?.profileImage,
        },
        text: createChatDto.message,
        createdAt: data.createdAt,
      },
      toUser._id.toString(),
    );
    await this.notificationService.addNotification({
      from: user._id,
      to: toUser._id,
      eventId: event._id,
      notificationType: NotificationType.CHAT,
      message: createChatDto.message,
    } as NotificationDocument);
    await this.notifyService.sendNotification(
      data.message,
      toUser._id.toString(),
      'logo.png',
      '',
      {
        headings: {
          en: user.name,
        },
        large_icon: user.profileImage,
      },
    );

    toUser.isAllChatRead = false;
    await toUser.save();

    return {
      success: true,
      data: {
        _id: data.createdAt,
        user: {
          _id: user?._id.toString(),
          name: user?.name,
          avatar: user?.profileImage,
        },
        text: createChatDto.message,
        createdAt: data.createdAt,
      },
    };
  }

  async findAll(from, to, user?: UserDocument) {
    loggers.info('from: ', from, 'to: ', to);
    await this.chatModel.updateMany(
        {
          $and: [{from: to}, {to: from}],
        },
        {isRead: true},
        {new: true},
    );
    const data = await this.chatModel.aggregate(aggregateGetAllChat(from, to));

    // if (data) {

    // }
    return {
      success: true,
      data,
    };
  }

  async getChat(from, to) {
    return this.chatModel.aggregate(aggregateGetAllChat(from, to));
  }

  async findOne(id: string) {
    const data = await this.chatModel
        .findById(id)
        .populate('from', 'name profileImage')
        .populate('to', 'name profileImage');
    return {
      success: true,
      data,
    };
  }

  async update(id: string) {
    const data = await this.chatModel
      .findByIdAndUpdate(id, { isRead: true }, { new: true })
      .populate('from', 'name profileImage')
      .populate('to', 'name profileImage');
    return {
      success: true,
      data,
    };
  }
}
