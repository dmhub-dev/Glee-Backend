import {
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiBody } from '@nestjs/swagger';
import { CountryCodes } from '../../shared/countries';

export class CreateVendorDto {
  @ApiProperty()
  @IsNotEmpty()
  @MinLength(4)
  name: string;

  @ApiProperty()
  @IsNotEmpty()
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

  @ApiProperty()
  @IsOptional()
  routingNumber: string;

  @ApiProperty()
  @IsOptional()
  businessAccount: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  city: string;

  @ApiProperty({
    name: 'file',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  profileImage: string;
}
