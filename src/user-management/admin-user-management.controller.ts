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
import { Role } from '../schemas/enums/role';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { UserDocument } from 'src/schemas/user.shema';
import {
  ApiImageFile,
  UploadType,
} from 'src/decorators/check-mime-type.decorator';

@Controller('admin/user-management')
@ApiTags('Admin-User-Management')
export class AdminUserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @ApiResponses(true, [Role.ADMIN])
  @Get()
  findAll(@Query() userQueryDto: UserDto) {
    return this.userManagementService.findAll(userQueryDto);
  }

  @ApiResponses(true, [Role.ADMIN])
  @Post('set-commission')
  addCommission(
    @Body() addCommissionDto: AddCommissionDto,
    @CurrentUser() currentUser: UserDocument,
  ) {
    return this.userManagementService.addCommission(
      addCommissionDto,
      currentUser._id,
    );
  }

  @ApiResponses(true, [Role.ADMIN])
  @Get('get-commission')
  getCommission(@CurrentUser() currentUser: UserDocument) {
    return this.userManagementService.getCommission(currentUser._id);
  }

  @ApiResponses(true, [Role.ADMIN])
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

  @ApiResponses(true, [Role.ADMIN])
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

  @ApiResponses(true, [Role.ADMIN])
  @Delete('delete/soft/:userId')
  softDelete(@Param('userId') userId: string) {
    return this.userManagementService.softDelete(userId);
  }

  @ApiResponses(true, [Role.ADMIN])
  @Delete('delete/permanent/:userId')
  permanentDelete(@Param('userId') userId: string) {
    return this.userManagementService.remove(userId);
  }

  @ApiResponses(true, [Role.ADMIN])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userManagementService.findOne(id);
  }
}
