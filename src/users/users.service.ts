import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { UserRole, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { comparePasswords } from '../shared/utils';
import {
  LoginDto,
  LoginVendorDto,
  RegisterUserDto,
  RegisterVendorDto,
  VerifyOtpDto,
} from '../auth/dto/create-auth.dto';

export const USER_PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  state: true,
  country: true,
  profileImage: true,
  role: true,
  vendorId: true,
  vendor: true,
  notificationStatus: true,
  profileStatus: true,
  haveNewNotification: true,
  isAllChatRead: true,
  notificationIds: true,
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

  async readChat(id: string) {
    return this.prisma.user.update({ where: { id }, data: { isAllChatRead: true } });
  }

  async findByLogin({ email, password, role }: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email, role: { name: role as UserRole }, isDeleted: false },
      include: { city: true, state: true, country: true },
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

    const token = await this._createToken(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { token: token.accessToken, profileStatus: true },
    });

    return this._toAuthData({ ...user, token: token.accessToken });
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

  async findByVendorLogin({ email, password, role }: LoginVendorDto) {
    const user = await this.prisma.user.findFirst({
      where: { email, role: { name: role as UserRole }, isDeleted: false },
      include: { vendor: true, city: true, state: true, country: true },
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

    const token = await this._createToken(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { token: token.accessToken, profileStatus: true },
    });

    return this._toAuthData({ ...user, token: token.accessToken });
  }

  async findByPayload(payload: { userId: string }) {
    return this.prisma.user.findFirst({
      where: { id: payload.userId, isDeleted: false },
      select: USER_PUBLIC_FIELDS,
    });
  }

  async create(userDto: RegisterUserDto) {
    const { password, country, state, city, confirmPassword, ...rest } = userDto as any;
    const hashed = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        ...rest,
        password: hashed,
        notificationIds: [],
        role: { connect: { name: UserRole.USER } },
      },
    });
  }

  async createVendorAuth(dto: RegisterVendorDto, vendorId: string) {
    const password = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        name: (dto as any).username,
        password,
        email: dto.email,
        role: { connect: { name: UserRole.VENDOR } },
        isActive: 'INACTIVE' as any,
        vendorId,
        notificationIds: [],
      } as any,
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

  private async _createToken(user: Pick<User, 'id' | 'email'> & { roleId?: string | null }) {
    const expiresIn = process.env.EXPIRESIN;
    let permissions: string[] = [];
    if (user.roleId) {
      const roleWithPerms = await this.prisma.role.findUnique({
        where: { id: user.roleId },
        include: { permissions: { include: { permission: true } } },
      });
      permissions = roleWithPerms?.permissions.map(rp => rp.permission.name) ?? [];
    }
    const payload = { userId: user.id, email: user.email, permissions };
    const accessToken = this.jwtService.sign(payload);
    return { expiresIn, accessToken };
  }

  private _toAuthData(user: any) {
    const fields = Object.keys(USER_AUTH_FIELDS);
    return fields.reduce((acc, k) => ({ ...acc, [k]: user[k] }), {});
  }
}
