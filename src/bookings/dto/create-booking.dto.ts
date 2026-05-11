import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { faker } from '@faker-js/faker';
import { Transform } from 'class-transformer';

export class CreateBookingDto {
  @ApiProperty({
    required: true,
    default: faker.commerce.department(),
    title: 'Booking Name',
    description: 'Is Mandatory',
    type: 'string',
  })
  @IsString({ message: 'Invalid booking name provided.' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    required: false,
    default: faker.lorem.lines(4),
    title: 'Booking Description',
    description: 'Is Optional',
    type: 'string',
  })
  @IsOptional()
  @IsString({ message: 'Invalid booking description provided.' })
  description: string;

  @ApiProperty({
    required: true,
    default: faker.address.streetAddress(true),
    title: 'booking Address',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsString({ message: 'Invalid booking address provided.' })
  @IsNotEmpty()
  address: string;

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
  bookingDetails: string[];

  @ApiProperty()
  @IsNotEmpty({ message: 'Capacity field should not be empty........' })
  capacity: number;

  @ApiProperty()
  // @IsNumber()
  @IsNotEmpty({ message: 'Latitude field should not be empty........' })
  latitude: number;

  @ApiProperty()
  // @IsNumber()
  @IsNotEmpty({ message: 'Longitude field should not be empty........' })
  longitude: number;

  @ApiProperty()
  @IsNotEmpty({ message: 'Price field should not be empty........' })
  price: number;

  @ApiProperty({
    required: false,
    name: 'files',
    title: 'Photos',
    type: 'array',
    items: {
      title: 'booking Image',
      type: 'string',
      format: 'binary',
    },
  })
  photos: string[];

  @ApiProperty()
  @IsNotEmpty({ message: 'Start Date field should not be empty........' })
  startTime: Date;

  @ApiProperty()
  @IsNotEmpty({ message: 'End Date field should not be empty........' })
  endTime: Date;
}

export class TablesDto {
  @ApiProperty({ type: 'number' })
  @IsOptional()
  @IsNumber(
    {},
    { message: 'Table number field should be valid number........' },
  )
  tableNumber: number;

  @ApiProperty()
  @IsNotEmpty({ message: 'Start Date field should not be empty........' })
  startTime: Date;

  @ApiProperty()
  @IsNotEmpty({ message: 'End Date field should not be empty........' })
  endTime: Date;

  @ApiProperty({
    required: true,
    title: 'bookingId',
    description: 'Is Required',
    type: 'string',
    examples: ['632b0c89da46b6aa88c84c4e'],
  })
  @IsMongoId({ message: 'Invalid reference of vendor.' })
  @IsNotEmpty({ message: 'Booking Id reference must be required.' })
  bookingId: string;

  @ApiProperty()
  @IsNotEmpty({ message: 'Price field should not be empty........' })
  @Min(1, { message: 'Minimum value should be 1........' })
  tablePrice: number;
}

export class CreateBookingTableDto {
  @ApiProperty({
    type: TablesDto,
    isArray: true,
  })
  tables: TablesDto[];
}

export class VendorTablesDto {
  @ApiProperty({ type: 'number' })
  @IsOptional()
  @IsNumber(
    {},
    { message: 'Table number field should be valid number........' },
  )
  tableNumber: number;

  @ApiProperty()
  @IsNotEmpty({ message: 'Start Date field should not be empty........' })
  startTime: Date;

  @ApiProperty()
  @IsNotEmpty({ message: 'End Date field should not be empty........' })
  endTime: Date;

  @ApiProperty()
  @IsNotEmpty({ message: 'Price field should not be empty........' })
  @Min(1, { message: 'Minimum value should be 1........' })
  tablePrice: number;
}


export class CreateVendorBookingDto {
  @ApiProperty({
    required: true,
    default: faker.commerce.department(),
    title: 'Booking Name',
    description: 'Is Mandatory',
    type: 'string',
  })
  @IsString({ message: 'Invalid booking name provided.' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    required: false,
    default: faker.lorem.lines(4),
    title: 'Booking Description',
    description: 'Is Optional',
    type: 'string',
  })
  @IsOptional()
  @IsString({ message: 'Invalid booking description provided.' })
  description: string;

  @ApiProperty({
    required: true,
    default: faker.address.streetAddress(true),
    title: 'booking Address',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsString({ message: 'Invalid booking address provided.' })
  @IsNotEmpty()
  address: string;

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
  bookingDetails: string[];

  @ApiProperty()
  @IsNotEmpty({ message: 'Capacity field should not be empty........' })
  capacity: number;

  @ApiProperty()
  // @IsNumber()
  @IsNotEmpty({ message: 'Latitude field should not be empty........' })
  latitude: number;

  @ApiProperty()
  // @IsNumber()
  @IsNotEmpty({ message: 'Longitude field should not be empty........' })
  longitude: number;

  @ApiProperty()
  @IsNotEmpty({ message: 'Price field should not be empty........' })
  price: number;

  @ApiProperty({
    required: false,
    name: 'files',
    title: 'Photos',
    type: 'array',
    items: {
      title: 'booking Image',
      type: 'string',
      format: 'binary',
    },
  })
  photos: string[];

  @ApiProperty()
  @IsNotEmpty({ message: 'Start Date field should not be empty........' })
  startTime: Date;

  @ApiProperty()
  @IsNotEmpty({ message: 'End Date field should not be empty........' })
  endTime: Date;

  @ApiProperty({
    isArray: true,
    type: VendorTablesDto,
  })
  @Transform(({ value }) => JSON.parse('[' + value + ']'))
  vendorTables: VendorTablesDto[];
}