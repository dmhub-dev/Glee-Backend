import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  Version
} from '@nestjs/common';
import { VendorService } from './vendor.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ApiResponses } from 'src/shared/response';
import {
  ApiImageFile,
  UploadType,
} from 'src/decorators/check-mime-type.decorator';
import { RetrieveVendorAdminDto } from '@src/vendor/dto/retrieve.vendor.dto';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt.strategy';

@ApiTags('Vendor-Apis')
@Controller('vendor')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @ApiResponses(true, [UserRole.ADMIN])
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiImageFile('file', { type: UploadType.SINGLE })
  create(
    @Body() createVendorDto: CreateVendorDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.vendorService.create(createVendorDto, file);
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Get()
  findAll(@Query() query: RetrieveVendorAdminDto) {
    return this.vendorService.findAll(query);
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Get('ticket-listing/:vendorId')
  ticketListingOfVendor(
    @Param('vendorId') vendor: string,
    @CurrentUser() admin,
  ) {
    return this.vendorService.ticketListingOfSpecificVendor(vendor, admin._id);
  }
  @Version('2')
  @ApiResponses(true, [UserRole.VENDOR])
  @Get('ticket-listing/:vendorId')
  ticketListingOfVendorRole(
    @Param('vendorId') vendor: string,
    @CurrentUser() admin,
  ) {
    return this.vendorService.ticketListingOfSpecificVendor(vendor, admin._id);
  }

  @ApiResponses(true, [UserRole.USER, UserRole.ADMIN])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorService.findOne(id);
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVendorDto: UpdateVendorDto) {
    return this.vendorService.update(id, updateVendorDto);
  }

  @ApiResponses(true, [UserRole.ADMIN])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vendorService.remove(id);
  }
}
