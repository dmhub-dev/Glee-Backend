import { faker } from '@faker-js/faker';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AccountStatusUser } from 'src/schemas/enums/status';
import { CountryCodes } from 'src/shared/countries';
import { MinDigits, MinUpperCase } from '@src/decorators/validation.decorators';

export class UserProfileUpdateDto {
  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Name Field should be valid string.' })
  @MinLength(3, { message: 'Name should be of minimum three character.' })
  name: string;

  //   @ApiProperty({
  //     required: true,
  //     default: faker.internet.email(),
  //     title: 'Name',
  //     description:
  //       'At least 2 special character, 2 uppercase, 2 lowercase, 2 digits',
  //     type: 'string',
  //     examples: ['abAB**12', 'xA9yB0**'],
  //   })
  //   @IsNotEmpty({ message: 'Email should be required.' })
  //   @IsEmail({}, { message: 'Invalid email provided.' })
  //   email: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber(null, { message: 'Invalid phone number.' })
  phone: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsMongoId({ message: 'Invalid State.' })
  state: string;

  @ApiProperty({
    required: false,
    title: 'Country Code',
    type: 'string',
  })
  @IsOptional()
  @IsMongoId()
  @IsString()
  country: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  address: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  city: string;

  @IsOptional()
  @ApiProperty({
    required: false,
    name: 'file',
    type: 'string',
    format: 'binary',
  })
  profileImage: string;
}

export class UserStatusAndNotificationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notificationStatus: boolean = true;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  profileStatus: boolean;
}

export class UpdatePasswordDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  currentPassword: string;

  @ApiProperty({
    required: true,
    default: 'abAB**12',
    title: 'Password',
    description:
      'At least 2 special character, 2 uppercase, 2 lowercase, 2 digits',
    type: 'string',
    examples: ['abAB**12', 'xA9yB0**'],
  })
  @IsNotEmpty({ message: 'Password should be required.' })
  @MinLength(6, {
    message: 'Weak password, at least six characters required.',
  })
  @MaxLength(20, {
    message: 'Too long password, at max twenty characters required.',
  })
  // @MinSpecialCharacter(2, {
  //   message: 'Weak password, at least two special characters required.',
  // })
  @MinUpperCase(1, {
    message: 'Weak password, at least one uppercase characters required.',
  })
  // @MinLowerCase(2, {
  //   message: 'Weak password, at least two lowercase characters required.',
  // })
  @MinDigits(1, {
    message: 'Weak password, at least one numeric characters required.',
  })
  @IsString()
  newPassword: string;
}
