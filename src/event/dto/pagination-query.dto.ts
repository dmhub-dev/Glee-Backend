import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsString,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toBoolean, toNumber } from '../../shared/cast.helper';

export class PaginationQueryDto {
  @Transform(({ value }) => toNumber(value, { default: 1, min: 1 }))
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  page: number = 1;

  @Transform(({ value }) => toNumber(value, { default: 10, min: 1 }))
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  limit: number = 10;

  @Transform(({ value }) => toBoolean(value))
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  skipPagination: boolean = false;
}
