import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
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

  @Permissions(Permission.VENDORS_CREATE)
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

  @Permissions(Permission.VENDORS_READ)
  @ApiResponses(true, [UserRole.ADMIN])
  @Get()
  findAll(@Query() query: RetrieveVendorAdminDto) {
    return this.vendorService.findAll(query);
  }

  @Permissions(Permission.VENDORS_READ)
  @ApiResponses(true, [UserRole.ADMIN])
  @Get('ticket-listing/:vendorId')
  ticketListingOfVendor(
    @Param('vendorId') vendor: string,
    @CurrentUser() admin,
  ) {
    return this.vendorService.ticketListingOfSpecificVendor(vendor, admin._id);
  }
  @Version('2')
  @Permissions(Permission.VENDORS_READ)
  @ApiResponses(true, [UserRole.VENDOR])
  @Get('ticket-listing/:vendorId')
  ticketListingOfVendorRole(
    @Param('vendorId') vendor: string,
    @CurrentUser() admin,
  ) {
    return this.vendorService.ticketListingOfSpecificVendor(vendor, admin._id);
  }

  @Permissions(Permission.VENDORS_READ)
  @ApiResponses(true, [UserRole.USER, UserRole.ADMIN])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorService.findOne(id);
  }

  @Permissions(Permission.VENDORS_UPDATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVendorDto: UpdateVendorDto) {
    return this.vendorService.update(id, updateVendorDto);
  }

  @Permissions(Permission.VENDORS_DELETE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vendorService.remove(id);
  }
}
