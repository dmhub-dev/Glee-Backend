import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateEventTicketDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({ default: 1 })
  @IsNumber()
  @Min(1)
  noOfTickets: number = 1;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ticketCategoryId?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  preOrderMenu?: any[];
}
