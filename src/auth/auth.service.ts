import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, UserRole } from '@prisma/client';
import { UsersService } from '@src/modules/identity/users/users.service';
import { OnesignalService } from '@src/infrastructure/push/onesignal/onesignal.service';
import { EmailService } from '@src/infrastructure/email/email.service';
import { loggers } from '@src/common/interceptors/logger.enums';
import { generateOtp } from '@src/common/utils/utils';
import { comparePasswords } from '@src/common/utils/utils';
import { Response, ResponseObj } from '@src/common/responses/response';
import * as bcrypt from 'bcrypt';
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
            const userInDb = await this.prisma.user.findFirst({
                where: { email: userDto.email, isDeleted: false },
                include: { role: true },
            });
            if (userInDb && (userInDb.isActive === AccountStatus.ACTIVE || userInDb.role?.name !== UserRole.USER))
                throw new HttpException(
                    'Email already exists',
                    HttpStatus.BAD_REQUEST,
                );

            if (file) {
                userDto.profileImage = `${this.configService.get(
                    'APP_URL',
                )}/upload/${file.filename}`;
            }
            const signupOtp = generateOtp();
            let user;
            if (userInDb) {
                const password = await bcrypt.hash(userDto.password, 10);
                user = await this.prisma.user.update({
                    where: { id: userInDb.id },
                    data: {
                        name: userDto.name,
                        password,
                        phone: userDto.phone,
                        address: userDto.address,
                        profileImage: userDto.profileImage,
                        otp: signupOtp,
                        isActive: AccountStatus.INACTIVE,
                        role: { connect: { name: UserRole.USER } },
                    },
                    include: { role: true },
                });
            } else {
                userDto.role = UserRole.USER;
                (userDto as any).isActive = AccountStatus.INACTIVE;
                user = await this.usersService.create(userDto);
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { otp: signupOtp, isActive: AccountStatus.INACTIVE },
                });
            }
            const config = this.configService.get('EMAIL_SMTP');

            try {
                if (admin?.email) {
                    await this.emailService.sendMail({
                        template: 'emails/auth/signup-token',
                        message: {
                            to: admin.email,
                            subject: 'New Account Creation',
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
                message: 'Verification code sent. Please confirm your email to activate your account.',
                data: { id: user.id, email: user.email, name: user.name },
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

    async confirmRegistration(payload: VerifyOtpDto) {
        const user = await this.prisma.user.findFirst({
            where: {
                email: payload.email,
                otp: payload.otp,
                role: { name: UserRole.USER },
                isDeleted: false,
            },
            include: { role: true },
        });

        if (!user) {
            throw new HttpException(
                { message: 'Invalid OTP', isOtpInvalid: true, success: false },
                HttpStatus.BAD_REQUEST,
            );
        }

        const activated = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                otp: null,
                isActive: AccountStatus.ACTIVE,
                profileStatus: true,
            },
            include: { role: true },
        });

        await this.prisma.wallet.upsert({
            where: { userId: activated.id },
            update: {},
            create: { userId: activated.id },
        });

        return {
            success: true,
            message: 'Account verified successfully. You can now sign in.',
            data: {
                id: activated.id,
                email: activated.email,
                name: activated.name,
                role: activated.role?.name ?? null,
            },
        };
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

    async updateMe(
        currentUser: { id: string },
        payload: { firstName?: string; lastName?: string; name?: string; phone?: string; address?: string },
    ) {
        const current = await this.prisma.user.findUnique({
            where: { id: currentUser.id },
            select: { name: true, profileStatus: true },
        });
        if (!current) {
            throw new HttpException('User not found', HttpStatus.NOT_FOUND);
        }

        const fallbackParts = (current.name ?? '').split(' ');
        const firstName = payload.firstName ?? fallbackParts[0] ?? '';
        const lastName = payload.lastName ?? fallbackParts.slice(1).join(' ');
        const name = payload.name ?? [firstName, lastName].filter(Boolean).join(' ').trim();

        const user = await this.prisma.user.update({
            where: { id: currentUser.id },
            data: {
                ...(name ? { name } : {}),
                ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
                ...(payload.address !== undefined ? { address: payload.address } : {}),
                ...(name && payload.phone ? { profileStatus: true } : {}),
            },
            include: { role: true },
        });

        return { success: true, data: user };
    }

    async changeMyPassword(
        currentUser: { id: string },
        payload: { currentPassword: string; newPassword: string },
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: currentUser.id },
            select: { id: true, password: true },
        });
        if (!user) {
            throw new HttpException('User not found', HttpStatus.NOT_FOUND);
        }

        const valid = await comparePasswords(user.password, payload.currentPassword);
        if (!valid) {
            throw new HttpException('Current password is incorrect', HttpStatus.BAD_REQUEST);
        }

        const password = await bcrypt.hash(payload.newPassword, 10);
        await this.prisma.user.update({
            where: { id: currentUser.id },
            data: { password },
        });

        return { success: true, message: 'Password updated successfully' };
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
