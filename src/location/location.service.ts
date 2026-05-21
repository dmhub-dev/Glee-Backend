import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@src/prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { FilterLocationDto } from './dto/filter-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    const { mediaIds, ...fields } = dto;

    const location = await this.prisma.location.create({
      data: {
        name: fields.name,
        address: fields.address,
        capacity: fields.capacity,
        isIndoors: fields.isIndoors ?? false,
        isOutdoors: fields.isOutdoors ?? false,
        latitude: fields.latitude,
        longitude: fields.longitude,
        floorPlanImageUrl: fields.floorPlanImageUrl,
        isParkingAvailable: fields.isParkingAvailable ?? false,
        locationPictures: {
          connect: (mediaIds ?? []).map((id) => ({ id })),
        },
      },
      include: { locationPictures: true },
    });

    return { success: true, message: 'Location created successfully', data: location };
  }

  async findAll(filters: FilterLocationDto) {
    const {
      search,
      capacity,
      isIndoors,
      isOutdoors,
      isParkingAvailable,
      page = 1,
      limit = 10,
    } = filters;

    const where: Prisma.LocationWhereInput = {
      status: EntityStatus.ACTIVE,
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(capacity !== undefined && { capacity: { gte: capacity } }),
      ...(isIndoors !== undefined && { isIndoors }),
      ...(isOutdoors !== undefined && { isOutdoors }),
      ...(isParkingAvailable !== undefined && { isParkingAvailable }),
    };

    const [locations, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({
        where,
        include: { locationPictures: true },
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

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { locationPictures: true },
    });

    if (!location) {
      throw new NotFoundException({ success: false, message: 'No location with this id' });
    }

    return { success: true, message: 'Location fetched successfully', data: location };
  }

  async update(id: string, dto: UpdateLocationDto) {
    const { mediaIds, ...fields } = dto;

    const updated = await this.prisma.location
      .update({
        where: { id },
        data: {
          ...fields,
          ...(mediaIds !== undefined && {
            locationPictures: {
              set: mediaIds.map((mid) => ({ id: mid })),
            },
          }),
        },
        include: { locationPictures: true },
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

  async remove(id: string) {
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
}
