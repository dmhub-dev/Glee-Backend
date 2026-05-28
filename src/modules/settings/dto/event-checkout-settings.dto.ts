import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateEventCheckoutSettingsDto {
  @ApiProperty({ minimum: 1, maximum: 100, default: 30 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  walletInstallmentDepositPercent: number;

  @ApiProperty({ minimum: 0, maximum: 100, default: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  walletInstallmentSecurityFeePercent: number;
}
