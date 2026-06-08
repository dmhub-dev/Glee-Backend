import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ChatPaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsString()
  @IsDateString()
  before?: string;
}

export class CreateEventChatMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @IsIn(['MESSAGE', 'ANNOUNCEMENT'])
  type?: 'MESSAGE' | 'ANNOUNCEMENT';
}

export class UpdateEventChatMessageDto {
  @Type(() => Boolean)
  @IsBoolean()
  isPinned: boolean;
}

export class DeleteEventChatMessageDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class MarkEventChatReadDto {
  @IsOptional()
  @IsString()
  lastReadMessageId?: string;
}

export class UpdateChatSettingsDto {
  @Type(() => Boolean)
  @IsBoolean()
  staffOnly: boolean;
}
