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
import { Role } from '../schemas/enums/role';
import { CurrentUser } from 'src/auth/jwt.strategy';
import { UserDocument } from 'src/schemas/user.shema';
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

  @ApiResponses(true, [Role.USER])
  @Patch('update')
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  updateProfile(
    @Body() userProfileUpdateDto: UserProfileUpdateDto,
    @CurrentUser() currentUser: UserDocument,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userManagementService.updateProfile(
      userProfileUpdateDto,
      currentUser._id,
      file,
    );
  }

  @ApiResponses(true, [Role.USER])
  @Patch('update/user-status')
  async updateStatusAndNotification(
    @Body() userStatusAndNotificationDto: UserStatusAndNotificationDto,
    @CurrentUser() currentUser: UserDocument,
  ) {
    if (
      userStatusAndNotificationDto.profileStatus !== undefined ||
      userStatusAndNotificationDto.profileStatus !== null
    )
      currentUser.profileStatus = userStatusAndNotificationDto.profileStatus;
    if (
      userStatusAndNotificationDto.notificationStatus !== undefined ||
      userStatusAndNotificationDto.notificationStatus !== null
    )
      currentUser.notificationStatus =
        userStatusAndNotificationDto.notificationStatus;
    const data = await currentUser.save();
    return {
      success: true,
      data,
    };
  }

  @ApiResponses(true, [Role.USER])
  @Get('/blocked-users')
  async getBlockUserListing(@CurrentUser() user: UserDocument) {
    await user.populate('blockedUsersList', 'name email profileImage ');
    return {
      success: true,
      data: user.blockedUsersList,
    };
  }

  @ApiResponses(true, [Role.USER])
  @Get('unblock/:userId')
  async unblockUser(
    @Param('userId') userToUnblock: string,
    @CurrentUser() user,
  ) {
    loggers.info('block list.......', user.blockedUsersList);
    const doc: UserDocument = await this.userManagementService.userExist(
      userToUnblock,
    );
    if (!doc)
      throw new HttpException(`User does not exists`, HttpStatus.BAD_REQUEST);
    if (doc.isDeleted)
      throw new HttpException(
        'User is already Deleted',
        HttpStatus.BAD_REQUEST,
      );
    user.blockedUsersList.pull(userToUnblock);
    await user.save();
    return {
      success: true,
      message: 'User successfully unblocked',
    };
  }

  @ApiResponses(true, [Role.USER])
  @Get('block/:userId')
  async blockUser(@Param('userId') userToUnblock: string, @CurrentUser() user) {
    loggers.info('block list.......', user.blockedUsersList);
    const doc: UserDocument = await this.userManagementService.userExist(
      userToUnblock,
    );
    if (!doc)
      throw new HttpException(`User does not exists`, HttpStatus.BAD_REQUEST);
    if (doc.isDeleted)
      throw new HttpException(
        'User is already Deleted',
        HttpStatus.BAD_REQUEST,
      );

    if (user.blockedUsersList.includes(userToUnblock))
      throw new HttpException('User already blocked', HttpStatus.OK);
    user.blockedUsersList.push(userToUnblock);
    await user.save();
    return {
      success: true,
      message: 'User successfully blocked',
    };
  }

  @ApiResponses(true, [Role.USER])
  @Patch('change/password')
  async updatePassword(
    @CurrentUser() user: UserDocument,
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

  @ApiResponses(true, [Role.USER])
  @Delete('delete/soft')
  async softDelete(@CurrentUser() currentUser: UserDocument) {
    currentUser.token = null;
    await currentUser.save();
    return currentUser.softDelete();
  }

  @ApiResponses(true, [Role.USER])
  @Delete('delete/permanent')
  permanentDelete(@CurrentUser() currentUser: UserDocument) {
    return this.userManagementService.remove(currentUser._id);
  }
}
