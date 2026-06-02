import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PaystackPaymentIntentDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  metaData?: Record<string, any>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  callbackUrl?: string;
}

export class PaystackVerifyTransactionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}
