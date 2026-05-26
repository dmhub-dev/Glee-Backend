import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EntityStatus } from '@prisma/client';
import { LocationService } from './location.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { S3Service } from '@src/shared/s3.service';

const mockPrisma = {
  location: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('LocationService', () => {
  let service: LocationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3Service, useValue: { uploadMany: jest.fn() } },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a location and return success response', async () => {
      const dto = {
        name: 'Skyline Hall',
        address: '123 Main St',
        capacity: 500,
        latitude: 1.234,
        longitude: 5.678,
      };
      const created = { id: 'loc1', ...dto, status: EntityStatus.ACTIVE };
      mockPrisma.location.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(mockPrisma.location.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          address: dto.address,
          capacity: dto.capacity,
          isIndoors: false,
          isOutdoors: false,
          latitude: dto.latitude,
          longitude: dto.longitude,
          floorPlanImageUrl: undefined,
          isParkingAvailable: false,
          pictures: [],
        },
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should return paginated locations', async () => {
      const locations = [{ id: 'loc1', name: 'Hall A' }];
      mockPrisma.$transaction.mockResolvedValue([locations, 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(locations);
      expect(result.total).toBe(1);
    });

    it('should return empty array when none exist', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return location when found', async () => {
      const location = { id: 'loc1', name: 'Hall A' };
      mockPrisma.location.findUnique.mockResolvedValue(location);

      const result = await service.findOne('loc1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(location);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.location.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return success', async () => {
      const updated = { id: 'loc1', name: 'Updated Hall' };
      mockPrisma.location.update.mockResolvedValue(updated);

      const result = await service.update('loc1', { name: 'Updated Hall' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });

    it('should return failure when location not found', async () => {
      mockPrisma.location.update.mockRejectedValue(new Error('not found'));

      const result = await service.update('bad-id', { name: 'X' });

      expect(result.success).toBe(false);
    });
  });

  describe('remove', () => {
    it('should soft delete by setting status to INACTIVE', async () => {
      const updated = { id: 'loc1', status: EntityStatus.INACTIVE };
      mockPrisma.location.update.mockResolvedValue(updated);

      const result = await service.remove('loc1');

      expect(mockPrisma.location.update).toHaveBeenCalledWith({
        where: { id: 'loc1' },
        data: { status: EntityStatus.INACTIVE },
      });
      expect(result.success).toBe(true);
    });

    it('should return failure when location not found', async () => {
      mockPrisma.location.update.mockRejectedValue(new Error('not found'));

      const result = await service.remove('bad-id');

      expect(result.success).toBe(false);
    });
  });
});
