import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { S3Service } from '@src/infrastructure/storage/s3.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { FilterLocationDto } from './dto/filter-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async create(dto: CreateLocationDto, actor?: any) {
    const vendorId = this.resolveVendorAccountId(actor, false);
    const location = await this.prisma.location.create({
      data: {
        name: dto.name,
        address: dto.address,
        description: dto.description,
        capacity: dto.capacity,
        isIndoors: dto.isIndoors ?? false,
        isOutdoors: dto.isOutdoors ?? false,
        latitude: dto.latitude,
        longitude: dto.longitude,
        floorPlanImageUrl: dto.floorPlanImageUrl,
        isParkingAvailable: dto.isParkingAvailable ?? false,
        pictures: dto.pictures ?? [],
        venueType: dto.venueType,
        bookingEnabled: dto.bookingEnabled ?? false,
        bookingRules: dto.bookingRules,
        cancellationCutoffHours: dto.cancellationCutoffHours ?? 24,
        timezone: dto.timezone ?? 'Africa/Nairobi',
        vendorId,
      },
    });

    return { success: true, message: 'Location created successfully', data: location };
  }

  async findAll(filters: FilterLocationDto, actor?: any) {
    const {
      search,
      capacity,
      isIndoors,
      isOutdoors,
      isParkingAvailable,
      page = 1,
      limit = 10,
    } = filters;

    const vendorId = this.resolveVendorAccountId(actor, false);
    const where: Prisma.LocationWhereInput = {
      status: EntityStatus.ACTIVE,
      ...(vendorId && { OR: [{ vendorId: null }, { vendorId }] }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(capacity !== undefined && { capacity: { gte: capacity } }),
      ...(isIndoors !== undefined && { isIndoors }),
      ...(isOutdoors !== undefined && { isOutdoors }),
      ...(isParkingAvailable !== undefined && { isParkingAvailable }),
    };

    const [locations, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.location.count({ where }),
    ]);

    if (locations.length === 0) {
      return { success: false, message: 'No locations found', data: [], total: 0, page, limit };
    }

    return { success: true, message: 'Locations fetched successfully', data: locations, total, page, limit };
  }

  async findOne(id: string, actor?: any) {
    const vendorId = this.resolveVendorAccountId(actor, false);
    const location = await this.prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      throw new NotFoundException({ success: false, message: 'No location with this id' });
    }
    this.assertLocationAccess(location, vendorId);

    return { success: true, message: 'Location fetched successfully', data: location };
  }

  async update(id: string, dto: UpdateLocationDto, actor?: any) {
    const existing = await this.prisma.location.findUnique({ where: { id } });
    if (!existing) {
      return {
        success: false,
        message: 'No location with this id or update failed',
        data: [],
      };
    }
    this.assertLocationMutationAccess(existing, actor);
    const updated = await this.prisma.location
      .update({
        where: { id },
        data: dto,
      })
      .catch(() => null);

    if (!updated) {
      return {
        success: false,
        message: 'No location with this id or update failed',
        data: [],
      };
    }

    return { success: true, message: 'Location updated successfully', data: updated };
  }

  async uploadPictures(id: string, files: Express.Multer.File[], actor?: any) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException({ success: false, message: 'No location with this id' });
    this.assertLocationMutationAccess(location, actor);

    const urls = await this.s3.uploadMany(files, 'locations');
    const updated = await this.prisma.location.update({
      where: { id },
      data: { pictures: [...location.pictures, ...urls] },
    });

    return { success: true, message: 'Pictures uploaded successfully', data: updated };
  }

  async remove(id: string, actor?: any) {
    const existing = await this.prisma.location.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, message: 'No location with this id or already deleted', data: [] };
    }
    this.assertLocationMutationAccess(existing, actor);
    const updated = await this.prisma.location
      .update({
        where: { id },
        data: { status: EntityStatus.INACTIVE },
      })
      .catch(() => null);

    if (!updated) {
      return { success: false, message: 'No location with this id or already deleted', data: [] };
    }

    return { success: true, message: 'Location deleted successfully', data: [] };
  }

  private resolveVendorAccountId(actor: any, required = false) {
    if (actor?.role === UserRole.VENDOR) return actor.id;
    if (actor?.role === UserRole.VENDOR_STAFF && actor.vendorAccountId) return actor.vendorAccountId;
    if (required) throw new ForbiddenException('Vendor account scope is required');
    return null;
  }

  private assertLocationAccess(location: { vendorId?: string | null }, vendorId: string | null) {
    if (!vendorId) return;
    if (location.vendorId && location.vendorId !== vendorId) {
      throw new ForbiddenException('You do not have access to this location');
    }
  }

  private assertLocationMutationAccess(location: { vendorId?: string | null }, actor: any) {
    const vendorId = this.resolveVendorAccountId(actor, false);
    if (!vendorId) return;
    if (!location.vendorId || location.vendorId !== vendorId) {
      throw new ForbiddenException('Vendors can only update their own locations');
    }
  }
}
