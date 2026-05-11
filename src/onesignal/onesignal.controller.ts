import { Controller, Get, HttpException, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from 'src/schemas/enums/role';
import { ApiResponses } from 'src/shared/response';
import { OnesignalService } from './onesignal.service';
import { CurrentUser } from '@src/auth/jwt.strategy';
import { UserDocument } from '@src/schemas/user.shema';

@ApiTags('One signal')
@Controller('onesignal')
export class OnesignalController {
  constructor(private readonly oneSignalService: OnesignalService) {}

  @Get('/send-notification')
  @ApiResponses(true, [Role.ADMIN, Role.USER])
  async sendNotification(
    @Query('userId') userId: string,
    @Query('content') content: string,
  ) {
    const result = await this.oneSignalService.sendNotification(
      content,
      userId,
      'logo.png',
    );
    if (!result.success) {
      throw new HttpException(result.message, result.statusCode);
    }
    return result;
  }

  @Post('add-user-to-notification-list')
  @ApiResponses(true, [Role.ADMIN, Role.USER])
  async addUserToNotificationList(
    @Query('userId') userId: string,
    @Query('playerId') playerId: string,
  ) {
    const result = await this.oneSignalService.addUserToNotificationList(
      userId,
      playerId,
    );

    if (!result.success) {
      throw new HttpException(result.message, result.statusCode);
    }

    return result;
  }

  @Post('remove-user-from-notification-list')
  @ApiResponses(true, [Role.ADMIN, Role.USER])
  async removeUserFromNotificationList(
    @Query('userId') userId: string,
    @Query('playerId') playerId: string,
  ) {
    const result = await this.oneSignalService.removeUserFromNotificationList(
      userId,
      playerId,
    );

    if (!result.success) {
      throw new HttpException(result.message, result.statusCode);
    }

    return result;
  }

  @Get('mark-all-notification-as-read')
  @ApiResponses(true, [Role.USER])
  async markAllNotificationAsRead(@CurrentUser() user: UserDocument) {
    user.haveNewNotification = false;
    await user.save();
    return {
      success: true,
    };
  }
}
