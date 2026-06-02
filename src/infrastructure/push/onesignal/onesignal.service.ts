import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

import { loggers } from '@src/common/interceptors/logger.enums';
import { PrismaService } from '@src/infrastructure/database/prisma.service';

@Injectable()
export class OnesignalService {
  constructor(
    private readonly prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async sendNotification(
    content: string,
    userId: string,
    image: string,
    redirectTo: string = '',
    other?: any,
  ) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return { statusCode: 404, success: false, message: 'User not found', data: null };
      }

      const config = this.configService.get('ONESIGNAL');
      if (user.playerId && user.notificationStatus === true) {
        const data = {
          app_id: config.ONE_SIGNAL_APP_ID,
          contents: { en: content },
          include_player_ids: [user.playerId],
          ios_attachments: {
            id1: `${join(process.cwd(), 'src', 'public', 'upload')}${image}`,
          },
          large_icon: `http://172.16.202.38:3001/static/${image}`,
          big_picture: `${join(process.cwd(), 'src', 'public', 'upload')}${image}`,
          redirectTo,
          ...other,
        };
        loggers.info('onesignal payload', data);
        const https = require('https');
        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Basic ${config.ONE_SIGNAL_API_KEY}`,
        };
        const options = { host: 'onesignal.com', port: 443, path: '/api/v1/notifications', method: 'POST', headers };
        const req = https.request(options, (res) => {
          res.on('data', (d) => loggers.info('onesignal response: %O', d.toString()));
        });
        req.on('error', (e) => loggers.info('onesignal error: ', e));
        req.write(JSON.stringify(data));
        req.end();
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { haveNewNotification: true },
      });

      return { success: true, message: 'Notification sent', statusCode: 200 };
    } catch (err) {
      return { success: false, message: err, data: err, statusCode: 500 };
    }
  }

  async addUserToNotificationList(userId: string, playerId: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        return { statusCode: 404, success: false, message: 'User not found', data: null };
      }

      if (!playerId || playerId === 'undefined' || playerId === 'null' || playerId === 'NULL') {
        return { statusCode: 400, success: false, message: 'Player id is invalid', data: null };
      }

      const result = await this.prisma.user.update({
        where: { id: user.id },
        data: { playerId },
      });

      return { statusCode: 200, success: true, message: 'User added to notification list', data: result };
    } catch (err) {
      return { success: false, message: err.message, data: err, statusCode: 500 };
    }
  }

  async removeUserFromNotificationList(userId: string, _playerId: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { statusCode: 404, success: false, message: 'User not found', data: null };
      }

      const result = await this.prisma.user.update({
        where: { id: user.id },
        data: { playerId: null },
      });

      return { statusCode: 200, success: true, message: 'User removed from notification list', data: result };
    } catch (err) {
      return { success: false, message: err.message, data: err, statusCode: 500 };
    }
  }

  async markAllNotificationAsRead(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { haveNewNotification: false },
    });
    return { success: true, message: 'Notification flag cleared', statusCode: 200 };
  }
}
