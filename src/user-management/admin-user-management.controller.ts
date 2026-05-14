import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Delete,
  Param,
  Patch,
  UploadedFile,
} from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { ApiConsumes, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import {
  AddCommissionDto,
  AdminUserProfileUpdateDto,
  UserDto,
  UserStatusAndNotificationAdminDto,
} from './dto/admin-users.dto';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/auth/jwt.strategy';
import {
  ApiImageFile,
  UploadType,
} from 'src/decorators/check-mime-type.decorator';

@Controller('admin/user-management')
@ApiTags('Admin-User-Management')
export class AdminUserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Permissions(Permission.USERS_READ)
  @ApiResponses(true, [UserRole.ADMIN])
  @Get()
  findAll(@Query() userQueryDto: UserDto) {
    return this.userManagementService.findAll(userQueryDto);
  }

  @Permissions(Permission.USERS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Post('set-commission')
  addCommission(
    @Body() addCommissionDto: AddCommissionDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.userManagementService.addCommission(
      addCommissionDto,
      currentUser.id,
    );
  }

  @Permissions(Permission.USERS_READ)
  @ApiResponses(true, [UserRole.ADMIN])
  @Get('get-commission')
  getCommission(@CurrentUser() currentUser: any) {
    return this.userManagementService.getCommission(currentUser.id);
  }

  @Permissions(Permission.USERS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Patch('update')
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  updateProfile(
    @Body() userProfileUpdateDto: AdminUserProfileUpdateDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let userId: string = userProfileUpdateDto.userId;
    delete userProfileUpdateDto.userId;
    return this.userManagementService.updateProfile(
      userProfileUpdateDto,
      userId,
      file,
    );
  }

  @Permissions(Permission.USERS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Patch('update/user-status-notification')
  updateStatusAndNotification(
    @Body()
    userStatusAndNotificationAdminDto: UserStatusAndNotificationAdminDto,
  ) {
    let userId: string = userStatusAndNotificationAdminDto.userId;
    delete userStatusAndNotificationAdminDto.userId;
    return this.userManagementService.updateStatusAndNotification(
      userStatusAndNotificationAdminDto,
      userId,
    );
  }

  @Permissions(Permission.USERS_DELETE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Delete('delete/soft/:userId')
  softDelete(@Param('userId') userId: string) {
    return this.userManagementService.softDelete(userId);
  }

  @Permissions(Permission.USERS_DELETE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Delete('delete/permanent/:userId')
  permanentDelete(@Param('userId') userId: string) {
    return this.userManagementService.remove(userId);
  }

  @Permissions(Permission.USERS_READ)
  @ApiResponses(true, [UserRole.ADMIN])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userManagementService.findOne(id);
  }
}
