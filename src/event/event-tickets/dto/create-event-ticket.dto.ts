import {
  IsCreditCard,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsCountryCode,
  IsCustomizePostalCode,
  IsCVC,
  IsExpMonthYear,
} from '../../../decorators/card.validation.decorator';

export class CreateEventTicketDto {
  @ApiProperty()
  @IsMongoId({ message: 'Invalid Event Id Provided...' })
  @IsNotEmpty({ message: 'Event Field should not be empty...' })
  eventId: string;

  @ApiProperty()
  @IsMongoId({ message: 'Invalid User Id Provided...' })
  @IsOptional()
  userId: string;

  @ApiProperty()
  @IsCreditCard({ message: 'Invalid Credit Card provided...' })
  @IsNotEmpty({ message: 'Credit Card Field should not be empty...' })
  number: string;

  @ApiProperty()
  @IsExpMonthYear({ message: 'Invalid expiry date provided...' })
  @IsNotEmpty({ message: 'Expiry date Field should not be empty...' })
  exp: string;

  @ApiProperty()
  @IsCVC({ message: 'Invalid cvc year provided...' })
  @IsNotEmpty({ message: 'CVC Field should not be empty...' })
  cvc: string;

  @ApiProperty()
  @IsOptional()
  @IsCountryCode({ message: 'Invalid Address State Field provided...' })
  addressState: string;

  @ApiProperty()
  @IsOptional()
  @IsCustomizePostalCode('addressState', {
    message: 'Invalid Postal Code Field provided...',
  })
  addressZip: string;

  @ApiProperty()
  @IsNumber()
  noOfTickets: number = 1;
}
