import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { UsersService } from '@src/modules/identity/users/users.service';
import { OnesignalService } from '@src/infrastructure/push/onesignal/onesignal.service';
import { EmailService } from '@src/infrastructure/email/email.service';
import { loggers } from '@src/common/interceptors/logger.enums';
import { generateOtp } from '@src/common/utils/utils';
import { Response, ResponseObj } from '@src/common/responses/response';
import * as path from 'path';
import {
    LoginDto,
    ForgotPassword,
    PasswordReset,
    RegisterUserDto,
    UpdateTwoFactorPreferenceDto,
    VerifyLoginTwoFactorDto,
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
            const userInDb = await this.usersService.findOne({
                email: userDto.email,
            });
            if (userInDb)
                throw new HttpException(
                    'Email already exists',
                    HttpStatus.BAD_REQUEST,
                );

            if (file) {
                userDto.profileImage = `${this.configService.get(
                    'APP_URL',
                )}/upload/${file.filename}`;
            }
            const user = await this.usersService.create(userDto);
            const signupOtp = generateOtp();
            await this.prisma.user.update({
                where: { id: user.id },
                data: { otp: signupOtp },
            });
            const config = this.configService.get('EMAIL_SMTP');

            try {
                if (admin?.email) {
                    await this.emailService.sendMail({
                        template: 'emails/auth/signup-token',
                        message: {
                            to: admin.email,
                            subject: 'New Account Creation',
                            attachments: [
                                {
                                    filename: 'logo.svg',
                                    path: path.join(
                                        process.cwd(),
                                        'views',
                                        'logo.svg',
                                    ),
                                    cid: 'logo',
                                },
                            ],
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
                    template: 'emails/auth/signup-token',
                    message: {
                        to: userDto.email,
                        subject: 'New Account Creation',
                        attachments: [
                            {
                                filename: 'logo.svg',
                                path: path.join(
                                    process.cwd(),
                                    'views',
                                    'logo.svg',
                                ),
                                cid: 'logo',
                            },
                        ],
                    },
                    locals: {
                        config,
                        message: `Congratulations, ${userDto.name} your account has been created.`,
                        name: userDto.name,
                        otp: signupOtp,
                        date: new Date().getFullYear(),
                    },
                });
            } catch (emailError) {
                loggers.info(emailError);
            }

            return {
                success: true,
                message: 'User registered successfully',
                data: user,
            };
        } catch (err) {
            if (err?.code === 'P2002')
                throw new HttpException(
                    'Email already exists',
                    HttpStatus.BAD_REQUEST,
                );
            loggers.info(err);
            if (err instanceof HttpException) throw err;
            throw new HttpException(
                'Something went wrong.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async login(loginUserDto: LoginDto) {
        try {
            const user = await this.usersService.validateLoginCredentials(
                loginUserDto,
            );
            if (!user.twoFactorEnabled) {
                return this.completeLogin(user, loginUserDto.playerId);
            }

            const otp = generateOtp();
            const expiresInMinutes = 10;
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    twoFactorCode: otp,
                    twoFactorExpiresAt: new Date(
                        Date.now() + expiresInMinutes * 60 * 1000,
                    ),
                    twoFactorVerifiedAt: null,
                },
            });
            await this.sendTwoFactorOtp(user, otp, expiresInMinutes);
            return {
                success: true,
                requiresTwoFactor: true,
                message: `A login verification code has been sent to ${user.email}`,
                data: {
                    email: user.email,
                    role: user.role?.name ?? null,
                },
            };
        } catch (err) {
            if (err.status === 401)
                throw new HttpException(err.message, HttpStatus.UNAUTHORIZED);
            if (err instanceof HttpException) throw err;
            throw new HttpException(
                err.message,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async verifyLoginTwoFactor(payload: VerifyLoginTwoFactorDto) {
        const user = await this.prisma.user.findFirst({
            where: { email: payload.email, isDeleted: false },
            include: { role: true },
        });
        if (!user)
            throw new HttpException(
                'User does not exist',
                HttpStatus.UNAUTHORIZED,
            );
        if (!user.twoFactorCode || !user.twoFactorExpiresAt) {
            throw new HttpException(
                'No pending login verification code',
                HttpStatus.BAD_REQUEST,
            );
        }
        if (user.twoFactorCode !== payload.otp) {
            throw new HttpException(
                'Invalid login verification code',
                HttpStatus.BAD_REQUEST,
            );
        }
        if (user.twoFactorExpiresAt < new Date()) {
            throw new HttpException(
                'Login verification code has expired',
                HttpStatus.BAD_REQUEST,
            );
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                twoFactorCode: null,
                twoFactorExpiresAt: null,
                twoFactorVerifiedAt: new Date(),
            },
        });

        return this.completeLogin(user, payload.playerId);
    }

    async updateTwoFactorPreference(
        currentUser: { id: string },
        payload: UpdateTwoFactorPreferenceDto,
    ) {
        const user = await this.prisma.user.update({
            where: { id: currentUser.id },
            data: {
                twoFactorEnabled: payload.enabled,
                twoFactorCode: null,
                twoFactorExpiresAt: null,
                twoFactorVerifiedAt: null,
            },
            select: {
                id: true,
                email: true,
                role: { select: { name: true } },
                twoFactorEnabled: true,
            },
        });

        return {
            success: true,
            message: payload.enabled
                ? 'Two-factor authentication enabled'
                : 'Two-factor authentication disabled',
            data: {
                id: user.id,
                email: user.email,
                role: user.role?.name ?? null,
                twoFactorEnabled: user.twoFactorEnabled,
            },
        };
    }

    async refreshToken(token: string) {
        try {
            return await this.usersService.refreshAccessToken(token);
        } catch (err) {
            if (err instanceof HttpException) throw err;
            throw new HttpException(
                'Invalid refresh token',
                HttpStatus.UNAUTHORIZED,
            );
        }
    }

    async forgotPassword(forgotPasswordDto: ForgotPassword): Promise<Response> {
        try {
            forgotPasswordDto.otp = generateOtp();
            const user = await this.usersService.forgotPassword(
                forgotPasswordDto,
            );
            await this.sendPasswordOtp(user, forgotPasswordDto.otp);
            ResponseObj.success = true;
            ResponseObj.message = `An email has been sent to ${forgotPasswordDto.email} with verification pin`;
            ResponseObj.data = {};
            return ResponseObj;
        } catch (err) {
            if (err instanceof HttpException) throw err;
            throw new HttpException(
                'Something went wrong. Please try again later.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
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
                template: 'emails/auth/reset-password',
                message: {
                    to: payload.email,
                    subject: 'GLEE App Alert',
                    attachments: [
                        {
                            filename: 'logo.svg',
                            path: path.join(process.cwd(), 'views', 'logo.svg'),
                            cid: 'logo',
                        },
                    ],
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
            throw new HttpException(
                'Something went wrong. Please try again later.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
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
        if (!user)
            throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
        return user;
    }

    async userExists({ email }: { email: string }) {
        try {
            const user = await this.usersService.findOne({ email });
            if (!user)
                return {
                    success: true,
                    message: "User doesn't exist",
                    data: { isUserExists: false },
                };
            return {
                success: true,
                message: 'User Exists',
                data: { isUserExists: true },
            };
        } catch (err) {
            if (err instanceof HttpException) throw err;
            throw new HttpException(
                'Something went wrong. Please try again later.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getRoleByAuth(loginUserDto: LoginDto) {
        return this.usersService.getRoleByAuth(loginUserDto);
    }

    private async sendPasswordOtp(user: any, otp: number) {
        const config = this.configService.get('EMAIL_SMTP');
        await this.emailService.sendMail({
            template: 'emails/auth/forgot-password',
            message: {
                to: user.email,
                subject: 'GLEE OTP Alert',
                attachments: [
                    {
                        filename: 'logo.svg',
                        path: path.join(process.cwd(), 'views', 'logo.svg'),
                        cid: 'logo',
                    },
                ],
            },
            locals: { config, user, date: new Date().getFullYear(), otp },
        });
    }

    private async sendTwoFactorOtp(
        user: any,
        otp: number,
        expiresInMinutes: number,
    ) {
        await this.emailService.sendMail({
            template: 'emails/auth/two-factor',
            message: {
                to: user.email,
                subject: 'Your Glee login code',
                attachments: [
                    {
                        filename: 'logo.svg',
                        path: path.join(process.cwd(), 'views', 'logo.svg'),
                        cid: 'logo',
                    },
                ],
            },
            locals: {
                name: user.name,
                role: user.role?.name,
                otp,
                expiresInMinutes,
                date: new Date().getFullYear(),
            },
        });
    }

    private async completeLogin(user: any, playerId?: string) {
        const result = await this.usersService.issueTokens(user);

        if (result.user.role === UserRole.USER && playerId) {
            const oneSignalResponse =
                await this.oneSignalService.addUserToNotificationList(
                    result.user.id,
                    playerId,
                );
            if (!oneSignalResponse.success) {
                throw new HttpException(
                    oneSignalResponse.message,
                    HttpStatus.BAD_REQUEST,
                );
            }
            return {
                ...result,
                user: { ...result.user, oneSignalData: oneSignalResponse.data },
            };
        }

        return result;
    }
}
