import { Controller, Get, HttpException, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
// import { PaginationDto } from 'src/modules/usermanagment/dtos/pagination.dto';
import { UserRole } from '@prisma/client';
import { ApiResponses } from '@src/common/responses/response';
import { NotificationDto } from './dto/notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notificaton')
@Controller('admin/notification')
export class AdminNotificationController {
  constructor(private notificationService: NotificationService) {}

  @ApiResponses(true, [UserRole.ADMIN, UserRole.USER])
  @Get('/')
  async getNotification(@Query() query: NotificationDto, @CurrentUser() user) {
    const result = await this.notificationService.getAdminNotification(query);

    // if (!result.success) {
    //   throw new HttpException(result.message, result.statusCode);
    // }
    return result;
  }

  // @Get('read')
  // @ApiResponses()
  // async readNotification(@Query('id') id: string, @CurrentUser() user) {
  //   const result = await this.notificationService.readNotification(id, user);
  //
  //   if (!result.success) {
  //     throw new HttpException(result.message, result.statusCode);
  //   }
  //   return result;
  // }

  // @Get('/admin-adv-notification')
  // @ApiResponses(true, [UserRole.ADMIN, UserRole.USER])
  // async getAdminAdvNotification(
  //   @Query() query: AdvNotificationDto,
  //   @CurrentUser() user,
  // ) {
  //   const result = await this.notificationService.getAdminAdvNotification(
  //     user,
  //     query.page,
  //     query.perPage,
  //   );
  //   if (!result.success) {
  //     throw new HttpException(result.message, result.statusCode);
  //   }
  //   return result;
  // }

  // @Get('/get-unread-count')
  // @ApiResponses(true, [UserRole.ADMIN, UserRole.USER])
  // async getUnreadCount(@CurrentUser() user) {
  //   const result = await this.notificationService.getUnreadCount(user);
  //
  //   if (!result.success) {
  //     throw new HttpException(result.message, result.statusCode);
  //   }
  //   return result;
  // }

  // @Post('toggle-notification')
  // @ApiResponses(true, [UserRole.ADMIN, UserRole.USER])
  // async toggleNotification(@CurrentUser() user) {
  //   const result = await this.notificationService.toggleNotification(user);
  //
  //   if (!result.success) {
  //     throw new HttpException(result.message, result.statusCode);
  //   }
  //   return result;
  // }
}
