import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { EntityStatus as EventStatus } from '@prisma/client';
import { toJson } from '@src/shared/cast.helper';

export class EventScheduleDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Note field should not be empty........' })
  note: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Time field should not be empty........' })
  time: Date;
}

export class CreateEventDto {
  @ApiProperty()
  @IsNotEmpty({ message: 'Name field should not be empty........' })
  name: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Country field should not be empty........' })
  country: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'City field should not be empty........' })
  city: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Location field should not be empty........' })
  location: string;

  @ApiProperty()
  // @IsNumber()
  @IsNotEmpty({ message: 'Latitude field should not be empty........' })
  latitude: number;

  @ApiProperty()
  // @IsNumber()
  @IsNotEmpty({ message: 'Longitude field should not be empty........' })
  longitude: number;

  @Transform(({ value }) => toJson(value))
  @ApiProperty({
    name: 'date',
    type: 'object',
    properties: {
      start: {
        type: 'string',
        format: 'date-time',
      },
      end: {
        type: 'string',
        format: 'date-time',
      },
    },
  })
  @IsNotEmpty({ message: 'Start Date field should not be empty........' })
  // @ValidateDate()
  date: {
    start: Date;
    end: Date;
  };

  @ApiProperty()
  @IsMongoId({ message: 'Provided invalid vendor id........' })
  @IsNotEmpty({ message: 'Business field should not be empty........' })
  vendor: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Capacity field should not be empty........' })
  capacity: number;

  @ApiProperty()
  @IsNotEmpty({
    message: 'Max Ticket Purchase field should not be empty........',
  })
  maxTicketPurchased: number;

  @ApiProperty()
  @IsNotEmpty({ message: 'Price field should not be empty........' })
  price: number;

  @ApiProperty()
  @IsMongoId({ message: 'Provided invalid category id........' })
  @IsNotEmpty({ message: 'Event Type field should not be empty........' })
  category: string;

  @ApiProperty({
    required: false,
    enum: EventStatus,
    default: EventStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(EventStatus, { message: 'Invalid Event Status' })
  isActive: string;

  @ApiProperty({
    name: 'files',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  bannerImages: string[];

  @ApiProperty({
    isArray: true,
    type: [EventScheduleDto],
  })
  @Transform(({ value }) => JSON.parse('[' + value + ']'))
  eventSchedule: EventScheduleDto[];
}
