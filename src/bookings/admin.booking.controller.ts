import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
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
  Version,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  CreateBookingDto,
  CreateBookingTableDto,
  CreateVendorBookingDto,
  TablesDto,
} from './dto/create-booking.dto';
import {
  UpdateBookingDto,
  UpdateBookingTableDto,
  VendorUpdateBookingDto,
} from './dto/update-booking.dto';
import { ApiResponses } from '../shared/response';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  ApiImageFile,
  UploadType,
} from 'src/decorators/check-mime-type.decorator';
import { UserRole } from '@prisma/client';
import {
  RetrieveBookingAdminDto,
  RetrieveBookingSingleAdminDto,
} from './dto/retrieve-bookings.dto';
import { DeleteImageDto } from './dto/delete-images-bookings.dto';
import { CurrentUser } from '@src/auth/jwt.strategy';
//   import {
//     RetrieveServiceAdminDto,
//     RetrieveServiceSingleAdminDto,
//   } from './dto/retrieve.service.dto';

@Controller('admin')
@ApiTags('Bookings Admin Routes')
export class AdminBookingController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * Route: /services/
   * Method: POST
   */
  @Permissions(Permission.BOOKINGS_CREATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  @Post('bookings')
  create(
    @Body() createBookingDto: CreateBookingDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.bookingsService.create(createBookingDto, files);
  }
  /**
  vendor booking
   */
  @Version('2')
  @Permissions(Permission.BOOKINGS_CREATE)
  @ApiResponses(true, [UserRole.VENDOR])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  @Post('bookings')
  createVendorBooking(
    @Body() createVendorBookingDto: CreateVendorBookingDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    
    return this.bookingsService.createVendorBooking(createVendorBookingDto, files);
  }


  @Post('bookings/tables')
  @Permissions(Permission.BOOKINGS_CREATE)
  @ApiResponses(true, [UserRole.ADMIN])
  createTables(@Body() body: CreateBookingTableDto) {
    return this.bookingsService.createTables(body);
  }

  @Patch('bookings/tables/:id')
  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN])
  updateTable(
    @Param('id') id: string,
    @Body() updateBookingTableDto: UpdateBookingTableDto,
  ) {
    return this.bookingsService.updateTables(id, updateBookingTableDto);
  }

  @Delete('bookings/tables/:id')
  @Permissions(Permission.BOOKINGS_DELETE)
  @ApiResponses(true, [UserRole.ADMIN])
  deleteTable(@Param('id') id: string) {
    return this.bookingsService.deleteBookingTable(id);
  }

  /**
   * Route: /services/:id
   * Method: PATCH
   */
  @Patch('bookings/:id')
  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  update(
    @Param('id') id: string,
    @Body() updatebookingDto: UpdateBookingDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.bookingsService.update(id, updatebookingDto, files);
  }

  // vendor patch
  @Version('2')
  @Patch('bookings/:id')
  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.VENDOR])
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('files', { type: UploadType.ARRAY })
  updateVendorBookingById(
    @Param('id') id: string,
    @Body() vendorUpdateBookingDto: VendorUpdateBookingDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.bookingsService.vendorUpdateBookingDto(id, vendorUpdateBookingDto, files);
  }

  // @Patch('booking/details/update/:bookingId')
  // @ApiResponses(true, [UserRole.ADMIN])
  // addAndDeleteBookingDetails(
  //   @Param('serviceid') id: string,
  //   @Body() updateServiceDetailsDto: UpdateServiceDetailsDto,
  // ) {
  //   return this.bookingsService.addAndDeleteServiceDetails(
  //     id,
  //     updateServiceDetailsDto,
  //   );
  // }

  @Permissions(Permission.BOOKINGS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Delete('booking/images')
  deleteImage(@Query() deleteImagetDto: DeleteImageDto) {
    return this.bookingsService.deleteBookingImages(deleteImagetDto);
  }

  @Permissions(Permission.BOOKINGS_READ)
  @ApiResponses(true, [UserRole.ADMIN])
  @Get('bookings')
  findAll(@Query() query: RetrieveBookingAdminDto) {
    return this.bookingsService.findAll(query);
  }
  /**
   * Route: /booking get by vendor
   * Method: GET
   * @param query
   */
  @Version('2')
  @Permissions(Permission.BOOKINGS_READ)
  @ApiResponses(true, [UserRole.VENDOR])
  @Get('bookings')
  findAllByVendorId(@CurrentUser() user,@Query() query: RetrieveBookingAdminDto) {
    return this.bookingsService.findAllByVendorId(query,user);
  }

  // /**
  //  * Route: /services/
  //  * Method: GET
  //  */
  @Permissions(Permission.BOOKINGS_READ)
  @ApiResponses(false, [UserRole.ADMIN])
  @Get('booking/:id')
  findOne(
    @Param('id') id: string,
    @Query() retrieveBookingSingleAdminDto: RetrieveBookingSingleAdminDto,
  ) {
    return this.bookingsService.findOne(id, retrieveBookingSingleAdminDto);
  }

  @Permissions(Permission.BOOKINGS_READ)
  @ApiResponses(true, [UserRole.ADMIN])
  @Get('booking/earning/:id')
  bookingEarniing(@Param('id') id) {
    return this.bookingsService.bookingEarningService(id);
  }

  @Version('2')
  @Permissions(Permission.BOOKINGS_READ)
  @ApiResponses(false, [UserRole.VENDOR])
  @Get('booking/:id')
  findOneVendorModule(
    @Param('id') id: string,
    @Query() retrieveBookingSingleAdminDto: RetrieveBookingSingleAdminDto,
  ) {
    return this.bookingsService.findOne(id, retrieveBookingSingleAdminDto);
  }

  @Version('2')
  @Permissions(Permission.BOOKINGS_READ)
  @ApiResponses(true, [UserRole.VENDOR])
  @Get('booking/earning/:id')
  bookingEarniingVendorModule(@Param('id') id:string) {
    return this.bookingsService.bookingEarningService(id);
  }
  

  // /**
  //  * Route: /services/:id
  //  * Method: DELETE
  //  */
  @Delete('booking/:id')
  @Permissions(Permission.BOOKINGS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponses(true, [UserRole.ADMIN])
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }

  // /**
  //  * Route: /services/permanent/:id
  //  * Method: DELETE
  //  */
  @Delete('bookings/permanent/:id')
  @Permissions(Permission.BOOKINGS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponses(true, [UserRole.ADMIN])
  removePermanent(@Param('id') id: string) {
    return this.bookingsService.removePermanent(id);
  }

  // vendor
  @Version('2')
  @Delete('bookings/permanent/:id')
  @Permissions(Permission.BOOKINGS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponses(true, [UserRole.VENDOR])
  removePermanentVendor(@Param('id') id: string) {
    return this.bookingsService.removePermanentVendor(id);
  }

  /**
   * Route: /services/table/auto-fill
   * Method: GET
   */
  // @Get('bookings/table/auto-fill')
  // @ApiResponses(true, [UserRole.ADMIN])
  // addData() {
  //   return this.bookingsService.dbDataFiller();
  // }

  /**
   * Route: /services/table/clear
   * Method: DELETE
   */
  // @Delete('bookings/table/clear')
  // @ApiResponses(true, [UserRole.ADMIN])
  // clearEventCL() {
  //   return this.servicesService.clearEventCL();
  // }
}
