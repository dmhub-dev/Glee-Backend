import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsString,
  IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toNumber } from '../../../shared/cast.helper';

export class PaginationQueryUserTicketsDto {
  @ApiProperty({
    minimum: 1,
    maximum: 10000,
    title: 'Page',
    exclusiveMaximum: true,
    exclusiveMinimum: true,
    format: 'int32',
  })
  @IsNumber()
  @IsOptional()
  page: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  limit: number;

  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  @IsString()
  eventId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsMongoId()
  @IsString()
  userId: string;
}

export class PaginationQueryDto {
  @Transform(({ value }) => toNumber(value, { default: 1, min: 1 }))
  @ApiProperty({
    required: false,
  })
  @IsNumber()
  @IsOptional()
  page: number = 1;

  @Transform(({ value }) => toNumber(value, { default: 10, min: 1 }))
  @ApiProperty({
    required: false,
  })
  @IsNumber()
  @IsOptional()
  limit: number = 10;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  eventId: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  userId: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  _id: string;
}
