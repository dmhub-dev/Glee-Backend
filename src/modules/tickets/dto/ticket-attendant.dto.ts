import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateTicketAttendantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class TicketAttendantAccessDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;
}

export class AttendantCheckInDto {
  @IsNotEmpty()
  @IsString()
  ticketRef: string;

  @IsOptional()
  @IsString()
  source?: 'QR' | 'MANUAL';
}
