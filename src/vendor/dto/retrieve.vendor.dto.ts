import { Transform } from 'class-transformer';
import { toBoolean, toNumber } from '@src/shared/cast.helper';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class RetrieveVendorDto {
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

export class RetrieveVendorAdminDto extends RetrieveVendorDto {
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
