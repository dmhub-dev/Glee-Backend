import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserFiter } from '../enums/user-type.enum';
import { Transform } from 'class-transformer';
import { toBoolean } from 'src/shared/cast.helper';
import { AccountStatus } from '@prisma/client';
import { CountryCodes } from 'src/shared/countries';
import { faker } from '@faker-js/faker';
import { PaginationQueryDto } from '@src/event/dto/pagination-query.dto';

export class UserDto extends PaginationQueryDto {
  @Transform(({ value }) => toBoolean(value))
  @ApiProperty({
    required: false,
    enum: UserFiter,
  })
  @IsOptional()
  isDeleted: boolean;

  @ApiProperty({
    required: false,
    default: AccountStatus.ACTIVE,
    enum: AccountStatus,
  })
  @IsOptional()
  @IsEnum(AccountStatus, { message: 'Invalid Account Status provided.' })
  status: AccountStatus;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  search: string;
}

export class AddCommissionDto {
  @ApiProperty({
    required: true,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  commission: number;
}

export class AdminUserProfileUpdateDto {
  @ApiProperty()
  @IsMongoId({ message: 'Invalid User Id Provided...' })
  @IsNotEmpty()
  userId: string;

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
  @IsEmail({}, { message: 'Invalid email provided.' })
  email: string;

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

export class UserStatusAndNotificationAdminDto {
  @ApiProperty()
  @IsMongoId({ message: 'Invalid User Id Provided...' })
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    default: AccountStatus.ACTIVE,
  })
  @IsNotEmpty()
  @IsString()
  @IsEnum(AccountStatus, { message: 'Invalid status provided' })
  isActive: AccountStatus = AccountStatus.ACTIVE;
}
