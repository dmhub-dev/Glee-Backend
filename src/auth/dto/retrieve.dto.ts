import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@src/event/dto/pagination-query.dto';

export class RetrieveCountriesDto extends PaginationQueryDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  isoCode: string = '';

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name: string = '';
}

export class RetrieveStatesDto extends PaginationQueryDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  countryCode: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name: string;
}

export class RetrieveCitesDto extends PaginationQueryDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  countryCode: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  stateCode: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name: string = '';
}
