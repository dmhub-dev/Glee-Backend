import { UserRole } from '@prisma/client';
import { AccessManagementService } from './access-management.service';

describe('AccessManagementService role 2FA policy', () => {
    let service: AccessManagementService;
    let prisma: any;

    beforeEach(() => {
        prisma = {
            role: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            auditLog: {
                create: jest.fn().mockResolvedValue({}),
            },
        };
        service = new AccessManagementService(
            prisma,
            { get: jest.fn() } as any,
            { sendMail: jest.fn() } as any,
        );
    });

    it('updates role-level 2FA policy for any role including SUPER_ADMIN', async () => {
        prisma.role.findUnique.mockResolvedValue({
            id: 'role-1',
            name: UserRole.SUPER_ADMIN,
        });
        prisma.role.update.mockResolvedValue({
            id: 'role-1',
            name: UserRole.SUPER_ADMIN,
            twoFactorRequired: true,
        });

        const result = await service.updateRoleTwoFactorPolicy(
            UserRole.SUPER_ADMIN,
            { required: true },
            { id: 'actor-1', role: UserRole.SUPER_ADMIN },
        );

        expect(prisma.role.update).toHaveBeenCalledWith({
            where: { id: 'role-1' },
            data: { twoFactorRequired: true },
            select: {
                id: true,
                name: true,
                description: true,
                twoFactorRequired: true,
            },
        });
        expect(result).toMatchObject({
            success: true,
            data: { name: UserRole.SUPER_ADMIN, twoFactorRequired: true },
        });
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'roles.2fa_policy_update',
                entity: 'Role',
                entityId: 'role-1',
                metadata: { role: UserRole.SUPER_ADMIN, required: true },
            }),
        });
    });
});
