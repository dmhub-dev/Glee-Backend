import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { query } from 'express';
import { FilterQuery, Model } from 'mongoose';
import { Role } from 'src/schemas/enums/role';
import {
  Notification,
  NotificationDocument,
} from 'src/schemas/notification.schema';
import { User, UserDocument } from 'src/schemas/user.shema';
import { NotificationDto, TimeFilter } from './dto/notification.dto';
import { ObjectId } from 'bson';
import { NotificationType } from '@src/schemas/enums/notification-enum';
import { aggregateUserNotificationListing } from '@src/notification/aggregation/notification.aggregate';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>, // @InjectModel(Post.name) private postModel: Model<PostDocument>,
  ) {}
  async toggleNotification(user: any) {
    try {
      const updateUser = await this.userModel.findOneAndUpdate(
        { _id: user._id },
        { $set: { notificationStatus: !user.notificationStatus } },
      );
      return {
        success: true,
        message: 'Notification status updated',
        data: { notificationStatus: !user.notificationStatus },
        statusCode: 200,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: error,
        statusCode: 500,
      };
    }
  }
  async getUnreadCount(user: any) {
    try {
      const count: any = (
        await this.notificationModel.aggregate([
          { $match: { userId: user._id } },
          {
            $lookup: {
              from: 'ads',
              localField: 'postId',
              foreignField: '_id',
              as: 'postId',
            },
          },
        ])
      ).length;

      return {
        success: true,
        message: 'Notification count fetched successfully',
        data: { count },
        statusCode: 200,
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
        data: err,
        statusCode: 500,
      };
    }
  }

  async addNotification(payload: NotificationDocument) {
    return this.notificationModel.create(payload);
  }

  async getUserNotification(user: UserDocument, filter: NotificationDto) {
    const { limit, page } = filter;
    const data: any[] = await this.notificationModel.aggregate(
      aggregateUserNotificationListing({ to: user._id }, filter),
    );

    if (!data || data.length === 0) {
      return {
        success: false,
        data: null,
        message: 'No notification found',
      };
    }
    return {
      success: true,
      data: data[0]?.data,
      metadata: data[0]?.metadata[0],
    };
  }

  async getAdminNotification(filter: NotificationDto) {
    const { limit, page } = filter;
    const data = await this.notificationModel
      .find(
        {
          notificationType: {
            $ne: NotificationType.CHAT,
          },
        },
        {
          orderPayload: 1,
          orderModel: 1,
          notificationType: 1,
          body: 1,
        },
      )
      .skip((page - 1) * limit)
      .limit(limit)
      .sort('-createdAt');
    const docCount = await this.notificationModel.count({
      notificationType: {
        $ne: NotificationType.CHAT,
      },
    });
    if (!data) {
      return {
        success: false,
        data: null,
        message: 'No notification found',
      };
    }
    return {
      success: true,
      data,
      page,
      limit,
      totalPages: Math.ceil(docCount / limit),
    };
  }

  async readNotification(id: string, user: UserDocument) {
    try {
      const notif = await this.notificationModel.findOne({
        userId: user._id,
        _id: id,
      });
      if (notif == null) {
        return {
          success: false,
          message: 'Notification not found',
          statusCode: 404,
          data: null,
        };
      }

      const result = await notif.save();
      return {
        success: true,
        message: 'Notification read successfully',
        data: result,
        statusCode: 200,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: error,
        statusCode: 500,
      };
    }
  }

  async getAdminAdvNotification(user: any, page: string, perPage: string) {
    let nPage = page == null ? 1 : parseInt(page);
    let nPerPage = perPage == null ? 10 : parseInt(perPage);
    nPage--;
    try {
      let notif;
      if (user.role == Role.ADMIN) {
        notif = await this.notificationModel
          .find({ userId: user._id })
          .populate({
            path: 'actorId',
            select: 'name email profileImage phone',
            model: this.userModel,
          })
          .populate({
            path: 'userId',
            select: 'name email profileImage phone',
            model: this.userModel,
          })
          .populate({
            path: 'postId',
            select: '',
            // model: this.postModel,
          })
          .sort({ createdAt: -1 })
          .skip(nPage * nPerPage)
          .limit(nPerPage);
      } else {
        return {
          success: false,
          message:
            'Bad Request: Only Admin and Advertiser can access this endpoint',
          statusCode: 400,
          data: null,
        };
      }
      return {
        success: true,
        message: 'Notifications fetched successfully',
        data: notif,
        statusCode: 200,
      };
    } catch (err) {
      return {
        success: false,
        message: err.message,
        data: err,
        statusCode: 500,
      };
    }
  }
}
