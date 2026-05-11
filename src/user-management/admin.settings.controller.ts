import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserManagementService } from './user-management.service';
import { ApiResponses } from '../shared/response';
import { Role } from '../schemas/enums/role';
import { UserDto } from './dto/admin-users.dto';
import { CurrentUser } from '../auth/jwt.strategy';
import { UserDocument } from '../schemas/user.shema';
import {
  AddContactInfoDTO,
  UpdateAdminProfileDto,
  UpdateContactInfoDTO,
  UploadImageDto,
} from './dto/settings.dto';
import { ObjectId } from 'bson';
import { getArray } from '@src/shared/utils';
import {
  ApiImageFile,
  UploadType,
} from '@src/decorators/check-mime-type.decorator';
import { loggers } from '@src/interceptors/logger.enums';

@Controller('admin/settings')
@ApiTags('Admin-Settings')
export class AdminSettingsController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get('profile')
  @ApiResponses(true, [Role.ADMIN])
  getProfile(@CurrentUser() admin: UserDocument) {
    return admin.toPublicData();
  }

  @Patch('profile')
  @ApiResponses(true, [Role.ADMIN])
  async updateProfile(
    @Body() payload: UpdateAdminProfileDto,
    @CurrentUser() admin: UserDocument,
  ) {
    if (admin.role !== Role.ADMIN)
      throw new HttpException(
        'You are not authorized to update profile',
        HttpStatus.BAD_REQUEST,
      );
    if (typeof payload === 'object') {
      Object.keys(payload).map((k) => (admin[k] = payload[k]));
    }
    let data = await admin.save();
    return {
      success: true,
      data: data.toPublicData(),
    };
  }

  @Post('contact/info')
  @ApiResponses(true, [Role.ADMIN])
  async createContactInfo(
    @CurrentUser() admin: UserDocument,
    @Body() info: AddContactInfoDTO,
  ) {
    const dataToPush = {
      ...info,
      _id: new ObjectId(),
    };
    const data = await admin.update(
      {
        $push: {
          adminContactInfo: dataToPush,
        },
      },
      { new: true },
    );
    return {
      success: true,
      data,
    };
  }

  @Patch('contact/info/:id')
  @ApiResponses(true, [Role.ADMIN])
  async updateContactInfo(
    @CurrentUser() admin: UserDocument,
    @Body() info: UpdateContactInfoDTO,
    @Param('id') _id: string,
  ) {
    return this.userManagementService.updateContactInfo(admin, _id, info);
  }

  @Delete('contact/info/:id')
  @ApiResponses(true, [Role.ADMIN])
  async deleteContactInfo(
    @CurrentUser() admin: UserDocument,
    @Param('id') _id: string,
  ) {
    if (!admin.adminContactInfo)
      return {
        success: false,
        message: 'No Contact Info found.',
      };

    loggers.info('_id           . ', _id);
    return this.userManagementService.deleteContactInfo(admin, _id);
  }

  @Get('contact/info')
  @ApiResponses(true, [Role.ADMIN])
  async getContactInfo(@CurrentUser() admin: UserDocument) {
    loggers.info('admin contact info %O', admin);
    if (!admin.adminContactInfo)
      return {
        success: false,
        message: 'No Contact Info found.',
      };

    return {
      success: true,
      data: admin?.adminContactInfo || [],
    };
  }

  @Get('contact/info/:id')
  @ApiResponses(true, [Role.ADMIN])
  async getOneContactInfo(
    @CurrentUser() admin: UserDocument,
    @Param('_id') _id,
  ) {
    if (!admin.adminContactInfo)
      return {
        success: false,
        message: 'No Contact Info found.',
      };

    const data =
      getArray(admin.adminContactInfo).filter((v) => v._id === _id)[0] || {};

    return {
      success: true,
      data: data || {},
    };
  }

  @Post('upload')
  @ApiResponses(true, [Role.ADMIN])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  async uploadImage(
    @CurrentUser() admin: UserDocument,
    @UploadedFile('file') file,
    @Body() data: UploadImageDto,
  ) {
    return this.userManagementService.uploadImage(file);
  }
}
