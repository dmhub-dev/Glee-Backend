import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaAccess, MediaType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateMediaDto {
  @ApiPropertyOptional({ enum: MediaAccess })
  @IsEnum(MediaAccess)
  @IsOptional()
  access?: MediaAccess;
}

export class MediaQueryDto {
  @ApiPropertyOptional({ enum: MediaType })
  @IsEnum(MediaType)
  @IsOptional()
  type?: MediaType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vendorId?: string;
}
