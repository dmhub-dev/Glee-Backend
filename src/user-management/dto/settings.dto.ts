import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { AccountStatus } from '../../schemas/enums/status';
import { CountryCodes } from '../../shared/countries';
import { faker } from '@faker-js/faker';

export class UpdateAdminProfileDto {
  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Name Field should be valid string.' })
  @MinLength(3, { message: 'Name should be of minimum three character.' })
  name: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber(null, { message: 'Invalid phone number.' })
  phone: string;

  // @ApiProperty({
  //   required: false,
  // })
  // @IsOptional()
  // @IsString({ message: 'Invalid State.' })
  // state: string = 'ALL';

  // @ApiProperty({
  //   enum: CountryCodes,
  //   required: false,
  //   default:
  //     CountryCodes[
  //       faker.datatype.number({ min: 0, max: CountryCodes.length - 1 })
  //     ],
  //   title: 'Country Code',
  //   type: 'string',
  //   examples: ['PK'],
  // })
  // @IsOptional()
  // @IsEnum(CountryCodes, { message: 'Invalid Country.' })
  // country: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  address: string;

  // @ApiProperty({
  //   required: false,
  // })
  // @IsOptional()
  // @IsString()
  // city: string;

  @IsOptional()
  @ApiProperty({
    required: false,
    name: 'file',
    type: 'string',
    format: 'binary',
  })
  profileImage: string;
}

export class AddContactInfoDTO {
  @ApiProperty({
    required: false,
  })
  @IsNotEmpty({ message: 'Link is missing.' })
  @IsUrl({}, { message: 'Link should be valid url.' })
  link: string;

  @ApiProperty({
    required: false,
  })
  @IsNotEmpty({ message: 'Name is missing.' })
  @IsString({ message: 'Name should be valid string.' })
  name: string;

  @ApiProperty({
    required: false,
  })
  @IsNotEmpty({ message: 'Icon is missing.' })
  // @IsUrl({}, { message: 'Icon should be valid url.' })
  icon: string;
}

export class UpdateContactInfoDTO {
  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsUrl({}, { message: 'Link should be valid url.' })
  link: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Name should be valid string.' })
  name: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  // @IsUrl({}, { message: 'Icon should be valid url.' })
  icon: string;
}

export class UploadImageDto {
  @ApiProperty({
    name: 'file',
    type: 'string',
    format: 'binary',
  })
  file: string;
}
