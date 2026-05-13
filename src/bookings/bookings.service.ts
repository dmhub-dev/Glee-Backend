import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@src/prisma/prisma.service';
import { deleteImages } from 'src/shared/utils';
import { BookingSharedService } from '@src/bookings/shared/shared.bookings.service';
import { CreateBookingDto, CreateBookingTableDto, CreateVendorBookingDto } from './dto/create-booking.dto';
import { DeleteImageDto } from './dto/delete-images-bookings.dto';
import { RetrieveBookingAdminDto } from './dto/retrieve-bookings.dto';
import { UpdateBookingDto, UpdateBookingTableDto, VendorUpdateBookingDto } from './dto/update-booking.dto';

const BOOKING_INCLUDE = { vendor: true, category: true, tables: true };

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly bookingSharedService: BookingSharedService,
  ) {}

  private buildPhotoUrls(files: Express.Multer.File[]): string[] {
    return (files ?? []).map(f => `${this.config.get('APP_URL')}/upload/${f.filename}`);
  }

  async create(createBookingDto: CreateBookingDto, files?: Array<Express.Multer.File>) {
    const photos = this.buildPhotoUrls(files);
    const dto = createBookingDto as any;
    const booking = await this.prisma.booking.create({
      data: {
        name: dto.name,
        vendorId: dto.vendor,
        categoryId: dto.category,
        address: dto.address,
        description: dto.description,
        price: dto.price,
        capacity: dto.capacity ? +dto.capacity : null,
        startTime: dto.startTime,
        endTime: dto.endTime,
        latitude: dto.latitude ? +dto.latitude : null,
        longitude: dto.longitude ? +dto.longitude : null,
        photos: photos.length ? photos : [],
        bookingDetails: dto.bookingDetails ?? null,
      },
    });
    return { success: true, message: 'booking created successfuly!', data: booking };
  }

  async createVendorBooking(createVendorBookingDto: CreateVendorBookingDto, files?: Array<Express.Multer.File>) {
    const photos = this.buildPhotoUrls(files);
    const dto = createVendorBookingDto as any;
    const booking = await this.prisma.booking.create({
      data: {
        name: dto.name,
        vendorId: dto.vendor,
        categoryId: dto.category,
        address: dto.address,
        description: dto.description,
        price: dto.price,
        capacity: dto.capacity ? +dto.capacity : null,
        startTime: dto.startTime,
        endTime: dto.endTime,
        latitude: dto.latitude ? +dto.latitude : null,
        longitude: dto.longitude ? +dto.longitude : null,
        photos: photos.length ? photos : [],
        bookingDetails: dto.bookingDetails ?? null,
      },
    });

    if (dto.vendorTables?.length > 0) {
      await this.prisma.bookingTable.createMany({
        data: dto.vendorTables.map((t: any) => ({ ...t, bookingId: booking.id })),
      });
    }

    return { success: true, message: 'booking created successfuly!', data: booking };
  }

  async createTables(body: CreateBookingTableDto) {
    const tables = await this.prisma.bookingTable.createMany({
      data: (body.tables as any[]).map(t => ({ ...t })),
    });
    return { success: true, message: 'table created successfuly!', data: tables };
  }

  async updateTables(id: string, updateBookingTableDto: UpdateBookingTableDto) {
    const table = await this.prisma.bookingTable.update({
      where: { id },
      data: updateBookingTableDto as any,
    });
    return { success: true, message: 'table data updated successfuly!', data: table };
  }

  async deleteBookingTable(id: string) {
    const table = await this.prisma.bookingTable.update({
      where: { id },
      data: { status: 'deleted' },
    });
    return { success: true, message: 'table data updated successfuly!', data: table };
  }

  async findAll({ page, limit, search }: RetrieveBookingAdminDto, isAdmin?: boolean) {
    const where: any = { isDeleted: false };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, docCount] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { success: true, data, page, limit, totalPages: Math.ceil(docCount / limit) };
  }

  async findAllByVendorId({ page, limit, search }: RetrieveBookingAdminDto, user: any) {
    const where: any = { isDeleted: false, vendorId: user.vendor_id ?? user.vendorId };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, docCount] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { success: true, data, page, limit, totalPages: Math.ceil(docCount / limit) };
  }

  async findOne(id: string, _query?: any) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, isDeleted: false },
      include: BOOKING_INCLUDE,
    });
    if (!booking) {
      return { success: false, message: 'There is no booking exists with this id', data: {} };
    }
    return { success: true, data: { booking, tableData: booking.tables } };
  }

  async bookingEarningService(id: string) {
    const result = await this.bookingSharedService.calculateBookingsEarning(id);
    if (!Array.isArray(result) || result.length === 0) {
      return { success: true, adminEarning: 0, vendorEarning: 0 };
    }
    return { success: true, data: result[0] };
  }

  async getTables(id: string) {
    const tables = await this.prisma.bookingTable.findMany({
      where: { bookingId: id, status: { not: 'booked' } },
    });
    return { success: true, data: tables };
  }

  async update(id: string, updateBookingDto: UpdateBookingDto, files?: Array<Express.Multer.File>) {
    const booking = await this.prisma.booking.findFirst({ where: { id, isDeleted: false } });
    if (!booking) {
      return { success: false, message: 'There is no booking with this id', data: {} };
    }

    const data: any = {};
    ['name', 'description', 'price', 'address', 'status', 'startTime', 'endTime', 'capacity'].forEach(k => {
      if ((updateBookingDto as any)[k] !== undefined) data[k] = (updateBookingDto as any)[k];
    });
    if ((updateBookingDto as any).latitude) data.latitude = +(updateBookingDto as any).latitude;
    if ((updateBookingDto as any).longitude) data.longitude = +(updateBookingDto as any).longitude;

    const newPhotos = this.buildPhotoUrls(files ?? []);
    if (newPhotos.length) data.photos = [...(booking.photos ?? []), ...newPhotos];

    const updatedBooking = await this.prisma.booking.update({ where: { id }, data });
    return { success: true, message: 'boooking updated successfully', data: updatedBooking };
  }

  async vendorUpdateBookingDto(id: string, vendorUpdateBookingDto: VendorUpdateBookingDto, files?: Array<Express.Multer.File>) {
    const updated = await this.update(id, vendorUpdateBookingDto as any, files);

    const dto = vendorUpdateBookingDto as any;
    if (dto.vendorTables?.length > 0) {
      await this.prisma.bookingTable.deleteMany({ where: { bookingId: id, status: { not: 'booked' } } });
      await this.prisma.bookingTable.createMany({
        data: dto.vendorTables.map((t: any) => ({ ...t, bookingId: id })),
      });
    }

    return updated;
  }

  async getBooking(id: string, filterDeleted: boolean) {
    const where: any = { id };
    if (filterDeleted) where.isDeleted = false;
    return this.prisma.booking.findFirst({ where });
  }

  async deleteBookingImages(deleteImagetDto: DeleteImageDto) {
    await deleteImages(deleteImagetDto.imageUrls);
    const booking = await this.prisma.booking.findUnique({ where: { id: deleteImagetDto.bookingId } });
    if (!booking) {
      throw new HttpException({ success: false, message: 'booking does not exists' }, HttpStatus.FORBIDDEN);
    }
    const updatedBooking = await this.prisma.booking.update({
      where: { id: deleteImagetDto.bookingId },
      data: { photos: booking.photos.filter(p => !deleteImagetDto.imageUrls.includes(p)) },
    });
    return { success: true, message: 'Provided Images urls are deleted successfully..', data: updatedBooking };
  }

  async remove(id: string) {
    const booking = await this.getBooking(id, true);
    if (!booking) throw new HttpException('There is no booking with this id or already deleted', HttpStatus.NOT_FOUND);
    await this.prisma.booking.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
  }

  async removePermanent(id: string) {
    const booking = await this.getBooking(id, false);
    if (!booking) throw new HttpException('There is no booking with this id or already deleted', HttpStatus.NOT_FOUND);
    if (booking.photos.length > 0) await deleteImages(booking.photos);
    await this.prisma.booking.delete({ where: { id } });
  }

  async removePermanentVendor(id: string) {
    const booking = await this.getBooking(id, false);
    if (!booking) throw new HttpException('There is no booking with this id or already deleted', HttpStatus.NOT_FOUND);
    await this.prisma.bookingTable.deleteMany({ where: { bookingId: id } });
    if (booking.photos.length > 0) await deleteImages(booking.photos);
    await this.prisma.booking.delete({ where: { id } });
  }
}
