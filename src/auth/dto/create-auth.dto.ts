import {
    IsNotEmpty,
    IsEmail,
    IsOptional,
    IsEnum,
    IsNumber,
    IsString,
    MinLength,
    MaxLength,
    IsPhoneNumber,
    IsMongoId,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CountryCodes } from '@src/common/utils/countries';
import {
    IsMatchConfirmPassword,
    MinDigits,
    MinLowerCase,
    MinSpecialCharacter,
    MinUpperCase,
} from '@src/common/decorators/validation.decorators';
import { faker } from '@faker-js/faker';

export type UserRoleType = UserRole;

export class RegisterUserDto {
    @ApiProperty({
        required: true,
        default: faker.name.fullName(),
        title: 'Name',
        description: 'User name should be at three character.',
        type: 'string',
        examples: ['Ali', 'Imran'],
    })
    @IsNotEmpty({ message: 'Name should be required.' })
    @IsString({ message: 'Name Field should be valid string.' })
    @MinLength(3, { message: 'Name should be of minimum three character.' })
    name: string;

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
    @IsString()
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
    password: string;

    @ApiProperty({
        required: true,
        default: 'abAB**12',
        title: 'Confirm Password',
        description: 'Must match with password',
        type: 'string',
    })
    @IsNotEmpty({ message: 'Confirm Password should be required.' })
    @IsString({ message: 'Confirm Password should be a string.' })
    @IsMatchConfirmPassword('password', {
        message: 'Confirm password should be match with Password.',
    })
    confirmPassword: string;

    @ApiProperty({
        required: true,
        default: faker.internet.email(),
        title: 'Name',
        description:
            'At least 2 special character, 2 uppercase, 2 lowercase, 2 digits',
        type: 'string',
        examples: ['abAB**12', 'xA9yB0**'],
    })
    @IsNotEmpty({ message: 'Email should be required.' })
    @IsEmail({}, { message: 'Invalid email provided.' })
    email: string;

    @ApiProperty({
        required: true,
        default: faker.phone.number('+92 ### #######'),
        title: 'Phone Number',
        description:
            'Valid Phone number. It is better to follow this pattern (+92 xxx xxxxxxx)',
        type: 'string',
        examples: ['+92 342 2738117'],
    })
    @IsOptional()
    // @IsPhoneNumber(null, { message: 'Invalid phone number.' })
    phone: string;

    @ApiProperty({
        required: false,
    })
    @IsOptional()
    @IsMongoId({ message: 'Invalid State.' })
    state: string;

    @ApiProperty({
        required: true,
        type: 'string',
    })
    @IsOptional()
    @IsMongoId()
    @IsString()
    country: string;

    @ApiProperty({
        required: false,
        default: faker.address.streetAddress(true),
        title: 'Address',
        description: 'Is Mandatory',
        type: 'string',
        examples: ['PK'],
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

    @ApiProperty({
        title: 'UserRole',
        description: 'Is Mandatory',
        type: 'string',
        examples: ['USER'],
        required: true,
        default: UserRole.USER,
        enum: UserRole,
    })
    @IsOptional()
    @IsEnum(UserRole, { message: 'Invalid role provided.' })
    role: UserRole;

    @IsOptional()
    @ApiProperty({
        required: false,
        name: 'file',
        type: 'string',
        format: 'binary',
    })
    profileImage: string;
}

export class LoginDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty()
    @IsNotEmpty()
    password: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    role: string = UserRole.USER;

    @ApiProperty()
    @IsOptional()
    @IsString()
    playerId?: string;
}

export class VerifyLoginTwoFactorDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ type: Number })
    @IsNotEmpty()
    @IsNumber()
    otp: number;

    @ApiProperty()
    @IsOptional()
    @IsString()
    playerId?: string;
}

export class ForgotPassword {
    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    otp: number;
}

export class PasswordReset {
    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    @MaxLength(20)
    // @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {message: 'password too weak'})
    password: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    @MaxLength(20)
    @IsMatchConfirmPassword('password', {
        message: 'Password and Confirm Password Fields does not matched....',
    })
    confirmPassword: string;

    @ApiProperty({ type: Number })
    @IsNotEmpty()
    @IsNumber()
    otp: number;
}

export class VerifyOtpDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ type: Number })
    @IsNotEmpty()
    @IsNumber()
    otp: number;
}

export enum SocialTypes {
    FACEBOOK = 'facebook',
    GOOGLE = 'google',
    APPLE = 'APPLE',
}

export class SocialRegister {
    @ApiProperty({ enum: ['facebook', 'google', 'apple'] })
    @IsNotEmpty()
    type: SocialTypes;

    @ApiProperty()
    @IsNotEmpty()
    socialId: string;

    @ApiProperty()
    @IsOptional()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ type: String })
    @IsNotEmpty()
    @IsString()
    @IsOptional()
    name: string;
}

export class RegisterVendorDto {
    @ApiProperty({
        required: true,
        title: 'Name',
    })
    @IsOptional()
    @IsString()
    username: string;

    @ApiProperty({
        required: true,
        title: 'Bussiness Name',
    })
    @IsOptional()
    @IsString()
    bussiness_name: string;

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
    @IsString()
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
    password: string;

    @ApiProperty({
        required: true,
        default: 'abAB**12',
        title: 'Confirm Password',
        description: 'Must match with password',
        type: 'string',
    })
    @IsNotEmpty({ message: 'Confirm Password should be required.' })
    @IsString({ message: 'Confirm Password should be a string.' })
    @IsMatchConfirmPassword('password', {
        message: 'Confirm password should be match with Password.',
    })
    confirmPassword: string;

    @ApiProperty({
        required: true,
        default: faker.internet.email(),
        title: 'Name',
        description:
            'At least 2 special character, 2 uppercase, 2 lowercase, 2 digits',
        type: 'string',
        examples: ['abAB**12', 'xA9yB0**'],
    })
    @IsNotEmpty({ message: 'Email should be required.' })
    @IsEmail({}, { message: 'Invalid email provided.' })
    email: string;

    @IsOptional()
    @ApiProperty({
        required: false,
        name: 'file',
        type: 'string',
        format: 'binary',
    })
    profileImage: string;
}

export class LoginVendorDto {
    @ApiProperty()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty()
    @IsNotEmpty()
    password: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    role: string = UserRole.VENDOR;
}
