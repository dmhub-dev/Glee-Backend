import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

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

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  useWallet?: boolean;

  @ApiPropertyOptional({ enum: ['FULL', 'INSTALLMENT'], default: 'FULL' })
  @IsOptional()
  @IsIn(['FULL', 'INSTALLMENT'])
  walletPaymentType?: 'FULL' | 'INSTALLMENT';

  @ApiPropertyOptional({ description: 'Number of remaining installment payments after the 30% wallet deposit.' })
  @ValidateIf((o) => o.walletPaymentType === 'INSTALLMENT')
  @IsInt()
  @Min(2)
  installmentCount?: number;
}
