import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { toNumber } from '@src/common/utils/cast.helper';

export class FinanceListQueryDto {
  @Transform(({ value }) => toNumber(value, { default: 1, min: 1 }))
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @Transform(({ value }) => toNumber(value, { default: 20, min: 1 }))
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;
}

export class FinanceRefundDto {
  @Transform(({ value }) => value === undefined ? undefined : toNumber(value, { min: 0 }))
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ enum: ['REFUND_PENDING', 'REFUNDED'] })
  @IsOptional()
  @IsIn(['REFUND_PENDING', 'REFUNDED'])
  status?: 'REFUND_PENDING' | 'REFUNDED';
}
