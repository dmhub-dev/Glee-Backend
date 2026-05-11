import { Controller, Get, HttpException, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
// import { QueryDto } from 'src/admin/dto/query.dto';
// import { TimeFilterDto } from 'src/admin/dto/time-filter.dto';
// import { ResponseInterface } from 'src/admin/util/ResponseInterface';
import { CurrentUser } from 'src/auth/jwt.strategy';
// import { PaginationDto } from 'src/modules/usermanagment/dtos/pagination.dto';
import { Role } from 'src/schemas/enums/role';
import { ApiResponses } from 'src/shared/response';
import { NotificationDto } from './dto/notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notificaton')
@Controller('notification')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @ApiResponses(true, [Role.ADMIN, Role.USER])
  @Get('/')
  async getUserNotification(
    @Query() query: NotificationDto,
    @CurrentUser() user,
  ) {
    const result = await this.notificationService.getUserNotification(
      user,
      query,
    );

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
  // @ApiResponses(true, [Role.ADMIN, Role.USER])
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
  // @ApiResponses(true, [Role.ADMIN, Role.USER])
  // async getUnreadCount(@CurrentUser() user) {
  //   const result = await this.notificationService.getUnreadCount(user);
  //
  //   if (!result.success) {
  //     throw new HttpException(result.message, result.statusCode);
  //   }
  //   return result;
  // }
  //
  // @Post('toggle-notification')
  // @ApiResponses(true, [Role.ADMIN, Role.USER])
  // async toggleNotification(@CurrentUser() user) {
  //   const result = await this.notificationService.toggleNotification(user);
  //
  //   if (!result.success) {
  //     throw new HttpException(result.message, result.statusCode);
  //   }
  //   return result;
  // }
}
