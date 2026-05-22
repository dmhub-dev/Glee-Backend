import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested, IsArray } from 'class-validator';

export class MenuItemOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ default: 1 })
  @IsNumber()
  @Min(1)
  quantity: number = 1;
}

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

  @ApiPropertyOptional({ type: [MenuItemOrderDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuItemOrderDto)
  menuItems?: MenuItemOrderDto[];
}
