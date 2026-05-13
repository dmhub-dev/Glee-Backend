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
import { UserRole } from '@prisma/client';
import { UserDto } from './dto/admin-users.dto';
import { CurrentUser } from '../auth/jwt.strategy';
import {
  AddContactInfoDTO,
  UpdateAdminProfileDto,
  UpdateContactInfoDTO,
  UploadImageDto,
} from './dto/settings.dto';
import {
  ApiImageFile,
  UploadType,
} from '@src/decorators/check-mime-type.decorator';

@Controller('admin/settings')
@ApiTags('Admin-Settings')
export class AdminSettingsController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get('profile')
  @ApiResponses(true, [UserRole.ADMIN])
  getProfile(@CurrentUser() admin: any) {
    return admin;
  }

  @Patch('profile')
  @ApiResponses(true, [UserRole.ADMIN])
  async updateProfile(
    @Body() payload: UpdateAdminProfileDto,
    @CurrentUser() admin: any,
  ) {
    if (admin.role !== UserRole.ADMIN)
      throw new HttpException(
        'You are not authorized to update profile',
        HttpStatus.BAD_REQUEST,
      );
    return this.userManagementService.updateProfile(payload as any, admin.id);
  }

  @Post('contact/info')
  @ApiResponses(true, [UserRole.ADMIN])
  async createContactInfo(
    @CurrentUser() admin: any,
    @Body() info: AddContactInfoDTO,
  ) {
    return this.userManagementService.updateContactInfo(admin, '', info);
  }

  @Patch('contact/info/:id')
  @ApiResponses(true, [UserRole.ADMIN])
  async updateContactInfo(
    @CurrentUser() admin: any,
    @Body() info: UpdateContactInfoDTO,
    @Param('id') _id: string,
  ) {
    return this.userManagementService.updateContactInfo(admin, _id, info);
  }

  @Delete('contact/info/:id')
  @ApiResponses(true, [UserRole.ADMIN])
  async deleteContactInfo(
    @CurrentUser() admin: any,
    @Param('id') _id: string,
  ) {
    if (!admin.adminContactInfo)
      return {
        success: false,
        message: 'No Contact Info found.',
      };
    return this.userManagementService.deleteContactInfo(admin, _id);
  }

  @Get('contact/info')
  @ApiResponses(true, [UserRole.ADMIN])
  async getContactInfo(@CurrentUser() admin: any) {
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
  @ApiResponses(true, [UserRole.ADMIN])
  async getOneContactInfo(
    @CurrentUser() admin: any,
    @Param('id') _id,
  ) {
    if (!admin.adminContactInfo)
      return {
        success: false,
        message: 'No Contact Info found.',
      };

    const data = (admin.adminContactInfo || []).filter((v) => v._id === _id)[0] || {};

    return {
      success: true,
      data: data || {},
    };
  }

  @Post('upload')
  @ApiResponses(true, [UserRole.ADMIN])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  async uploadImage(
    @CurrentUser() admin: any,
    @UploadedFile('file') file,
    @Body() data: UploadImageDto,
  ) {
    return this.userManagementService.uploadImage(file);
  }
}
