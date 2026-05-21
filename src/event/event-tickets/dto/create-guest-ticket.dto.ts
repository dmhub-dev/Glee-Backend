import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateGuestTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ticketCategoryId?: string;

  @ApiProperty({ default: 1 })
  @IsNumber()
  @Min(1)
  noOfTickets: number = 1;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  guestName: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  guestEmail: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  guestPhone: string;
}
