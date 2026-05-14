import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFiles } from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { AllowAny } from '@src/config/auth-guard';
import { ApiImageFile, UploadType } from 'src/decorators/check-mime-type.decorator';
import { ApiResponses } from 'src/shared/response';
import { ArtistService } from './artist.service';
import { CreateArtistDto, RetrieveArtistDto, UpdateArtistDto } from './dto/artist.dto';

@ApiTags('Artist')
@Controller('artist')
export class ArtistController {
  constructor(private readonly artistService: ArtistService) {}

  @Permissions(Permission.EVENTS_CREATE)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', {
    type: UploadType.MULTIPLE,
    fields: [
      { name: 'profileImage', maxCount: 1 },
      { name: 'images' },
      { name: 'videos' },
    ],
  })
  create(
    @Body() dto: CreateArtistDto,
    @UploadedFiles() files: any,
  ) {
    return this.artistService.create(dto, files);
  }

  @AllowAny()
  @Get()
  findAll(@Query() query: RetrieveArtistDto) {
    return this.artistService.findAll(query);
  }

  @AllowAny()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.artistService.findOne(id);
  }

  @Permissions(Permission.EVENTS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Delete('images')
  deleteMedias(@Body() body: { artistId: string; urls: string[] }) {
    return this.artistService.deleteImages(body.artistId, body.urls);
  }

  @Permissions(Permission.EVENTS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', {
    type: UploadType.MULTIPLE,
    fields: [
      { name: 'profileImage', maxCount: 1 },
      { name: 'images' },
      { name: 'videos' },
    ],
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateArtistDto,
    @UploadedFiles() files: any,
  ) {
    return this.artistService.update(id, dto, files);
  }

  @Permissions(Permission.EVENTS_DELETE)
  @ApiResponses(true, [UserRole.ADMIN, UserRole.VENDOR])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.artistService.remove(id);
  }
}
