import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { toBoolean, toNumber } from '@src/shared/cast.helper';

export enum TimeFilter {
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  ALL = 'ALL',
}

class PaginationQueryDto {
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

export class NotificationDto extends PaginationQueryDto {}
