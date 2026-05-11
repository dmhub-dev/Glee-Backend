import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsMongoId,
  IsString,
  IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { toNumber } from '../../../shared/cast.helper';

export class GetBookingsDataDto {
  @Transform(({ value }) => toNumber(value, { default: 1, min: 1 }))
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  page: number = 1;

  @Transform(({ value }) => toNumber(value, { default: 10, min: 1 }))
  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  limit: number = 10;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId()
  @IsString()
  bookingId: string;
}
