import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFile } from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt.strategy';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiImageFile, UploadType } from 'src/decorators/check-mime-type.decorator';
import { ApiResponses } from 'src/shared/response';
import { CreateMediaDto, MediaQueryDto } from './dto/media.dto';
import { MediaService } from './media.service';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Permissions(Permission.VENDORS_CREATE)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMediaDto,
    @CurrentUser() user: any,
  ) {
    return this.mediaService.upload(file, dto, user?.vendorId);
  }

  @Permissions(Permission.VENDORS_READ)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Get()
  findAll(@Query() query: MediaQueryDto) {
    return this.mediaService.findAll(query);
  }

  @Permissions(Permission.VENDORS_READ)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Permissions(Permission.VENDORS_DELETE)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}
