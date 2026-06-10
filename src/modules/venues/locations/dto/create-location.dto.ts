import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VenueType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({ type: [String], description: 'Array of picture URLs' })
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
