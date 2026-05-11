import {
  IsCreditCard,
  IsDate,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsCountryCode,
  IsCustomizePostalCode,
  IsCVC,
  IsExpMonthYear,
} from '../../../decorators/card.validation.decorator';
import { BookingType } from 'src/schemas/enums/bookingType-enum';

export class CreatePurchaseBookingDto {
  @ApiProperty()
  @IsMongoId({ message: 'Invalid Booking Id Provided...' })
  @IsNotEmpty({ message: 'Booking Id Field should not be empty...' })
  bookingId: string;

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
  @IsCountryCode({ message: 'Invalid Address State Field provided...' })
  @IsNotEmpty({ message: 'Address State Field should not be empty...' })
  addressState: string;

  @ApiProperty()
  @IsCustomizePostalCode('addressState', {
    message: 'Invalid Postal Code Field provided...',
  })
  @IsNotEmpty({ message: 'Postal Code Field should not be empty...' })
  addressZip: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  date: Date;

  @ApiProperty()
  @IsNotEmpty({ message: 'You have to specify type of booking you want to do' })
  bookingType: BookingType = BookingType.VENUE;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsMongoId({ message: 'Invalid Table Id Provided...' })
  tableId: string;
}
