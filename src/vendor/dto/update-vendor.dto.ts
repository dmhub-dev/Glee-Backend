import {
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Min,
  Max,
  IsEnum,
  IsNumber,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiBody } from '@nestjs/swagger';
import { CountryCodes } from '../../shared/countries';

export class UpdateVendorDto {
  @ApiProperty()
  @IsOptional()
  @MinLength(4)
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsOptional()
  phone: number;

  @ApiProperty()
  @IsOptional()
  state: string = 'ALL';

  @ApiProperty({ enum: CountryCodes })
  @IsOptional()
  country: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  city: string;

  @ApiProperty()
  @IsOptional()
  profileImage: string;

  @ApiProperty()
  @IsOptional()
  routingNumber: string;

  @ApiProperty()
  @IsOptional()
  businessAccount: string;
}
