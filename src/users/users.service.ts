import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { UserRole, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { comparePasswords } from '../shared/utils';
import {
  LoginDto,
  RegisterUserDto,
  VerifyOtpDto,
} from '../auth/dto/create-auth.dto';

export const USER_PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  profileImage: true,
  role: true,
  notificationStatus: true,
  profileStatus: true,
  haveNewNotification: true,
};

export const USER_AUTH_FIELDS = {
  ...USER_PUBLIC_FIELDS,
  token: true,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async findOne(where: { id?: string; email?: string; otp?: number }) {
    return this.prisma.user.findFirst({ where: { ...where, isDeleted: false } });
  }

  async findByLogin({ email, password, role }: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email, role: { name: role as UserRole }, isDeleted: false },
      include: { role: true },
    });

    if (!user) throw new HttpException('User does not exist', HttpStatus.UNAUTHORIZED);

    const areEqual = await comparePasswords(user.password, password);
    if (!areEqual) throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);

    if (user.isActive === 'INACTIVE') {
      throw new HttpException(
        `Account has been ${user.isActive}. Please contact your administrator.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const { accessToken, refreshToken } = await this._createToken(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { token: accessToken, refreshToken, profileStatus: true },
    });

    return {
      user: this._toUserDto(user),
      accessToken,
      refreshToken,
    };
  }

  async getRoleByAuth({ email, password }: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email, isDeleted: false },
      include: { role: true },
    });
    if (!user) throw new HttpException('User does not exist', HttpStatus.UNAUTHORIZED);

    const areEqual = await comparePasswords(user.password, password);
    if (!areEqual) throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);

    if (user.isActive === 'INACTIVE') {
      throw new HttpException(
        `Account has been ${user.isActive}. Please contact your administrator.`,
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
  }

  async findByPayload(payload: { userId: string }) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.userId, isDeleted: false },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });
    if (!user) return null;
    const permissions = user.role?.permissions.map(rp => rp.permission.name) ?? [];
    return { ...user, permissions };
  }

  async create(userDto: RegisterUserDto) {
    const { password, confirmPassword, ...rest } = userDto as any;
    const hashed = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        ...rest,
        password: hashed,
        role: { connect: { name: UserRole.USER } },
      },
    });
  }

  async forgotPassword(data: { email: string; otp: number }) {
    const user = await this.prisma.user.findFirst({ where: { email: data.email } });
    if (!user) throw new HttpException("User doesn't exist", HttpStatus.BAD_REQUEST);
    return this.prisma.user.update({ where: { id: user.id }, data: { otp: data.otp } });
  }

  async resetPassword(data: { email: string; otp: number; password: string }) {
    const user = await this.prisma.user.findFirst({ where: { email: data.email } });
    if (!user) throw new HttpException('Invalid user email', HttpStatus.BAD_REQUEST);
    if (user.otp !== data.otp) {
      throw new HttpException({ message: 'Invalid OTP', isOtpInvalid: true }, HttpStatus.BAD_REQUEST);
    }
    const password = await bcrypt.hash(data.password, 10);
    return this.prisma.user.update({
      where: { id: user.id },
      data: { password, otp: null },
      select: USER_PUBLIC_FIELDS,
    });
  }

  async verifyOtp(data: VerifyOtpDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: data.email, otp: data.otp },
    });
    if (!user) {
      throw new HttpException(
        { message: 'Invalid OTP', isOtpInvalid: true, success: false },
        HttpStatus.BAD_REQUEST,
      );
    }
    return { success: true, message: 'Otp has been verified', data };
  }

  async refreshAccessToken(incomingRefreshToken: string) {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken: incomingRefreshToken, isDeleted: false },
      include: { role: true },
    });
    if (!user) throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    if (user.isActive === 'INACTIVE') {
      throw new HttpException('Account is inactive', HttpStatus.UNAUTHORIZED);
    }
    const { accessToken, refreshToken } = await this._createToken(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { token: accessToken, refreshToken },
    });
    return { accessToken, refreshToken };
  }

  private async _createToken(user: Pick<User, 'id' | 'name' | 'email'> & { roleId?: string | null; role?: { name: string } | null }) {
    const roleName = (user.role?.name ?? '') as UserRole;
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleName,
      isSuperAdmin: roleName === UserRole.SUPER_ADMIN,
      isAdmin: roleName === UserRole.ADMIN,
      isOperationsManager: roleName === UserRole.OPERATIONS_MANAGER,
      isCommercialManager: roleName === UserRole.COMMERCIAL_MANAGER,
      isFinance: roleName === UserRole.FINANCE,
      isVendor: roleName === UserRole.VENDOR,
      isVendorStaff: roleName === UserRole.VENDOR_STAFF,
      isCustomerSupport: roleName === UserRole.CUSTOMER_SUPPORT,
      isContentManager: roleName === UserRole.CONTENT_MANAGER,
      isUser: roleName === UserRole.USER,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.EXPIRESIN ?? '1d',
    });
    const refreshToken = this.jwtService.sign({ id: user.id }, {
      expiresIn: process.env.REFRESH_EXPIRESIN ?? '30d',
    });
    return { accessToken, refreshToken };
  }

  private _toUserDto(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name ?? null,
      profileImage: user.profileImage ?? null,
      profileStatus: user.profileStatus,
      notificationStatus: user.notificationStatus,
    };
  }
}
