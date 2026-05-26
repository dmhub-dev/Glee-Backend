import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { EventStatus } from '@prisma/client';
import { toJson } from '@src/common/utils/cast.helper';

export class TicketCategoryInputDto {
    name: string;
    price: number;
    capacity?: number;
}

export class EventScheduleDto {
    @ApiProperty()
    @IsNotEmpty()
    name: string;

    @ApiProperty()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ format: 'date-time' })
    @IsNotEmpty()
    startDate: Date;

    @ApiProperty({ format: 'date-time' })
    @IsNotEmpty()
    endDate: Date;
}

export class MenuItemInputDto {
    name: string;
    category?: string;
    price: number;
    description?: string;
}

export class CreateEventDto {
    @ApiProperty()
    @IsNotEmpty({ message: 'Name field should not be empty.' })
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    description?: string;

    @ApiProperty({ description: 'Location id from the locations table' })
    @IsNotEmpty({ message: 'Location is required.' })
    @IsString()
    locationId: string;

    @Transform(({ value }) => toJson(value))
    @ApiProperty({
        required: false,
        name: 'date',
        type: 'object',
        properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
        },
    })
    @IsOptional()
    date?: { start: Date; end: Date };

    @ApiProperty({ required: false })
    @IsOptional()
    vendor?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    capacity?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    category?: string;

    @ApiProperty({
        required: false,
        enum: EventStatus,
        default: EventStatus.DRAFT,
    })
    @IsOptional()
    @IsEnum(EventStatus, { message: 'Invalid Event Status' })
    status?: EventStatus;

    @ApiProperty({
        required: false,
        enum: EventStatus,
        default: EventStatus.DRAFT,
    })
    @IsOptional()
    @IsEnum(EventStatus, { message: 'Invalid Event Status' })
    isActive?: EventStatus;

    @ApiProperty({
        name: 'files',
        required: false,
        type: 'array',
        items: { type: 'string', format: 'binary' },
    })
    @IsOptional()
    photos?: string[];

    @ApiProperty({ required: false, isArray: true, type: [EventScheduleDto] })
    @IsOptional()
    @Transform(({ value }) => {
        if (!value) return [];
        try {
            return toJson(value);
        } catch {
            return [];
        }
    })
    eventSchedule?: EventScheduleDto[];

    @Transform(({ value }) => {
        if (!value) return [];
        try {
            return toJson(value);
        } catch {
            return [];
        }
    })
    @ApiProperty({
        required: false,
        type: 'string',
        description:
            'JSON array: [{ "name": "VIP", "price": 1000, "capacity": 50 }]',
    })
    @IsOptional()
    ticketCategories?: TicketCategoryInputDto[];

    @Transform(({ value }) => {
        if (!value) return [];
        try {
            return toJson(value);
        } catch {
            return [];
        }
    })
    @ApiProperty({
        required: false,
        type: 'string',
        description:
            'JSON array: [{ "name": "Hennessy", "category": "drink", "price": 2500 }]',
    })
    @IsOptional()
    menuItems?: MenuItemInputDto[];

    @Transform(({ value }) => {
        if (!value) return [];
        try {
            return toJson(value);
        } catch {
            return [];
        }
    })
    @ApiProperty({
        required: false,
        type: 'string',
        description:
            'Alias for menuItems. JSON array: [{ "name": "Hennessy", "category": "drink", "price": 2500 }]',
    })
    @IsOptional()
    preOrderMenu?: MenuItemInputDto[];
}
