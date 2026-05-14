import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateArtistDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  details?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  profileImage?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'string', format: 'binary' } })
  images?: string[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'string', format: 'binary' } })
  videos?: string[];
}

export class UpdateArtistDto extends PartialType(CreateArtistDto) {}

export class RetrieveArtistDto {
  @Transform(({ value }) => parseInt(value, 10) || 1)
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  page: number = 1;

  @Transform(({ value }) => parseInt(value, 10) || 10)
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  limit: number = 10;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  eventId?: string;
}
