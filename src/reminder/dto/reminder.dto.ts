import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateReminderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  body?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  eventId?: string;

  @ApiProperty()
  @IsDateString()
  scheduledAt: string;
}

export class UpdateReminderDto extends PartialType(CreateReminderDto) {}

export class RetrieveRemindersDto {
  @Transform(({ value }) => parseInt(value, 10) || 1)
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  page: number = 1;

  @Transform(({ value }) => parseInt(value, 10) || 10)
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  limit: number = 10;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  eventId?: string;
}
