import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

const FEE_TYPES = ['PERCENTAGE', 'FIXED'] as const;

export class UpdateEventCheckoutSettingsDto {
  @ApiPropertyOptional({ enum: FEE_TYPES, default: 'PERCENTAGE' })
  @IsOptional()
  @IsIn(FEE_TYPES)
  walletInstallmentDepositType?: 'PERCENTAGE' | 'FIXED';

  @ApiProperty({ minimum: 1, maximum: 100, default: 30, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  walletInstallmentDepositPercent?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  walletInstallmentDepositAmount?: number;

  @ApiPropertyOptional({ enum: FEE_TYPES, default: 'PERCENTAGE' })
  @IsOptional()
  @IsIn(FEE_TYPES)
  walletInstallmentSecurityFeeType?: 'PERCENTAGE' | 'FIXED';

  @ApiProperty({ minimum: 0, maximum: 100, default: 5, required: false })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  walletInstallmentSecurityFeePercent?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  walletInstallmentSecurityFeeAmount?: number;
}
