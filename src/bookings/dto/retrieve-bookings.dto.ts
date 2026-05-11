import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { toBoolean, toNumber } from 'src/shared/cast.helper';
import { ApiProperty } from '@nestjs/swagger';

export class RetrieveBookingDto {
  @Transform(({ value }) => toNumber(value, { default: 1, min: 1 }))
  @ApiProperty({
    required: false,
    default: 1,
  })
  @IsNumber()
  @IsOptional()
  page: number = 1;

  @Transform(({ value }) => toNumber(value, { default: 10, min: 1 }))
  @ApiProperty({
    required: false,
    default: 10,
  })
  @IsNumber()
  @IsOptional()
  limit: number = 10;
}

export class RetrieveBookingAdminDto extends RetrieveBookingDto {
  @Transform(({ value }) => toBoolean(value))
  @ApiProperty({
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDeleted: boolean = false;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search: string;
}

export class RetrieveBookingSingleAdminDto {
  @Transform(({ value }) => toBoolean(value))
  @ApiProperty({
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDeleted: boolean = false;
}
