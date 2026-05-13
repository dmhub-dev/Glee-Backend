import { Controller, Get, HttpException, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ApiResponses } from 'src/shared/response';
import { OnesignalService } from './onesignal.service';
import { CurrentUser } from '@src/auth/jwt.strategy';

@ApiTags('One signal')
@Controller('onesignal')
export class OnesignalController {
  constructor(private readonly oneSignalService: OnesignalService) {}

  @Get('/send-notification')
  @ApiResponses(true, [UserRole.ADMIN, UserRole.USER])
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
  @ApiResponses(true, [UserRole.ADMIN, UserRole.USER])
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
  @ApiResponses(true, [UserRole.ADMIN, UserRole.USER])
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
  @ApiResponses(true, [UserRole.USER])
  async markAllNotificationAsRead(@CurrentUser() user: any) {
    return this.oneSignalService.markAllNotificationAsRead(user.id);
  }
}
