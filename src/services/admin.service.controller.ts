import { AllowAny } from "@src/config/auth-guard";
import { Permissions } from "@src/auth/rbac/permissions.decorator";
import { Permission } from "@src/auth/rbac/permissions.enum";
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
  @Permissions(Permission.SERVICES_CREATE)
  @ApiResponses(true)
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
  @Permissions(Permission.SERVICES_CREATE)
  @ApiResponses(true)
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
  @Permissions(Permission.SERVICES_UPDATE)
  @ApiResponses(true)
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
  @Permissions(Permission.SERVICES_UPDATE)
  @ApiResponses(true)
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
  @Permissions(Permission.SERVICES_UPDATE)
  @ApiResponses(true)
  addAndDeleteServiceDetails(
    @Param('serviceid') id: string,
    @Body() updateServiceDetailsDto: UpdateServiceDetailsDto,
  ) {
    return this.servicesService.addAndDeleteServiceDetails(
      id,
      updateServiceDetailsDto,
    );
  }

  @Permissions(Permission.SERVICES_READ)
  @ApiResponses(true)
  @Get('services')
  findAll(@Query() query: RetrieveServiceAdminDto) {
    return this.servicesService.findAll(query);
  }

  @Version('2')
  @Permissions(Permission.SERVICES_READ)
  @ApiResponses(true)
  @Get('services')
  findAllByVendor(@CurrentUser() user,@Query() query: RetrieveServiceAdminDto) {
    return this.servicesService.findAllByVendor(query,user);
  }

  @Permissions(Permission.SERVICES_READ)
  @ApiResponses(true)
  @Get('services/earning/:id')
  serviceEarning(@Param('id') id) {
    return this.servicesService.serviceEarning(id);
  }

  /**
   * Route: /services/
   * Method: GET
   */
  @Permissions(Permission.SERVICES_READ)
  @ApiResponses(false)
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
  @Permissions(Permission.SERVICES_DELETE)
  @ApiResponses(true)
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
  @Permissions(Permission.SERVICES_DELETE)
  @ApiResponses(true)
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }

  /**
   * Route: /services/permanent/:id
   * Method: DELETE
   */
  @Delete('services/permanent/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(Permission.SERVICES_READ)
  @ApiResponses(true)
  removePermanent(@Param('id') id: string) {
    return this.servicesService.removePermanent(id);
  }

  /**
   * Route: /services/table/auto-fill
   * Method: GET
   */
  @Get('services/table/auto-fill')
  @Permissions(Permission.SERVICES_DELETE)
  @ApiResponses(true)
  addData() {
    return this.servicesService.dbDataFiller();
  }

  /**
   * Route: /services/table/clear
   * Method: DELETE
   */
  @Delete('services/table/clear')
  @Permissions(Permission.SERVICES_DELETE)
  @ApiResponses(true)
  clearEventCL() {
    return this.servicesService.clearEventCL();
  }
}
