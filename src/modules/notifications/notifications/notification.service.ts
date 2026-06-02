import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { UserRole, NotificationType } from '@prisma/client';
import { NotificationDto, TimeFilter } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleNotification(user: any) {
    try {
      const updateUser = await this.prisma.user.update({
        where: { id: user.id },
        data: { notificationStatus: !user.notificationStatus },
      });
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
      const count = await this.prisma.notification.count({
        where: { userId: user.id, isRead: false },
      });

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

  async addNotification(payload: any) {
    return this.prisma.notification.create({ data: payload });
  }

  async getUserNotification(user: any, filter: NotificationDto) {
    const { limit, page } = filter;
    const skip = (page - 1) * limit;

    const [data, count] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        include: {
          eventTicket: { include: { event: true } },
          purchasedService: { include: { service: true } },
          purchasedBooking: { include: { booking: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId: user.id } }),
    ]);

    if (!data || data.length === 0) {
      return {
        success: false,
        data: null,
        message: 'No notification found',
      };
    }

    return {
      success: true,
      data,
      metadata: {
        count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getAdminNotification(filter: NotificationDto) {
    const { limit, page } = filter;
    const skip = (page - 1) * limit;

    const [data, docCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          type: { not: NotificationType.CHAT },
        },
        select: {
          id: true,
          type: true,
          isRead: true,
          createdAt: true,
          eventTicket: { select: { id: true } },
          purchasedService: { select: { id: true } },
          purchasedBooking: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({
        where: { type: { not: NotificationType.CHAT } },
      }),
    ]);

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

  async readNotification(id: string, user: any) {
    try {
      const notif = await this.prisma.notification.findFirst({
        where: { id, userId: user.id },
      });

      if (!notif) {
        return {
          success: false,
          message: 'Notification not found',
          statusCode: 404,
          data: null,
        };
      }

      const result = await this.prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

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
      if (user.role !== UserRole.ADMIN) {
        return {
          success: false,
          message: 'Bad Request: Only Admin and Advertiser can access this endpoint',
          statusCode: 400,
          data: null,
        };
      }

      const [notif, totalCount] = await Promise.all([
        this.prisma.notification.findMany({
          where: { userId: user.id },
          include: {
            user: { select: { id: true, name: true, email: true, profileImage: true } },
            eventTicket: true,
            purchasedService: true,
            purchasedBooking: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: nPage * nPerPage,
          take: nPerPage,
        }),
        this.prisma.notification.count({ where: { userId: user.id } }),
      ]);

      return {
        success: true,
        message: 'Notifications fetched successfully',
        data: notif,
        statusCode: 200,
        page: nPage + 1,
        limit: nPerPage,
        totalPages: Math.ceil(totalCount / nPerPage),
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
