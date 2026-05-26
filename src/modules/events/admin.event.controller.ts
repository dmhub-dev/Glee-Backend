import { Permissions } from "@src/auth/rbac/permissions.decorator";
import { Permission } from "@src/auth/rbac/permissions.enum";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  Version,
} from '@nestjs/common';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ApiResponses } from '@src/common/responses/response';
import {
  ApiImageFile,
  UploadType,
} from '@src/common/decorators/check-mime-type.decorator';
import { UserRole } from '@prisma/client';
import { AddImageDto, DeleteImageDto } from './dto/add-image.dto';

@Controller('admin/event')
@ApiTags('Admin Event Routes')
export class AdminEventController {
  constructor(private readonly eventService: EventService) {}

  /**
   * Rout: /admin/event
   * Method: POST
   * @param files
   * @param createEventDto
   */
  @Permissions(Permission.EVENTS_CREATE)
  @ApiResponses(true)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  @Post()
  create(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.eventService.create(createEventDto, files);
  }

  @Version('2')
  @Permissions(Permission.EVENTS_CREATE)
  @ApiResponses(true)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  @Post()
  createEventVendor(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user: any,
  ) {
    return this.eventService.createEventVendor(createEventDto, files, user);
  }


  /**
   * Route: /admin/event/:id
   * Method: PATCH
   * @param id
   * @param updateEventDto
   * @param files
   */
  @Permissions(Permission.EVENTS_UPDATE)
  @ApiResponses(true)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile(null, {
    type: UploadType.MULTIPLE,
    fields: [
      {
        name: 'files',
        maxCount: 10,
      },
      {
        name: 'photos',
        maxCount: 10,
      },
    ],
  })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @UploadedFiles()
    files: {
      files: Array<Express.Multer.File>;
      photos: Array<Express.Multer.File>;
    },
  ) {
    return this.eventService.update(id, updateEventDto, files);
  }

  @Version('2')
  @Permissions(Permission.EVENTS_UPDATE)
  @ApiResponses(true)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile(null, {
    type: UploadType.MULTIPLE,
    fields: [
      {
        name: 'files',
        maxCount: 10,
      },
      {
        name: 'photos',
        maxCount: 10,
      },
    ],
  })
  @Patch(':id')
  updateEventVendor(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user: any,
    @UploadedFiles()
    files: {
      files: Array<Express.Multer.File>;
      photos: Array<Express.Multer.File>;
    },
  ) {
    return this.eventService.updateEventForVendor(id, updateEventDto, files, user);
  }

  @Permissions(Permission.EVENTS_UPDATE)
  @ApiResponses(true)
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', {type: UploadType.ARRAY})
  @Post('upload/images')
  addImages(
      @Body() addImagetDto: AddImageDto,
      @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.eventService.addExtraImages(files, addImagetDto);
  }

  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true)
  @Get('earning/:id')
  eventEarning(@Param('id') id) {
    return this.eventService.eventEarningService(id);
  }

  @Version('2')
  @Permissions(Permission.EVENTS_READ)
  @ApiResponses(true)
  @Get('earning/:id')
  eventEarningByVendor(@Param('id') id, @CurrentUser() user: any) {
    if (user.role === UserRole.VENDOR || user.role === UserRole.VENDOR_STAFF) {
      return this.eventService.eventEarningForVendor(id, user);
    }
    return this.eventService.eventEarningService(id);
  }

  @Permissions(Permission.EVENTS_UPDATE)
  @ApiResponses(true)
  @Delete('images')
  deleteImage(@Body() deleteImagetDto: DeleteImageDto) {
    return this.eventService.deleteEventImages(deleteImagetDto);
  }

  /**
   * Route: /admin/event/:id
   * Method: DELETE
   * @param id
   */
  @Permissions(Permission.EVENTS_DELETE)
  @ApiResponses(true)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }

  @Version('2')
  @Permissions(Permission.EVENTS_DELETE)
  @ApiResponses(true)
  @Delete(':id')
  removeByVendor(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventService.removeForVendor(id, user);
  }

  /**
   * Route: /admin/event/permanent/:id
   * Method: DELETE
   * @param id
   */
  @Permissions(Permission.EVENTS_DELETE)
  @ApiResponses(true)
  @Delete('permanent/:id')
  removepermanent(@Param('id') id: string) {
    return this.eventService.removepermanent(id);
  }

  /**
   * Route: /admin/event/table/auto-fill
   * Method: GET
   */
  @Permissions(Permission.EVENTS_CREATE)
  @ApiResponses(true)
  @Get('table/auto-fill')
  addData() {
    return this.eventService.dbDataFiller();
  }

  /**
   * Route: /admin/event/table/clear
   * Method: DELETE
   */
  @Permissions(Permission.EVENTS_DELETE)
  @ApiResponses(true)
  @Delete('table/clear')
  clearEventCL() {
    return this.eventService.clearEventCL();
  }
}
