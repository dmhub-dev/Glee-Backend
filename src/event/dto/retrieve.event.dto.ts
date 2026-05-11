import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { toNumber } from 'src/shared/cast.helper';
import { ApiProperty } from '@nestjs/swagger';

export class RetrieveEventDto {
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
  @IsString()
  @IsOptional()
  search: string;
}

export class EventParticipantFilterDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsMongoId()
  @IsOptional()
  userId: string;

  @ApiProperty()
  @IsString()
  @IsMongoId()
  @IsNotEmpty()
  eventId: string;
}
