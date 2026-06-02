import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { Permission } from './permissions.enum';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard location management', () => {
    const requiredPermissions = [
        Permission.LOCATION_CREATE,
        Permission.LOCATION_UPDATE,
        Permission.LOCATION_DELETE,
    ];

    function contextFor(user: any): ExecutionContext {
        return {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({
                getRequest: () => ({ user }),
            }),
        } as any;
    }

    function guardFor(required: string[]) {
        const reflector = {
            getAllAndOverride: jest.fn().mockReturnValue(required),
        } as unknown as Reflector;
        return new PermissionsGuard(reflector);
    }

    it('allows super admin to manage locations', () => {
        const guard = guardFor(requiredPermissions);
        const result = guard.canActivate(
            contextFor({
                role: UserRole.SUPER_ADMIN,
                isSuperAdmin: true,
                permissions: [],
            }),
        );

        expect(result).toBe(true);
    });

    it('allows admin to manage locations when role permissions include writes', () => {
        const guard = guardFor(requiredPermissions);
        const result = guard.canActivate(
            contextFor({
                role: UserRole.ADMIN,
                permissions: requiredPermissions,
            }),
        );

        expect(result).toBe(true);
    });

    it.each([
        UserRole.OPERATIONS_MANAGER,
        UserRole.COMMERCIAL_MANAGER,
        UserRole.FINANCE,
        UserRole.VENDOR,
        UserRole.VENDOR_STAFF,
        UserRole.CUSTOMER_SUPPORT,
        UserRole.CONTENT_MANAGER,
        UserRole.USER,
    ])('blocks %s from managing locations', (role) => {
        const guard = guardFor(requiredPermissions);
        const result = guard.canActivate(
            contextFor({
                role,
                permissions: [Permission.LOCATION_READ],
            }),
        );

        expect(result).toBe(false);
    });
});
