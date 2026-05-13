import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import { UserDto } from './dto/admin-users.dto';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/auth/jwt.strategy';
import {
  UpdatePasswordDto,
  UserProfileUpdateDto,
  UserStatusAndNotificationDto,
} from './dto/user.dto';
import {
  ApiImageFile,
  UploadType,
} from 'src/decorators/check-mime-type.decorator';
import { loggers } from '@src/interceptors/logger.enums';
import { comparePasswords } from '@src/shared/utils';
import * as bcrypt from 'bcrypt';

@Controller('user-management')
@ApiTags('User-Management')
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @ApiResponses(true, [UserRole.USER])
  @Patch('update')
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  updateProfile(
    @Body() userProfileUpdateDto: UserProfileUpdateDto,
    @CurrentUser() currentUser: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userManagementService.updateProfile(
      userProfileUpdateDto,
      currentUser.id,
      file,
    );
  }

  @ApiResponses(true, [UserRole.USER])
  @Patch('update/user-status')
  async updateStatusAndNotification(
    @Body() userStatusAndNotificationDto: UserStatusAndNotificationDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.userManagementService.updateStatusAndNotification(
      userStatusAndNotificationDto,
      currentUser.id,
    );
  }

  @ApiResponses(true, [UserRole.USER])
  @Get('/blocked-users')
  async getBlockUserListing(@CurrentUser() user: any) {
    return {
      success: true,
      data: [],
    };
  }

  @ApiResponses(true, [UserRole.USER])
  @Get('unblock/:userId')
  async unblockUser(
    @Param('userId') userToUnblock: string,
    @CurrentUser() user: any,
  ) {
    const doc = await this.userManagementService.userExist(userToUnblock);
    if (!doc)
      throw new HttpException(`User does not exists`, HttpStatus.BAD_REQUEST);
    if (doc.isDeleted)
      throw new HttpException(
        'User is already Deleted',
        HttpStatus.BAD_REQUEST,
      );
    return {
      success: true,
      message: 'User successfully unblocked',
    };
  }

  @ApiResponses(true, [UserRole.USER])
  @Get('block/:userId')
  async blockUser(@Param('userId') userToUnblock: string, @CurrentUser() user: any) {
    const doc = await this.userManagementService.userExist(userToUnblock);
    if (!doc)
      throw new HttpException(`User does not exists`, HttpStatus.BAD_REQUEST);
    if (doc.isDeleted)
      throw new HttpException(
        'User is already Deleted',
        HttpStatus.BAD_REQUEST,
      );

    return {
      success: true,
      message: 'User successfully blocked',
    };
  }

  @ApiResponses(true, [UserRole.USER])
  @Patch('change/password')
  async updatePassword(
    @CurrentUser() user: any,
    @Body() body: UpdatePasswordDto,
  ) {
    const isMatched = await comparePasswords(
      user.password,
      body.currentPassword,
    );
    loggers.info('ismatched..........', isMatched);
    if (!isMatched)
      throw new HttpException('Incorrect credentials', HttpStatus.UNAUTHORIZED);

    user.password = await bcrypt.hash(body.newPassword, 10);
    const newData = await user.save();

    return {
      success: true,
      data: newData,
    };
  }

  @ApiResponses(true, [UserRole.USER])
  @Delete('delete/soft')
  async softDelete(@CurrentUser() currentUser: any) {
    return this.userManagementService.softDelete(currentUser.id);
  }

  @ApiResponses(true, [UserRole.USER])
  @Delete('delete/permanent')
  permanentDelete(@CurrentUser() currentUser: any) {
    return this.userManagementService.remove(currentUser.id);
  }
}
