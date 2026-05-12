import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityStatus } from '@prisma/client';
import { PrismaService } from '@src/prisma/prisma.service';
import { deleteImages } from 'src/shared/utils';
import { ServiceSharedService } from './Shared/shared.services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { DeleteImageDto } from './dto/delete-service.dto';
import { RetrieveServiceAdminDto } from './dto/retrieve.service.dto';
import { UpdateServiceDetailsDto, UpdateServiceDto, UpdateVendorServiceDto } from './dto/update-service.dto';

const SERVICE_INCLUDE = { vendor: true, category: true };

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sharedService: ServiceSharedService,
  ) {}

  private buildPhotoUrls(files: Express.Multer.File[]): string[] {
    return (files ?? []).map(f => `${this.config.get('APP_URL')}/upload/${f.filename}`);
  }

  async create(createServiceDto: CreateServiceDto, files?: Array<Express.Multer.File>) {
    const photos = this.buildPhotoUrls(files);
    const service = await this.prisma.service.create({
      data: {
        name: createServiceDto.name,
        vendorId: (createServiceDto as any).vendor,
        categoryId: (createServiceDto as any).category,
        description: (createServiceDto as any).description,
        price: createServiceDto.price,
        address: (createServiceDto as any).address,
        latitude: createServiceDto.latitude ? +createServiceDto.latitude : null,
        longitude: createServiceDto.longitude ? +createServiceDto.longitude : null,
        photos: photos.length ? photos : [],
        serviceDetails: (createServiceDto as any).serviceDetails ?? null,
      },
    });
    return { success: true, message: 'service created successfuly!', data: service };
  }

  async findAll({ page, limit, search }: RetrieveServiceAdminDto, user?: any) {
    const where: any = { isDeleted: false };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, docCount] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: SERVICE_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      success: true,
      data,
      page,
      limit,
      totalPages: Math.ceil(docCount / limit),
      haveNewNotification: user?.haveNewNotification,
    };
  }

  async findAllByVendor({ page, limit, search }: RetrieveServiceAdminDto, user?: any) {
    const where: any = { isDeleted: false, vendorId: user?.vendor_id ?? user?.vendorId };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, docCount] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: SERVICE_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.service.count({ where }),
    ]);

    return {
      success: true,
      data,
      page,
      limit,
      totalPages: Math.ceil(docCount / limit),
      haveNewNotification: user?.haveNewNotification,
    };
  }

  async findOne(id: string, query?: any) {
    const service = await this.prisma.service.findFirst({
      where: { id, isDeleted: false },
      include: SERVICE_INCLUDE,
    });
    if (!service) {
      return { success: false, message: 'There is no service exists with this id', data: {} };
    }
    return { success: true, data: service };
  }

  async update(id: string, updateServiceDto: UpdateServiceDto, files: any) {
    const service = await this.prisma.service.findFirst({ where: { id, isDeleted: false } });
    if (!service) {
      return { success: false, message: 'There is no service with this id', data: {} };
    }

    const data: any = {};
    ['name', 'description', 'price', 'address', 'status'].forEach(k => {
      if ((updateServiceDto as any)[k] !== undefined) data[k] = (updateServiceDto as any)[k];
    });
    if (updateServiceDto.latitude) data.latitude = +updateServiceDto.latitude;
    if (updateServiceDto.longitude) data.longitude = +updateServiceDto.longitude;

    const newPhotos = this.buildPhotoUrls(files ?? []);
    if (newPhotos.length) data.photos = [...(service.photos ?? []), ...newPhotos];

    const updatedService = await this.prisma.service.update({ where: { id }, data });
    return { success: true, message: 'Service updated successfully', data: updatedService };
  }

  async updateVendorService(id: string, updateVendorServiceDto: UpdateVendorServiceDto, files: any) {
    return this.update(id, updateVendorServiceDto as any, files);
  }

  async addAndDeleteServiceDetails(id: string, updateServiceDetailsDto: UpdateServiceDetailsDto) {
    if (!updateServiceDetailsDto.addItems && !updateServiceDetailsDto.deleteItems) {
      throw new HttpException('Both the array should not be empty at single call', HttpStatus.BAD_REQUEST);
    }
    const service = await this.prisma.service.findFirst({ where: { id, isDeleted: false } });
    if (!service) {
      throw new HttpException('There is no service with this id', HttpStatus.NOT_FOUND);
    }

    let details: any[] = Array.isArray(service.serviceDetails) ? (service.serviceDetails as any[]) : [];

    if (updateServiceDetailsDto.deleteItems) {
      details = details.filter(d => !updateServiceDetailsDto.deleteItems.includes(d));
    }
    if (updateServiceDetailsDto.addItems) {
      details = [...details, ...updateServiceDetailsDto.addItems];
    }

    const updatedService = await this.prisma.service.update({ where: { id }, data: { serviceDetails: details } });
    return { success: true, msg: 'Service details is updated', data: updatedService };
  }

  async serviceEarning(id: string) {
    const result = await this.sharedService.calculateServiceEarning(id);
    if (!Array.isArray(result) || result.length === 0) {
      return { success: true, adminEarning: 0, vendorEarning: 0 };
    }
    return { success: true, data: result[0] };
  }

  async deleteServiceImages(deleteImagetDto: DeleteImageDto) {
    await deleteImages(deleteImagetDto.imageUrls);
    const service = await this.prisma.service.findUnique({ where: { id: deleteImagetDto.serviceId } });
    if (!service) {
      throw new HttpException({ success: false, message: 'Service does not exists' }, HttpStatus.FORBIDDEN);
    }
    const updatedService = await this.prisma.service.update({
      where: { id: deleteImagetDto.serviceId },
      data: { photos: service.photos.filter(p => !deleteImagetDto.imageUrls.includes(p)) },
    });
    return { success: true, message: 'Provided Images urls are deleted successfully..', data: updatedService };
  }

  async remove(id: string) {
    const service = await this.prisma.service.findFirst({ where: { id, isDeleted: false } });
    if (!service) throw new HttpException('There is no service with this id or already deleted', HttpStatus.NOT_FOUND);
    await this.prisma.service.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
  }

  async getService(id: string, filterDeleted: boolean) {
    const where: any = { id };
    if (filterDeleted) where.isDeleted = false;
    return this.prisma.service.findFirst({ where });
  }

  async removePermanent(id: string) {
    const service = await this.getService(id, false);
    if (!service) throw new HttpException('There is no service with this id or already deleted', HttpStatus.NOT_FOUND);
    if (service.photos.length > 0) await deleteImages(service.photos);
    await this.prisma.service.delete({ where: { id } });
  }

  async nearByServices(lat: number, lng: number, radiusKm = 15, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const now = new Date();
    return this.prisma.$queryRaw<any[]>`
      SELECT *,
        (6371 * acos(
          cos(radians(${+lat})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${+lng})) +
          sin(radians(${+lat})) * sin(radians(latitude))
        )) AS distance_km
      FROM "Service"
      WHERE "isDeleted" = false
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND status = 'ACTIVE'
      ORDER BY distance_km
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async dbDataFiller() {
    return { success: false, message: 'Seeder not available in Prisma mode' };
  }

  async clearEventCL() {
    await this.prisma.service.deleteMany({});
    return { success: true };
  }
}
