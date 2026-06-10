import { ApiPropertyOptional } from '@nestjs/swagger';
import { VenueType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
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
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({ type: [String], description: 'Replace location pictures with these URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pictures?: string[];

  @ApiPropertyOptional({ enum: VenueType, default: VenueType.OTHER })
  @IsOptional()
  @IsEnum(VenueType)
  venueType?: VenueType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  bookingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookingRules?: string;

  @ApiPropertyOptional({ minimum: 0, default: 24 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cancellationCutoffHours?: number;

  @ApiPropertyOptional({ default: 'Africa/Nairobi' })
  @IsOptional()
  @IsString()
  timezone?: string;
}
