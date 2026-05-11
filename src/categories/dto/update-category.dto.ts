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

export class UpdateCategoryDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  name: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  color: string;
}
