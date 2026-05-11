import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsMongoId,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { faker } from '@faker-js/faker';
import { Transform } from 'class-transformer';
import { toNumber } from '../../shared/cast.helper';

export class CreateServiceDto {
  @ApiProperty({
    required: true,
    default: faker.commerce.department(),
    title: 'Service Name',
    description: 'Is Mandatory',
    type: 'string',
    examples: ['Catering Service'],
  })
  @IsString({ message: 'Invalid service name provided.' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    required: false,
    default: faker.lorem.lines(4),
    title: 'Service Description',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsOptional()
  @IsString({ message: 'Invalid service description provided.' })
  description: string;

  @ApiProperty({
    required: true,
    default: faker.address.streetAddress(true),
    title: 'Service Address',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsString({ message: 'Invalid service address provided.' })
  @IsNotEmpty()
  address: string;

  @ApiProperty()
  // @IsNumber()
  @IsNotEmpty({ message: 'Latitude field should not be empty........' })
  latitude: number;

  @ApiProperty()
  // @IsNumber()
  @IsNotEmpty({ message: 'Longitude field should not be empty........' })
  longitude: number;

  @ApiProperty({
    required: true,
    title: 'Category',
    description: 'Is Required',
    type: 'string',
    examples: ['632b0c89da46b6aa88c84c4e'],
  })
  @IsMongoId({ message: 'Invalid reference of category.' })
  @IsNotEmpty({ message: 'Category reference must be required.' })
  category: string;

  @ApiProperty({
    required: true,
    title: 'Vendor',
    description: 'Is Required',
    type: 'string',
    examples: ['632b0c89da46b6aa88c84c4e'],
  })
  @IsMongoId({ message: 'Invalid reference of vendor.' })
  @IsNotEmpty({ message: 'Vendor reference must be required.' })
  vendor: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
    },
    required: true,
  })
  serviceDetails: string[];

  @ApiProperty({
    required: true,
    default: faker.datatype.number({ min: 500, max: 5000 }),
    title: 'Per Person Price',
    description: 'Is Required',
    type: 'number',
    examples: ['lorem epsum.'],
  })
  @Transform(({ value }) => {
    return toNumber(value, { default: 1, min: 1 });
  })
  @IsNotEmpty({ message: 'Price must be required.' })
  price: number;

  @ApiProperty({
    required: false,
    title: 'Photos',
    name: 'files',
    type: 'array',
    items: {
      title: 'Service Image',
      type: 'string',
      format: 'binary',
    },
  })
  photos: string[];
}
