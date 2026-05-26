import { HttpException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';

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

        const result = await service.login({
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
});
