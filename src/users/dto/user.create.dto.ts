import {
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Min,
  Max,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiBody } from '@nestjs/swagger';


export class CreateUserDto {
  @ApiProperty()
  @IsNotEmpty()
  name: string;

  
  @ApiProperty()
  @IsNotEmpty()
  password: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsOptional()
  phone: string;

  @ApiProperty()
  @IsNotEmpty()
  state: string;

  @ApiProperty({
    enum: ['USER', 'ADMIN'],
    description: 'Optional',
    required: false,
  })
  @IsOptional()
  role: string;

  @ApiProperty({ type: Number })
  @IsNotEmpty()
  @IsNumber()
  otp: number;
}
