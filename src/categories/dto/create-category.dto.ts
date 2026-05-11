import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  MinLength,
  MaxLength,
  isNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  color: string;
}
