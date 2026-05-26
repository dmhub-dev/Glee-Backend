import { ApiProperty } from '@nestjs/swagger';
import { CreateEventDto, EventScheduleDto, MenuItemInputDto, TicketCategoryInputDto } from './create-event.dto';
import {
  IsNotEmpty,
  IsOptional,
  Min,
  Max,
  IsEnum,
  IsNumber,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
  IsMongoId,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EntityStatus as EventStatus } from '@prisma/client';
import { toJson } from '@src/common/utils/cast.helper';

export class UpdateEventDto {
  @ApiProperty({
    required: false,
  })
  @IsOptional()
  name: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  description: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  country: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  city: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  location: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  latitude: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  longitude: string;

  @Transform(({ value }) => toJson(value))
  @ApiProperty({
    required: false,
    type: 'object',
    properties: {
      start: {
        type: 'string',
        format: 'date-time',
      },
      end: {
        type: 'string',
        format: 'date-time',
      },
    },
  })
  @IsOptional()
  date: {
    start: Date;
    end: Date;
  };

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  category: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsMongoId({ message: 'Provided invalid vendor id........' })
  vendor: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  capacity: number;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  // @Min(200)
  // @Max(10000)
  price: number;

  @ApiProperty({
    required: false,
  })
  @ApiProperty({
    required: false,
    name: 'photos',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  @IsOptional()
  photos: string[];

  @ApiProperty({
    required: false,
    enum: EventStatus,
    default: EventStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(EventStatus, { message: 'Invalid Event Status' })
  isActive: string;

  @ApiProperty({
    required: false,
    name: 'files',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  @IsOptional()
  bannerImages: string[];

  @ApiProperty({
    required: false,
    name: 'eventSchedule',
    type: [EventScheduleDto],
  })
  @IsOptional()
  @IsArray()
  @Type(() => EventScheduleDto)
  @Transform(({ value }) => JSON.parse('[' + value + ']'))
  eventSchedule: EventScheduleDto[];

  @Transform(({ value }) => {
    if (!value) return undefined;
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : undefined;
    } catch { return undefined; }
  })
  @ApiProperty({
    required: false,
    type: 'string',
    description: 'JSON array: [{ "name": "VIP", "price": 1000, "capacity": 50 }]',
  })
  @IsOptional()
  ticketCategories?: TicketCategoryInputDto[];

  @Transform(({ value }) => {
    if (!value) return undefined;
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : undefined;
    } catch { return undefined; }
  })
  @ApiProperty({
    required: false,
    type: 'string',
    description: 'JSON array: [{ "name": "Hennessy", "category": "drink", "price": 2500 }]',
  })
  @IsOptional()
  menuItems?: MenuItemInputDto[];
}
