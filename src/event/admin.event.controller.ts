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
import { EventService } from './event.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ApiResponses } from '../shared/response';
import {
  ApiImageFile,
  UploadType,
} from 'src/decorators/check-mime-type.decorator';
import { Role } from '../schemas/enums/role';
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
  @ApiResponses(true, [Role.ADMIN])
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
  @ApiResponses(true, [Role.VENDOR])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  @Post()
  createEventVendor(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.eventService.createEventVendor(createEventDto, files);
  }


  /**
   * Route: /admin/event/:id
   * Method: PATCH
   * @param id
   * @param updateEventDto
   * @param files
   */
  @ApiResponses(true, [Role.ADMIN])
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
  @ApiResponses(true, [Role.VENDOR])
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
    @UploadedFiles()
    files: {
      files: Array<Express.Multer.File>;
      photos: Array<Express.Multer.File>;
    },
  ) {
    return this.eventService.updateEventVendor(id, updateEventDto, files);
  }

  @ApiResponses(true, [Role.ADMIN])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', {type: UploadType.ARRAY})
  @Post('upload/images')
  addImages(
      @Body() addImagetDto: AddImageDto,
      @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.eventService.addExtraImages(files, addImagetDto);
  }

  @ApiResponses(true, [Role.ADMIN])
  @Get('earning/:id')
  eventEarning(@Param('id') id) {
    return this.eventService.eventEarningService(id);
  }

  @Version('2')
  @ApiResponses(true, [Role.VENDOR])
  @Get('earning/:id')
  eventEarningByVendor(@Param('id') id) {
    return this.eventService.eventEarningService(id);
  }

  @ApiResponses(true, [Role.ADMIN])
  @Delete('images')
  deleteImage(@Body() deleteImagetDto: DeleteImageDto) {
    return this.eventService.deleteEventImages(deleteImagetDto);
  }

  /**
   * Route: /admin/event/:id
   * Method: DELETE
   * @param id
   */
  @ApiResponses(true, [Role.ADMIN])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventService.remove(id);
  }

  @Version('2')
  @ApiResponses(true, [Role.VENDOR])
  @Delete(':id')
  removeByVendor(@Param('id') id: string) {
    return this.eventService.remove(id);
  }

  /**
   * Route: /admin/event/permanent/:id
   * Method: DELETE
   * @param id
   */
  @ApiResponses(true, [Role.ADMIN])
  @Delete('permanent/:id')
  removepermanent(@Param('id') id: string) {
    return this.eventService.removepermanent(id);
  }

  /**
   * Route: /admin/event/table/auto-fill
   * Method: GET
   */
  @ApiResponses(true, [Role.ADMIN])
  @Get('table/auto-fill')
  addData() {
    return this.eventService.dbDataFiller();
  }

  /**
   * Route: /admin/event/table/clear
   * Method: DELETE
   */
  @ApiResponses(true, [Role.ADMIN])
  @Delete('table/clear')
  clearEventCL() {
    return this.eventService.clearEventCL();
  }
}
