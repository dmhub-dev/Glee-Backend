import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { OnesignalService } from '@src/onesignal/onesignal.service';
import { EmailService } from '@src/email-server/email.service';
import { loggers } from '@src/interceptors/logger.enums';
import { generateOtp } from '../shared/utils';
import { Response, ResponseObj } from '../shared/response';
import * as path from 'path';
import {
  LoginDto,
  ForgotPassword,
  PasswordReset,
  RegisterUserDto,
  VerifyOtpDto,
} from './dto/create-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly oneSignalService: OnesignalService,
    public configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(userDto: RegisterUserDto, file?: Express.Multer.File) {
    try {
      const admin = await this.prisma.user.findFirst({
        where: { role: { name: UserRole.ADMIN } },
        select: { email: true },
      });
      const userInDb = await this.usersService.findOne({ email: userDto.email });
      if (userInDb) throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);

      if (file) {
        userDto.profileImage = `${this.configService.get('APP_URL')}/upload/${file.filename}`;
      }
      const user = await this.usersService.create(userDto);
      const config = this.configService.get('EMAIL_SMTP');

      try {
        if (admin?.email) {
          await this.emailService.sendMail({
            template: 'new-account',
            message: {
              to: admin.email,
              subject: 'New Account Creation',
              attachments: [{ filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' }],
            },
            locals: {
              config,
              message: `${userDto.name} has registered in Glee App.`,
              linkText: 'Please visit the dashboard',
              link: 'https://glee-admin.appnofy.com/user-management',
              name: 'Admin',
              date: new Date().getFullYear(),
            },
          });
        }

        await this.emailService.sendMail({
          template: 'new-account',
          message: {
            to: userDto.email,
            subject: 'New Account Creation',
            attachments: [{ filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' }],
          },
          locals: {
            config,
            message: `Congratulations, ${userDto.name} your account has been created.`,
            name: userDto.name,
            date: new Date().getFullYear(),
          },
        });
      } catch (emailError) {
        loggers.info(emailError);
      }

      return { success: true, message: 'User registered successfully', data: user };
    } catch (err) {
      if (err?.code === 'P2002') throw new HttpException('Email already exists', HttpStatus.BAD_REQUEST);
      loggers.info(err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Something went wrong.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async login(loginUserDto: LoginDto) {
    try {
      const result = await this.usersService.findByLogin(loginUserDto);
      if (result.user.role === UserRole.USER) {
        const oneSignalResponse = await this.oneSignalService.addUserToNotificationList(
          result.user.id,
          (loginUserDto as any).playerId,
        );
        if (!oneSignalResponse.success)
          throw new HttpException(oneSignalResponse.message, HttpStatus.BAD_REQUEST);
        return { ...result, user: { ...result.user, oneSignalData: oneSignalResponse.data } };
      }
      return result;
    } catch (err) {
      if (err.status === 401) throw new HttpException(err.message, HttpStatus.UNAUTHORIZED);
      if (err instanceof HttpException) throw err;
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async refreshToken(token: string) {
    try {
      return await this.usersService.refreshAccessToken(token);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
  }

  async forgotPassword(forgotPasswordDto: ForgotPassword): Promise<Response> {
    try {
      forgotPasswordDto.otp = generateOtp();
      const user = await this.usersService.forgotPassword(forgotPasswordDto);
      await this.sendPasswordOtp(user, forgotPasswordDto.otp);
      ResponseObj.success = true;
      ResponseObj.message = `An email has been sent to ${forgotPasswordDto.email} with verification pin`;
      ResponseObj.data = {};
      return ResponseObj;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('Something went wrong. Please try again later.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async resetPassword(payload: PasswordReset): Promise<Response> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { email: payload.email },
        select: { id: true, email: true, name: true },
      });
      await this.usersService.resetPassword(payload);
      const config = this.configService.get('EMAIL_SMTP');
      await this.emailService.sendMail({
        template: 'confirmation-email',
        message: {
          to: payload.email,
          subject: 'GLEE App Alert',
          attachments: [{ filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' }],
        },
        locals: { config, user, date: new Date().getFullYear() },
      });
      ResponseObj.success = true;
      ResponseObj.message = `Password reset successfully`;
      ResponseObj.data = {};
      return ResponseObj;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw err;
    }
  }

  async verifyOtpService(payload: VerifyOtpDto): Promise<Response> {
    try {
      return this.usersService.verifyOtp(payload);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('Something went wrong. Please try again later.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async testAuth(user: any) {
    const full = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });
    return { success: true, data: full };
  }

  async validateUser(payload: { userId: string }) {
    const user = await this.usersService.findByPayload(payload);
    if (!user) throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    return user;
  }

  async userExists({ email }: { email: string }) {
    try {
      const user = await this.usersService.findOne({ email });
      if (!user) return { success: true, message: "User doesn't exist", data: { isUserExists: false } };
      return { success: true, message: 'User Exists', data: { isUserExists: true } };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException('Something went wrong. Please try again later.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getRoleByAuth(loginUserDto: LoginDto) {
    return this.usersService.getRoleByAuth(loginUserDto);
  }

  private async sendPasswordOtp(user: any, otp: number) {
    const config = this.configService.get('EMAIL_SMTP');
    await this.emailService.sendMail({
      template: 'forget-pass',
      message: {
        to: user.email,
        subject: 'GLEE OTP Alert',
        attachments: [{ filename: 'logo.svg', path: path.join(process.cwd(), 'views', 'logo.svg'), cid: 'logo' }],
      },
      locals: { config, user, date: new Date().getFullYear(), otp },
    });
  }
}
