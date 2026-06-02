import { HttpException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

describe('AuthService role login and 2FA', () => {
    const roles = Object.values(UserRole);
    let service: AuthService;
    let prisma: any;
    let usersService: any;
    let emailService: any;
    let oneSignalService: any;

    beforeEach(() => {
        prisma = {
            user: {
                update: jest.fn().mockResolvedValue({}),
                findFirst: jest.fn(),
                findUnique: jest.fn(),
            },
        };
        usersService = {
            validateLoginCredentials: jest.fn(),
            issueTokens: jest.fn(),
        };
        emailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
        oneSignalService = {
            addUserToNotificationList: jest.fn().mockResolvedValue({
                success: true,
                data: { playerId: 'player-1' },
            }),
        };

        service = new AuthService(
            prisma,
            usersService,
            {} as any,
            oneSignalService,
            {} as any,
            emailService,
        );
    });

    it.each(roles)('starts email 2FA for %s login', async (role) => {
        usersService.validateLoginCredentials.mockResolvedValue({
            id: `${role.toLowerCase()}-id`,
            name: `${role} User`,
            email: `${role.toLowerCase()}@glee.test`,
            role: { name: role },
            twoFactorEnabled: true,
        });

        const result: any = await service.login({
            email: `${role.toLowerCase()}@glee.test`,
            password: 'Test@1234',
            role,
            playerId: 'player-1',
        });

        expect(result).toMatchObject({
            success: true,
            requiresTwoFactor: true,
            data: { role },
        });
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: `${role.toLowerCase()}-id` },
            data: expect.objectContaining({
                twoFactorCode: expect.any(Number),
                twoFactorExpiresAt: expect.any(Date),
                twoFactorVerifiedAt: null,
            }),
        });
        expect(emailService.sendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                template: 'emails/auth/two-factor',
                message: expect.objectContaining({
                    to: `${role.toLowerCase()}@glee.test`,
                }),
            }),
        );
    });

    it.each(roles)(
        'logs in %s immediately when 2FA preference is off',
        async (role) => {
            usersService.validateLoginCredentials.mockResolvedValue({
                id: `${role.toLowerCase()}-id`,
                name: `${role} User`,
                email: `${role.toLowerCase()}@glee.test`,
                role: { name: role },
                twoFactorEnabled: false,
            });
            usersService.issueTokens.mockResolvedValue({
                user: { id: `${role.toLowerCase()}-id`, role },
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });

            const result = await service.login({
                email: `${role.toLowerCase()}@glee.test`,
                password: 'Test@1234',
                role,
            });

            expect(result).toMatchObject({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                user: expect.objectContaining({ role }),
            });
            expect(emailService.sendMail).not.toHaveBeenCalled();
            expect(prisma.user.update).not.toHaveBeenCalled();
        },
    );

    it.each(roles)(
        'verifies email 2FA and issues tokens for %s',
        async (role) => {
            prisma.user.findFirst.mockResolvedValue({
                id: `${role.toLowerCase()}-id`,
                name: `${role} User`,
                email: `${role.toLowerCase()}@glee.test`,
                role: { name: role },
                twoFactorCode: 123456,
                twoFactorExpiresAt: new Date(Date.now() + 60_000),
            });
            usersService.issueTokens.mockResolvedValue({
                user: { id: `${role.toLowerCase()}-id`, role },
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            });

            const result = await service.verifyLoginTwoFactor({
                email: `${role.toLowerCase()}@glee.test`,
                otp: 123456,
                playerId: 'player-1',
            });

            expect(result).toMatchObject({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                user: expect.objectContaining({ role }),
            });
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: `${role.toLowerCase()}-id` },
                data: expect.objectContaining({
                    twoFactorCode: null,
                    twoFactorExpiresAt: null,
                    twoFactorVerifiedAt: expect.any(Date),
                }),
            });
        },
    );

    it('rejects invalid 2FA code', async () => {
        prisma.user.findFirst.mockResolvedValue({
            id: 'user-id',
            email: 'user@glee.test',
            role: { name: UserRole.USER },
            twoFactorCode: 123456,
            twoFactorExpiresAt: new Date(Date.now() + 60_000),
        });

        await expect(
            service.verifyLoginTwoFactor({
                email: 'user@glee.test',
                otp: 654321,
            }),
        ).rejects.toThrow(HttpException);
    });

    it('marks non-user login as requiring password change when rotation period is expired', async () => {
        const createdAt = new Date('2026-01-01T00:00:00.000Z');
        usersService.validateLoginCredentials.mockResolvedValue({
            id: 'admin-id',
            name: 'Admin User',
            email: 'admin@glee.test',
            role: { name: UserRole.ADMIN },
            twoFactorEnabled: false,
            createdAt,
            passwordChangedAt: createdAt,
            passwordRotationDays: 30,
        });
        usersService.issueTokens.mockResolvedValue({
            user: { id: 'admin-id', role: UserRole.ADMIN },
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });

        const result: any = await service.login({
            email: 'admin@glee.test',
            password: 'Test@1234',
            role: UserRole.ADMIN,
        });

        expect(result.user).toMatchObject({
            id: 'admin-id',
            role: UserRole.ADMIN,
            passwordChangeRequired: true,
            passwordRotationDays: 30,
        });
        expect(result.user.passwordExpiresAt).toBe('2026-01-31T00:00:00.000Z');
    });

    it('does not require password rotation for USER accounts', async () => {
        const createdAt = new Date('2026-01-01T00:00:00.000Z');
        usersService.validateLoginCredentials.mockResolvedValue({
            id: 'user-id',
            name: 'Customer User',
            email: 'user@glee.test',
            role: { name: UserRole.USER },
            twoFactorEnabled: false,
            createdAt,
            passwordChangedAt: createdAt,
            passwordRotationDays: 7,
        });
        usersService.issueTokens.mockResolvedValue({
            user: { id: 'user-id', role: UserRole.USER },
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
        });

        const result: any = await service.login({
            email: 'user@glee.test',
            password: 'Test@1234',
            role: UserRole.USER,
        });

        expect(result.user).toMatchObject({
            id: 'user-id',
            role: UserRole.USER,
            passwordChangeRequired: false,
        });
    });

    it('stores passwordChangedAt when current user changes password', async () => {
        const hash = await bcrypt.hash('OldPass@123', 10);
        prisma.user.findUnique.mockResolvedValue({ id: 'admin-id', password: hash });

        await service.changeMyPassword(
            { id: 'admin-id' },
            { currentPassword: 'OldPass@123', newPassword: 'NewPass@123' },
        );

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'admin-id' },
            data: expect.objectContaining({
                password: expect.any(String),
                passwordChangedAt: expect.any(Date),
            }),
        });
    });

    it('allows non-user accounts to set a valid password rotation period', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'admin-id',
            role: { name: UserRole.ADMIN },
        });
        prisma.user.update.mockResolvedValue({
            id: 'admin-id',
            email: 'admin@glee.test',
            role: { name: UserRole.ADMIN },
            passwordRotationDays: 45,
        });

        const result = await (service as any).updatePasswordRotationPreference(
            { id: 'admin-id' },
            { days: 45 },
        );

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'admin-id' },
            data: { passwordRotationDays: 45 },
            select: expect.any(Object),
        });
        expect(result).toMatchObject({
            success: true,
            data: { passwordRotationDays: 45 },
        });
    });
});
