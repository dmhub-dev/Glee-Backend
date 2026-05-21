# Location Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full CRUD Location module so events can reference physical venues with filtering and admin-only write access.

**Architecture:** New `Location` Prisma model linked to `Media` (pictures via FK on Media) and `Event` (optional FK). Follows `categories` module pattern: dual controllers (public read + admin write), service with `{ success, message, data }` responses, `@Permissions()` RBAC decorator.

**Tech Stack:** NestJS, Prisma ORM, PostgreSQL, class-validator, class-transformer, @nestjs/swagger, Jest

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/auth/rbac/permissions.enum.ts` |
| Modify | `prisma/schema.prisma` |
| Create | `src/location/dto/create-location.dto.ts` |
| Create | `src/location/dto/update-location.dto.ts` |
| Create | `src/location/dto/filter-location.dto.ts` |
| Create | `src/location/location.service.ts` |
| Create | `src/location/location.service.spec.ts` |
| Create | `src/location/location.controller.ts` |
| Create | `src/location/admin.location.controller.ts` |
| Create | `src/location/location.module.ts` |
| Modify | `src/app.module.ts` |

---

### Task 1: Add Location permissions to RBAC enum

**Files:**
- Modify: `src/auth/rbac/permissions.enum.ts`

- [ ] **Step 1: Add location permissions block**

Open `src/auth/rbac/permissions.enum.ts`. Find the `// Settings` block (around line 66). Add the following block directly before `// System`:

```typescript
  // Location
  LOCATION_READ:   'location:read',
  LOCATION_CREATE: 'location:create',
  LOCATION_UPDATE: 'location:update',
  LOCATION_DELETE: 'location:delete',
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to permissions.enum.ts

- [ ] **Step 3: Commit**

```bash
git add src/auth/rbac/permissions.enum.ts
git commit -m "feat(rbac): add location permissions to enum"
```

---

### Task 2: Update Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the Location model**

At the end of `prisma/schema.prisma`, add:

```prisma
model Location {
  id                 String       @id @default(cuid())
  name               String
  address            String
  capacity           Int
  isIndoors          Boolean      @default(false)
  isOutdoors         Boolean      @default(false)
  latitude           Float
  longitude          Float
  floorPlanImageUrl  String?
  isParkingAvailable Boolean      @default(false)
  status             EntityStatus @default(ACTIVE)
  locationPictures   Media[]
  events             Event[]
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt

  @@map("locations")
}
```

- [ ] **Step 2: Add locationId to Media model**

Find `model Media` in `prisma/schema.prisma`. Add these two lines inside the model (after the `updatedAt` field, before the closing `}`):

```prisma
  locationId String?
  location   Location? @relation(fields: [locationId], references: [id])
```

- [ ] **Step 3: Add locationId to Event model**

Find `model Event` in `prisma/schema.prisma`. Add these two lines inside the model (after the `updatedAt` field, before `@@index`):

```prisma
  locationId String?
  location   Location? @relation(fields: [locationId], references: [id])
```

- [ ] **Step 4: Run Prisma migration**

```bash
npx prisma migrate dev --name add_location_module
```

Expected output ends with:
```
The following migration(s) have been applied:
  migrations/YYYYMMDDHHMMSS_add_location_module/migration.sql
```

- [ ] **Step 5: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(prisma): add Location model and locationId to Media and Event"
```

---

### Task 3: Create DTOs

**Files:**
- Create: `src/location/dto/create-location.dto.ts`
- Create: `src/location/dto/update-location.dto.ts`
- Create: `src/location/dto/filter-location.dto.ts`

- [ ] **Step 1: Create CreateLocationDto**

Create `src/location/dto/create-location.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateLocationDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  address: string;

  @ApiProperty({ minimum: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  capacity: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isIndoors?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isOutdoors?: boolean;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  longitude: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  floorPlanImageUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isParkingAvailable?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Array of existing Media record IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];
}
```

- [ ] **Step 2: Create UpdateLocationDto**

Create `src/location/dto/update-location.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isIndoors?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOutdoors?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  floorPlanImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isParkingAvailable?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Replace location pictures with these Media IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaIds?: string[];
}
```

- [ ] **Step 3: Create FilterLocationDto**

Create `src/location/dto/filter-location.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class FilterLocationDto {
  @ApiPropertyOptional({ description: 'Search by name (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Minimum capacity' })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsNumber()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isIndoors?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isOutdoors?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isParkingAvailable?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 1))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 10))
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in the new DTO files

- [ ] **Step 5: Commit**

```bash
git add src/location/dto
git commit -m "feat(location): add create, update, and filter DTOs"
```

---

### Task 4: Create LocationService with unit tests (TDD)

**Files:**
- Create: `src/location/location.service.spec.ts`
- Create: `src/location/location.service.ts`

- [ ] **Step 1: Write failing tests**

Create `src/location/location.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EntityStatus } from '@prisma/client';
import { LocationService } from './location.service';
import { PrismaService } from '@src/prisma/prisma.service';

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
          locationPictures: { connect: [] },
        },
        include: { locationPictures: true },
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest src/location/location.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './location.service'`

- [ ] **Step 3: Implement LocationService**

Create `src/location/location.service.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest src/location/location.service.spec.ts --no-coverage
```

Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add src/location/location.service.ts src/location/location.service.spec.ts
git commit -m "feat(location): add LocationService with unit tests"
```

---

### Task 5: Create public LocationController

**Files:**
- Create: `src/location/location.controller.ts`

- [ ] **Step 1: Create the controller**

Create `src/location/location.controller.ts`:

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from 'src/shared/response';
import { FilterLocationDto } from './dto/filter-location.dto';
import { LocationService } from './location.service';

@ApiTags('Locations')
@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Permissions(Permission.LOCATION_READ)
  @ApiResponses(false)
  @Get()
  findAll(@Query() filters: FilterLocationDto) {
    return this.locationService.findAll(filters);
  }

  @Permissions(Permission.LOCATION_READ)
  @ApiResponses(false)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationService.findOne(id);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in location.controller.ts

- [ ] **Step 3: Commit**

```bash
git add src/location/location.controller.ts
git commit -m "feat(location): add public LocationController"
```

---

### Task 6: Create AdminLocationController

**Files:**
- Create: `src/location/admin.location.controller.ts`

- [ ] **Step 1: Create the admin controller**

Create `src/location/admin.location.controller.ts`:

```typescript
import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from 'src/shared/response';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationService } from './location.service';

@ApiTags('Admin Locations')
@Controller('admin/locations')
export class AdminLocationController {
  constructor(private readonly locationService: LocationService) {}

  @Permissions(Permission.LOCATION_CREATE)
  @ApiResponses(true, [UserRole.ADMIN])
  @Post()
  create(@Body() dto: CreateLocationDto) {
    return this.locationService.create(dto);
  }

  @Permissions(Permission.LOCATION_UPDATE)
  @ApiResponses(false)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationService.update(id, dto);
  }

  @Permissions(Permission.LOCATION_DELETE)
  @ApiResponses(false)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.locationService.remove(id);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in admin.location.controller.ts

- [ ] **Step 3: Commit**

```bash
git add src/location/admin.location.controller.ts
git commit -m "feat(location): add AdminLocationController"
```

---

### Task 7: Create LocationModule and register in AppModule

**Files:**
- Create: `src/location/location.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create LocationModule**

Create `src/location/location.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AdminLocationController } from './admin.location.controller';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  controllers: [LocationController, AdminLocationController],
  providers: [LocationService],
})
export class LocationModule {}
```

- [ ] **Step 2: Register in AppModule**

Open `src/app.module.ts`. Add the import at the top with the other module imports:

```typescript
import { LocationModule } from './location/location.module';
```

Then add `LocationModule` to the `imports` array in `@Module()`, alongside `CategoriesModule`:

```typescript
CategoriesModule,
LocationModule,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Run all location tests**

```bash
npx jest src/location --no-coverage
```

Expected: PASS — all tests green

- [ ] **Step 5: Start the server and verify Swagger shows location endpoints**

```bash
npm run start:dev
```

Open `http://localhost:<PORT>/swagger`. Confirm these tag groups appear:
- **Locations** — `GET /api/v1/locations`, `GET /api/v1/locations/:id`
- **Admin Locations** — `POST /api/v1/admin/locations`, `PATCH /api/v1/admin/locations/:id`, `DELETE /api/v1/admin/locations/:id`

- [ ] **Step 6: Commit**

```bash
git add src/location/location.module.ts src/app.module.ts
git commit -m "feat(location): register LocationModule in AppModule"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Location model: name, address, locationPictures (Media[]), capacity, isIndoors, isOutdoors, latitude, longitude, floorPlanImageUrl, isParkingAvailable, status, timestamps
- ✅ Full CRUD (create, list, get, update, soft-delete)
- ✅ Admin-only write access via `@Permissions` + `UserRole.ADMIN`
- ✅ Public list + get
- ✅ Filters: search, capacity, isIndoors, isOutdoors, isParkingAvailable
- ✅ Event.locationId FK added
- ✅ Media.locationId FK added (Approach A)
- ✅ LocationModule registered in AppModule

**Placeholder scan:** No TBD/TODO found.

**Type consistency:** `CreateLocationDto`, `UpdateLocationDto`, `FilterLocationDto` match service method signatures throughout all tasks.
