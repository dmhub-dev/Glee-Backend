import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@src/prisma/prisma.service';

const mockPrisma = {
  category: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create category and return success', async () => {
      const dto = { name: 'Music' };
      const created = { id: 'cat1', ...dto };
      mockPrisma.category.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(mockPrisma.category.create).toHaveBeenCalledWith({ data: dto });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
    });
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const categories = [{ id: 'cat1', name: 'Music' }];
      mockPrisma.category.findMany.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(categories);
    });

    it('should return failure when no categories exist', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return category when found', async () => {
      const category = { id: 'cat1', name: 'Music' };
      mockPrisma.category.findUnique.mockResolvedValue(category);

      const result = await service.findOne('cat1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(category);
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return success', async () => {
      const updated = { id: 'cat1', name: 'Updated' };
      mockPrisma.category.update.mockResolvedValue(updated);

      const result = await service.update('cat1', { name: 'Updated' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });

    it('should return failure when category not found', async () => {
      mockPrisma.category.update.mockRejectedValue(new Error('not found'));

      const result = await service.update('bad-id', { name: 'X' });

      expect(result.success).toBe(false);
    });
  });

  describe('remove', () => {
    it('should delete category and return success', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat1', name: 'Music' });
      mockPrisma.category.delete.mockResolvedValue({});

      const result = await service.remove('cat1');

      expect(mockPrisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat1' } });
      expect(result.success).toBe(true);
    });

    it('should return failure when category not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const result = await service.remove('bad-id');

      expect(result.success).toBe(false);
      expect(mockPrisma.category.delete).not.toHaveBeenCalled();
    });
  });
});
