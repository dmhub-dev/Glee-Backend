import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class IssueComplimentaryTicketDto {
    @IsNotEmpty()
    @IsString()
    eventId: string;

    @IsNotEmpty()
    @IsString()
    ticketCategoryId: string;

    @Type(() => Number)
    @Min(1)
    quantity: number;

    @IsNotEmpty()
    @IsString()
    recipientName: string;

    @IsNotEmpty()
    @IsEmail()
    recipientEmail: string;

    @IsOptional()
    @IsString()
    recipientPhone?: string;

    @IsOptional()
    @IsString()
    note?: string;

    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    checkInNow?: boolean;
}
