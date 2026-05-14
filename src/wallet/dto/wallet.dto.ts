import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TopUpWalletDto {
  @ApiProperty({ description: 'Amount in USD to top up' })
  @IsNumber()
  @Min(1)
  amount: number;
}

export class DeductWalletDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  points: number;
}

export class WalletOtpDto {
  @ApiProperty()
  @IsNumber()
  otp: number;
}

export class WalletVerifyOtpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class GetWalletOtpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
