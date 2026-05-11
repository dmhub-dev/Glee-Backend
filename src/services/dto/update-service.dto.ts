import { IsOptional, IsString, IsMongoId, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { faker } from '@faker-js/faker';

export class UpdateServiceDto {
  @ApiProperty({
    required: false,
    default: faker.commerce.department(),
    title: 'Service Name',
    description: 'Is Mandatory',
    type: 'string',
    examples: ['Catering Service'],
  })
  @IsString({ message: 'Invalid service name provided.' })
  @IsOptional()
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
  description: string;

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
    default: faker.address.streetAddress(true),
    title: 'Service Address',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsOptional()
  address: string;

  @ApiProperty({
    required: false,
    title: 'Category',
    description: 'Is Required',
    type: 'string',
    examples: ['632b0c89da46b6aa88c84c4e'],
  })
  @IsMongoId({ message: 'Invalid reference of category.' })
  @IsOptional()
  category: string;

  @ApiProperty({
    required: false,
    title: 'Vendor',
    description: 'Is Required',
    type: 'string',
    examples: ['632b0c89da46b6aa88c84c4e'],
  })
  @IsMongoId({ message: 'Invalid reference of vendor.' })
  @IsOptional()
  vendor: string;

  @ApiProperty({
    required: false,
    default: faker.datatype.number({ min: 500, max: 5000 }),
    title: 'Per Person Price',
    description: 'Is Required',
    type: 'number',
    examples: ['lorem epsum.'],
  })
  @IsOptional()
  // @Min(200)
  // @Max(10000)
  price: number;

  @ApiProperty({
    required: false,
    name: 'photos',
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
  serviceDetails: string[];
}

export class UpdateServiceDetailsDto {
  @ApiProperty()
  @IsArray()
  @IsOptional()
  deleteItems: string[];

  @ApiProperty()
  @IsArray()
  @IsOptional()
  addItems: string[];
}

export class UpdateVendorServiceDto {
  @ApiProperty({
    required: false,
    default: faker.commerce.department(),
    title: 'Service Name',
    description: 'Is Mandatory',
    type: 'string',
    examples: ['Catering Service'],
  })
  @IsString({ message: 'Invalid service name provided.' })
  @IsOptional()
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
  description: string;

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
    default: faker.address.streetAddress(true),
    title: 'Service Address',
    description: 'Is Optional',
    type: 'string',
    examples: ['lorem epsum.'],
  })
  @IsOptional()
  address: string;

  @ApiProperty({
    required: false,
    title: 'Category',
    description: 'Is Required',
    type: 'string',
    examples: ['632b0c89da46b6aa88c84c4e'],
  })
  @IsMongoId({ message: 'Invalid reference of category.' })
  @IsOptional()
  category: string;

  @ApiProperty({
    required: false,
    default: faker.datatype.number({ min: 500, max: 5000 }),
    title: 'Per Person Price',
    description: 'Is Required',
    type: 'number',
    examples: ['lorem epsum.'],
  })
  @IsOptional()
  // @Min(200)
  // @Max(10000)
  price: number;

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
  serviceDetails: string[];
}
