import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { join } from 'path';
// import { ResponseInterface } from 'src/admin/util/ResponseInterface';
import { User, UserDocument } from 'src/schemas/user.shema';
import { loggers } from '@src/interceptors/logger.enums';

@Injectable()
export class OnesignalService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
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
      const user: UserDocument = await this.userModel.findById(userId);
      var headers = {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${
          this.configService.get('ONESIGNAL').ONE_SIGNAL_API_KEY
        }`,
      };

      var options = {
        host: 'onesignal.com',
        port: 443,
        path: '/api/v1/notifications',
        method: 'POST',
        headers: headers,
      };

      if (!user) {
        return {
          statusCode: 404,
          success: false,
          message: 'User not found',
          data: null,
        };
      }
      const config = this.configService.get('ONESIGNAL');
      if (
        user.notificationIds &&
        user.notificationIds !== undefined &&
        user.notificationIds !== null &&
        user.notificationIds.length > 0 &&
        user.notificationStatus === true
      ) {
        const data = {
          app_id: config.ONE_SIGNAL_APP_ID,
          contents: { en: content },
          include_player_ids: !user.notificationIds ? [] : user.notificationIds,
          ios_attachments: {
            id1: `${join(process.cwd(), 'src', 'public', 'upload')}${image}`,
          },
          // large_icon: `${this.configService.get('APP_URL')}/static/${image}`,
          large_icon: `http://172.16.202.38:3001/static/${image}`,
          // large_icon: `https://cdn-icons-png.flaticon.com/512/603/603197.png`,
          big_picture: `${join(
            process.cwd(),
            'src',
            'public',
            'upload',
          )}${image}`,
          redirectTo: redirectTo,
          ...other,
          // include_player_ids: ['004abf6d-b6d4-4c62-a3a8-16513aaa8ad6'],
        };
        loggers.info('image url.......... ', data);
        var https = require('https');
        var req = https.request(options, function (res) {
          res.on('data', function (data) {
            loggers.info('swagger data........... %O', data.toString());
          });
        });

        req.on('error', function (e) {
          loggers.info('error........... ', e);
        });

        req.write(JSON.stringify(data));
        req.end();
      }
      user.haveNewNotification = true;
      await user.save();
      return {
        success: true,
        message: 'Notification sent',
        statusCode: 200,
      };
    } catch (err) {
      return {
        success: false,
        message: err,
        data: err,
        statusCode: 500,
      };
    }
  }

  async addUserToNotificationList(userId: string, playerId: string) {
    try {
      const user: UserDocument = await this.userModel.findOne({
        _id: new Object(userId),
      });

      if (!user) {
        return {
          statusCode: 404,
          success: false,
          message: 'User not found',
          data: null,
        };
      }
      if (
        !playerId ||
        playerId === undefined ||
        playerId === null ||
        playerId === '' ||
        playerId === 'undefined' ||
        playerId === 'null' ||
        playerId === 'NULL'
      ) {
        return {
          statusCode: 400,
          success: false,
          message: 'Player id is invalid',
          data: null,
        };
      }
      const result = await this.userModel.updateOne(
        { _id: user._id },
        { $addToSet: { notificationIds: playerId } },
      );

      return {
        statusCode: 200,
        success: true,
        message: 'User added to notification list',
        data: result,
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

  async removeUserFromNotificationList(userId: string, playerId: string) {
    try {
      const user: UserDocument = await this.userModel.findOne({ _id: userId });
      if (!user) {
        return {
          statusCode: 404,
          success: false,
          message: 'User not found',
          data: null,
        };
      }
      const result = await this.userModel.updateOne(
        { _id: user._id },
        { $pull: { notificationIds: playerId } },
      );

      return {
        statusCode: 200,
        success: true,
        message: 'User removed from notification list',
        data: result,
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
