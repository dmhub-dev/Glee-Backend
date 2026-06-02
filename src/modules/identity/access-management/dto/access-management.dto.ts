import { AccountStatus, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    ArrayNotEmpty,
    IsArray,
    IsEmail,
    IsEnum,
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateIf,
} from 'class-validator';

export class InviteUserDto {
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    @IsEnum(UserRole)
    role: UserRole;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(30)
    expiresInDays?: number;
}

export class AcceptInvitationDto {
    @IsString()
    @MinLength(8)
    @MaxLength(20)
    @Matches(/[A-Z]/, { message: 'Password must include an uppercase letter' })
    @Matches(/[a-z]/, { message: 'Password must include a lowercase letter' })
    @Matches(/[0-9]/, { message: 'Password must include a number' })
    @Matches(/[^A-Za-z0-9]/, { message: 'Password must include a special character' })
    password: string;

    @IsString()
    confirmPassword: string;
}

export class ListUsersQueryDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsOptional()
    @IsEnum(AccountStatus)
    status?: AccountStatus;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @IsOptional()
    @IsEnum(AccountStatus)
    isActive?: AccountStatus;

    @IsOptional()
    @IsBoolean()
    twoFactorEnabled?: boolean;
}

export class UpdateRolePermissionsDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    permissions: string[];
}

export class UpdateRoleTwoFactorPolicyDto {
    @IsBoolean()
    required: boolean;
}

export class ListAuditLogsQueryDto {
    @IsOptional()
    @IsString()
    actorId?: string;

    @IsOptional()
    @IsString()
    action?: string;

    @IsOptional()
    @IsString()
    entity?: string;

    @IsOptional()
    @ValidateIf((_, value) => value !== '')
    @IsString()
    entityId?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
