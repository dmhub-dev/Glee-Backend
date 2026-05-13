import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFiles,
  HttpStatus,
  HttpCode,
  Query,
  HttpException,
  Version,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import {
  UpdateServiceDetailsDto,
  UpdateServiceDto,
  UpdateVendorServiceDto,
} from './dto/update-service.dto';
import { ApiResponses } from '../shared/response';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  ApiImageFile,
  UploadType,
} from 'src/decorators/check-mime-type.decorator';
import { UserRole } from '@prisma/client';
import {
  RetrieveServiceAdminDto,
  RetrieveServiceSingleAdminDto,
} from './dto/retrieve.service.dto';
import fs from 'fs';
import { DeleteImageDto } from './dto/delete-service.dto';
import { CurrentUser } from '@src/auth/jwt.strategy';

@Controller('admin')
@ApiTags('Admin Service Routes')
export class AdminServiceController {
  constructor(private readonly servicesService: ServicesService) {}

  /**
   * Route: /services/
   * Method: POST
   */
  @ApiResponses(true, [UserRole.ADMIN])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  @Post('services')
  create(
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.servicesService.create(createServiceDto, files);
  }

  @Version('2')
  @ApiResponses(true, [UserRole.VENDOR])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  @Post('services')
  createVendorService(
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.servicesService.create(createServiceDto, files);
  }
  /**
   * Route: /services/:id
   * Method: PATCH
   */
  @Patch('services/:id')
  @ApiResponses(true, [UserRole.ADMIN])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  update(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.servicesService.update(id, updateServiceDto, files);
  }

  @Version('2')
  @Patch('services/:id')
  @ApiResponses(true, [UserRole.VENDOR])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  updateVendorService(
    @Param('id') id: string,
    @Body() updateVendorServiceDto: UpdateVendorServiceDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.servicesService.updateVendorService(id, updateVendorServiceDto, files);
  }

  @Patch('service/details/update/:serviceid')
  @ApiResponses(true, [UserRole.ADMIN])
  addAndDeleteServiceDetails(
    @Param('serviceid') id: string,
    @Body() updateServiceDetailsDto: UpdateServiceDetailsDto,
  ) {
    return this.servicesService.addAndDeleteServiceDetails(
      id,
      updateServiceDetailsDto,
    );
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Get('services')
  findAll(@Query() query: RetrieveServiceAdminDto) {
    return this.servicesService.findAll(query);
  }

  @Version('2')
  @ApiResponses(true, [UserRole.VENDOR])
  @Get('services')
  findAllByVendor(@CurrentUser() user,@Query() query: RetrieveServiceAdminDto) {
    return this.servicesService.findAllByVendor(query,user);
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Get('services/earning/:id')
  serviceEarning(@Param('id') id) {
    return this.servicesService.serviceEarning(id);
  }

  /**
   * Route: /services/
   * Method: GET
   */
  @ApiResponses(false, [UserRole.ADMIN])
  @Get('service/:id')
  findOne(
    @Param('id') id: string,
    @Query() retrieveServiceSingleAdminDto: RetrieveServiceSingleAdminDto,
  ) {
    return this.servicesService.findOne(id, retrieveServiceSingleAdminDto);
  }

  /**
   * Route: /services/images
   * Method: DELETE
   */
  @ApiResponses(true, [UserRole.ADMIN])
  @Delete('services/images')
  deleteImage(@Query() deleteImagetDto: DeleteImageDto) {
    return this.servicesService.deleteServiceImages(deleteImagetDto);
  }

  /**
   * Route: /services/:id
   * Method: DELETE
   */
  @Delete('services/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponses(true, [UserRole.ADMIN])
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }

  /**
   * Route: /services/permanent/:id
   * Method: DELETE
   */
  @Delete('services/permanent/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponses(true, [UserRole.ADMIN])
  removePermanent(@Param('id') id: string) {
    return this.servicesService.removePermanent(id);
  }

  /**
   * Route: /services/table/auto-fill
   * Method: GET
   */
  @Get('services/table/auto-fill')
  @ApiResponses(true, [UserRole.ADMIN])
  addData() {
    return this.servicesService.dbDataFiller();
  }

  /**
   * Route: /services/table/clear
   * Method: DELETE
   */
  @Delete('services/table/clear')
  @ApiResponses(true, [UserRole.ADMIN])
  clearEventCL() {
    return this.servicesService.clearEventCL();
  }
}
