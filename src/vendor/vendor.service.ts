import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { RetrieveVendorAdminDto } from '@src/vendor/dto/retrieve.vendor.dto';
import { RegisterVendorDto } from '@src/auth/dto/create-auth.dto';

@Injectable()
export class VendorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(createVendorDto: CreateVendorDto, file?: Express.Multer.File) {
    const vendorCheck = await this.prisma.vendor.findFirst({ where: { email: createVendorDto.email } });
    if (vendorCheck) throw new HttpException('Email already in use', HttpStatus.BAD_REQUEST);

    if (file) {
      createVendorDto.profileImage = `${this.configService.get('APP_URL')}/upload/${file.filename}`;
    }
    const vendor = await this.prisma.vendor.create({ data: createVendorDto as any });
    return { success: true, message: 'vendor created successfully!', data: vendor };
  }

  async createVendor(registerVendorDto: RegisterVendorDto, file?: Express.Multer.File) {
    const vendorCheck = await this.prisma.vendor.findFirst({ where: { email: registerVendorDto.email } });
    if (vendorCheck) throw new HttpException('Email already in use', HttpStatus.BAD_REQUEST);

    return this.prisma.vendor.create({
      data: {
        name: (registerVendorDto as any).username,
        email: registerVendorDto.email,
        businessAccount: (registerVendorDto as any).bussiness_name,
      },
    });
  }

  async findAll(filter: RetrieveVendorAdminDto) {
    const page = filter.page || 1;
    const limit = filter.limit || 10;
    const where: any = { isDeleted: false };
    if (filter.search) where.name = { contains: filter.search, mode: 'insensitive' };
    if (filter.isDeleted !== undefined) where.isDeleted = filter.isDeleted;

    const [total, vendors] = await Promise.all([
      this.prisma.vendor.count({ where }),
      this.prisma.vendor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (vendors.length === 0) return { success: false, message: 'There are currently no vendors', data: [] };

    return {
      success: true,
      message: 'Vendors fetched successfully',
      data: vendors,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async ticketListingOfSpecificVendor(vendorId: string, adminId?: any) {
    const tickets = await this.prisma.eventTicket.findMany({
      where: { event: { vendorId, isDeleted: false } },
      include: { event: true, user: { select: { id: true, name: true, email: true } } },
    });

    if (tickets.length === 0) return { success: false, message: 'No tickets found', data: [] };
    return { success: true, message: 'Tickets fetched successfully', data: tickets };
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, isDeleted: false } });
    if (!vendor) return { success: false, message: 'There is no vendor with this id', data: [] };
    return { success: true, message: 'Vendor fetched successfully', data: vendor };
  }

  async getVendor(id: string) {
    return this.prisma.vendor.findFirst({ where: { id, isDeleted: false } });
  }

  async update(id: string, updateVendorDto: UpdateVendorDto) {
    const checkVendor = await this.getVendor(id);
    if (!checkVendor) return { success: false, message: 'No vendor with this id or already deleted', data: [] };

    const updatedVendor = await this.prisma.vendor.update({
      where: { id },
      data: updateVendorDto as any,
    });

    return { success: true, message: 'Vendor updated successfully', data: updatedVendor };
  }

  async remove(id: string) {
    const checkVendor = await this.getVendor(id);
    if (!checkVendor) return { success: false, message: 'No vendor with this id or already deleted', data: [] };

    await this.prisma.vendor.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    return { success: true, message: 'Vendor deleted successfully', data: [] };
  }
}
