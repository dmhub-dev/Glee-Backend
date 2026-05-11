import {
  IsCreditCard,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
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

export class CreatePurchasedServiceDto {
  @ApiProperty()
  @IsMongoId({ message: 'Invalid service Id Provided...' })
  @IsNotEmpty({ message: 'service Id Field should not be empty...' })
  serviceId: string;

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

  @ApiProperty()
  @IsNotEmpty({
    message: 'You have to enter the date when service is required...',
  })
  date: Date;

  @ApiProperty()
  @IsNotEmpty({
    message:
      'You have to specify the number of persons you want to buy service for...',
  })
  @Min(1)
  @Max(20)
  @IsNumber()
  totalPersons: number;
}
