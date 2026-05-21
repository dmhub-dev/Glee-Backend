# Location Module Design

**Date:** 2026-05-21  
**Status:** Approved

## Overview

Add a `Location` module to the Glee NestJS/Prisma/PostgreSQL backend. Locations represent physical venues for events. Admins manage locations; users browse and select them when creating events.

## Prisma Schema

### New model: `Location`

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

### Modified model: `Media`

Add optional relation back to `Location`:

```prisma
locationId  String?
location    Location? @relation(fields: [locationId], references: [id])
```

### Modified model: `Event`

Add optional foreign key to `Location`:

```prisma
locationId  String?
location    Location? @relation(fields: [locationId], references: [id])
```

## Module Structure

Follows the `categories` module pattern (dual controller: public + admin).

```
src/location/
├── location.module.ts
├── location.service.ts
├── location.controller.ts          ← public: list, get
├── admin.location.controller.ts    ← admin: create, update, delete
└── dto/
    ├── create-location.dto.ts
    ├── update-location.dto.ts
    └── filter-location.dto.ts
```

## Endpoints

### Public (authenticated users)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/locations` | List locations with filters + pagination |
| GET | `/locations/:id` | Get single location |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/locations` | Create location |
| PATCH | `/admin/locations/:id` | Update location |
| DELETE | `/admin/locations/:id` | Soft delete (status → INACTIVE) |

## DTOs

### CreateLocationDto

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | yes | |
| address | string | yes | |
| capacity | number | yes | min: 1 |
| isIndoors | boolean | no | default false |
| isOutdoors | boolean | no | default false |
| latitude | number | yes | |
| longitude | number | yes | |
| floorPlanImageUrl | string | no | URL |
| isParkingAvailable | boolean | no | default false |
| mediaIds | string[] | no | IDs of existing Media records to attach as locationPictures |

### UpdateLocationDto

Partial of `CreateLocationDto`.

### FilterLocationDto

| Field | Type | Notes |
|-------|------|-------|
| search | string | name search (contains, case-insensitive) |
| capacity | number | minimum capacity filter |
| isIndoors | boolean | |
| isOutdoors | boolean | |
| isParkingAvailable | boolean | |
| page | number | default 1 |
| limit | number | default 10 |

## Service Methods

- `create(dto)` — create location, connect Media by IDs
- `findAll(filters)` — paginated list with Prisma `where` filters
- `findOne(id)` — single location with `locationPictures` included (events not included to avoid large payloads)
- `update(id, dto)` — update fields, reconnect Media if `mediaIds` provided
- `remove(id)` — soft delete: set `status = INACTIVE`

## Access Control

- Public endpoints: decorated with `@Public()` — required because global `JwtAuthGuard` blocks all routes by default
- Admin endpoints: require admin role via existing `PermissionsGuard`
- No vendor or user-level write access

## Registration

Add `LocationModule` to `AppModule` imports array.
