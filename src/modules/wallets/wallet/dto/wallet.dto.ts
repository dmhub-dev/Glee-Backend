import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class WalletTopUpDto {
  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ default: 'KES' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class WalletTransactionsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number = 20;
}
