import {
  IsOptional,
  IsString,
  IsMongoId,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { faker } from '@faker-js/faker';
import { Transform } from 'class-transformer';

export class UpdateBookingDto {
  @ApiProperty({
    required: false,
    default: faker.commerce.department(),
    title: 'Service Name',
    type: 'string',
  })
  @IsString({ message: 'Invalid booking name provided.' })
  @IsOptional()
  name: string;

  @ApiProperty({
    required: false,
    default: faker.lorem.lines(4),
    title: 'Booking Description',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsOptional()
  description: string;

  @ApiProperty({
    required: false,
    default: faker.address.streetAddress(true),
    title: 'Booking Address',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsOptional()
  address: string;

  @ApiProperty({
    required: false,
    title: 'Category',
    type: 'string',
    examples: ['632b0c89da46b6aa88c84c4e'],
  })
  @IsMongoId({ message: 'Invalid reference of category.' })
  @IsOptional()
  category: string;

  @ApiProperty({
    required: false,
    title: 'Vendor',
    type: 'string',
    examples: ['632b0c89da46b6aa88c84c4e'],
  })
  @IsMongoId({ message: 'Invalid reference of vendor.' })
  @IsOptional()
  vendor: string;

  @ApiProperty({
    required: false,
    default: faker.datatype.number({ min: 500, max: 5000 }),
    title: 'Price',
    type: 'number',
  })
  @IsOptional()
  price: number;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  latitude: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  longitude: string;

  @ApiProperty({
    required: false,
    default: faker.datatype.number({ min: 20, max: 50 }),
    title: 'Capacity',
    type: 'number',
  })
  @IsOptional()
  capacity: number;

  @ApiProperty({
    required: false,
    name: 'files',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  @IsOptional()
  photos: string[];

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
    },
    required: true,
  })
  @IsOptional()
  bookingDetails: string[];
}


export class VendorTablesDto {
  @ApiProperty()
  @IsOptional()
  @IsNumber(
    {},
    { message: 'Table number field should be valid number........' },
  )
  tableNumber : number;

  @ApiProperty()
  @IsOptional({ message: 'Start Date field should not be empty........' })
  startTime: Date;

  @ApiProperty()
  @IsOptional({ message: 'End Date field should not be empty........' })
  endTime: Date;

  @ApiProperty()
  @IsOptional({ message: 'Price field should not be empty........' })
  tablePrice: number;
}


export class VendorUpdateBookingDto {
  @ApiProperty({
    required: false,
    default: faker.commerce.department(),
    title: 'Service Name',
    type: 'string',
  })
  @IsString({ message: 'Invalid booking name provided.' })
  @IsOptional()
  name: string;

  @ApiProperty({
    required: false,
    default: faker.lorem.lines(4),
    title: 'Booking Description',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsOptional()
  description: string;

  @ApiProperty({
    required: false,
    default: faker.address.streetAddress(true),
    title: 'Booking Address',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsOptional()
  address: string;

  @ApiProperty({
    required: false,
    title: 'Category',
    type: 'string',
    examples: ['632b0c89da46b6aa88c84c4e'],
  })
  @IsMongoId({ message: 'Invalid reference of category.' })
  @IsOptional()
  category: string;

  @ApiProperty({
    required: false,
    default: faker.datatype.number({ min: 500, max: 5000 }),
    title: 'Price',
    type: 'number',
  })
  @IsOptional()
  price: number;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  latitude: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  longitude: string;

  @ApiProperty({
    required: false,
    default: faker.datatype.number({ min: 20, max: 50 }),
    title: 'Capacity',
    type: 'number',
  })
  @IsOptional()
  capacity: number;

  @ApiProperty({
    required: false,
    name: 'files',
    type: 'array',
    items: {
      type: 'string',
      format: 'binary',
    },
  })
  @IsOptional()
  photos: string[];

  @ApiProperty({
    type: 'array',
    items: {
      type: 'string',
    },
    required: true,
  })
  @IsOptional()
  bookingDetails: string[];

  @ApiProperty({
    isArray: true,
    type: VendorTablesDto,
  })
  @IsOptional()
  @Transform(({ value }) => JSON.parse('[' + value + ']'))
  vendorTables: VendorTablesDto[];
}

export class UpdateBookingTableDto {
  @ApiProperty()
  @IsOptional()
  @IsNumber(
    {},
    { message: 'Table number field should be valid number........' },
  )
  tableNumber;

  @ApiProperty()
  @IsOptional({ message: 'Start Date field should not be empty........' })
  startTime: Date;

  @ApiProperty()
  @IsOptional({ message: 'End Date field should not be empty........' })
  endTime: Date;

  // @ApiProperty({
  //   required: true,
  //   title: 'bookingId',
  //   description: 'Is Required',
  //   type: 'string',
  //   examples: ['632b0c89da46b6aa88c84c4e'],
  // })
  // @IsMongoId({ message: 'Invalid reference of vendor.' })
  // @IsOptional({ message: 'Booking Id reference must be required.' })
  // bookingId: string;

  @ApiProperty()
  @IsOptional({ message: 'Price field should not be empty........' })
  tablePrice: number;
}
