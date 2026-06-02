import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, UserRole } from '@prisma/client';
import { PrismaService } from '@src/infrastructure/database/prisma.service';
import { EmailService } from '@src/infrastructure/email/email.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
    AcceptInvitationDto,
    InviteUserDto,
    ListAuditLogsQueryDto,
    ListUsersQueryDto,
    UpdateRolePermissionsDto,
    UpdateRoleTwoFactorPolicyDto,
    UpdateUserDto,
} from './dto/access-management.dto';

const USER_SELECT = {
    id: true,
    name: true,
    email: true,
    phone: true,
    address: true,
    profileImage: true,
    isActive: true,
    invitedAt: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
    role: { select: { id: true, name: true, description: true } },
    invitedBy: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class AccessManagementService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly emailService: EmailService,
    ) {}

    async inviteUser(
        dto: InviteUserDto,
        actor: any,
        requestMeta: Record<string, string | undefined>,
    ) {
        if (
            dto.role === UserRole.SUPER_ADMIN &&
            actor?.role !== UserRole.SUPER_ADMIN
        ) {
            throw new HttpException(
                'Only a super admin can invite another super admin',
                HttpStatus.FORBIDDEN,
            );
        }
        if (
            actor?.role === UserRole.VENDOR &&
            dto.role !== UserRole.VENDOR_STAFF
        ) {
            throw new HttpException(
                'Vendors can only invite vendor staff',
                HttpStatus.FORBIDDEN,
            );
        }
        if (dto.role !== UserRole.USER && !this.canAssignRoles(actor)) {
            throw new HttpException(
                'You do not have permission to assign roles',
                HttpStatus.FORBIDDEN,
            );
        }

        const existingUser = await this.prisma.user.findFirst({
            where: { email: dto.email, isDeleted: false },
            select: { id: true },
        });
        if (existingUser)
            throw new HttpException(
                'A user with this email already exists',
                HttpStatus.BAD_REQUEST,
            );

        const pendingInvite = await this.prisma.userInvitation.findFirst({
            where: {
                email: dto.email,
                status: 'PENDING',
                expiresAt: { gt: new Date() },
            },
            select: { id: true },
        });
        if (pendingInvite)
            throw new HttpException(
                'A pending invitation already exists for this email',
                HttpStatus.BAD_REQUEST,
            );

        const role = await this.findRoleOrThrow(dto.role);
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(
            Date.now() + (dto.expiresInDays ?? 7) * 24 * 60 * 60 * 1000,
        );

        const invitation = await this.prisma.userInvitation.create({
            data: {
                email: dto.email,
                name: dto.name,
                phone: dto.phone,
                token,
                expiresAt,
                roleId: role.id,
                invitedById: actor?.id,
            },
            include: this.invitationInclude(),
        });

        await this.safeSendInvitation(invitation);
        await this.log(actor, 'users.invite', 'UserInvitation', invitation.id, {
            email: dto.email,
            role: dto.role,
            ...requestMeta,
        });

        return {
            success: true,
            message: 'Invitation created successfully',
            data: this.withInvitationLink(invitation),
        };
    }

    async listInvitations(actor: any) {
        const where =
            actor?.role === UserRole.SUPER_ADMIN ||
            actor?.role === UserRole.ADMIN
                ? {}
                : { invitedById: actor?.id };
        const invitations = await this.prisma.userInvitation.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: this.invitationInclude(),
        });
        return {
            success: true,
            message: 'Invitations retrieved successfully',
            data: invitations.map((i) => this.withInvitationLink(i)),
        };
    }

    async resendInvitation(id: string, actor: any) {
        const invitation = await this.prisma.userInvitation.findUnique({
            where: { id },
            include: this.invitationInclude(),
        });
        if (!invitation)
            throw new HttpException(
                'Invitation not found',
                HttpStatus.NOT_FOUND,
            );
        if (invitation.status !== 'PENDING')
            throw new HttpException(
                'Only pending invitations can be resent',
                HttpStatus.BAD_REQUEST,
            );
        this.assertInvitationAccess(invitation, actor);

        const updated = await this.prisma.userInvitation.update({
            where: { id },
            data: {
                token: randomBytes(32).toString('hex'),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
            include: this.invitationInclude(),
        });
        await this.safeSendInvitation(updated);
        await this.log(actor, 'users.invite_resend', 'UserInvitation', id);

        return {
            success: true,
            message: 'Invitation resent successfully',
            data: this.withInvitationLink(updated),
        };
    }

    async revokeInvitation(id: string, actor: any) {
        const invitation = await this.prisma.userInvitation.findUnique({
            where: { id },
        });
        if (!invitation)
            throw new HttpException(
                'Invitation not found',
                HttpStatus.NOT_FOUND,
            );
        if (invitation.status !== 'PENDING')
            throw new HttpException(
                'Only pending invitations can be revoked',
                HttpStatus.BAD_REQUEST,
            );
        this.assertInvitationAccess(invitation, actor);

        const updated = await this.prisma.userInvitation.update({
            where: { id },
            data: { status: 'REVOKED' },
            include: this.invitationInclude(),
        });
        await this.log(actor, 'users.invite_revoke', 'UserInvitation', id);

        return {
            success: true,
            message: 'Invitation revoked successfully',
            data: updated,
        };
    }

    async acceptInvitation(token: string, dto: AcceptInvitationDto) {
        if (dto.password !== dto.confirmPassword) {
            throw new HttpException(
                'Passwords do not match',
                HttpStatus.BAD_REQUEST,
            );
        }

        const invitation = await this.prisma.userInvitation.findUnique({
            where: { token },
            include: { role: true, invitedBy: { include: { role: true } } },
        });
        if (!invitation)
            throw new HttpException(
                'Invitation not found',
                HttpStatus.NOT_FOUND,
            );
        if (invitation.status !== 'PENDING')
            throw new HttpException(
                'Invitation is no longer pending',
                HttpStatus.BAD_REQUEST,
            );
        if (invitation.expiresAt < new Date()) {
            await this.prisma.userInvitation.update({
                where: { id: invitation.id },
                data: { status: 'EXPIRED' },
            });
            throw new HttpException(
                'Invitation has expired',
                HttpStatus.BAD_REQUEST,
            );
        }

        const existingUser = await this.prisma.user.findFirst({
            where: { email: invitation.email, isDeleted: false },
            select: { id: true },
        });
        if (existingUser)
            throw new HttpException(
                'A user with this email already exists',
                HttpStatus.BAD_REQUEST,
            );

        const password = await bcrypt.hash(dto.password, 10);
        const vendorAccountId =
            invitation.role.name === UserRole.VENDOR_STAFF &&
            invitation.invitedBy?.role?.name === UserRole.VENDOR
                ? invitation.invitedById
                : null;
        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name: invitation.name,
                    email: invitation.email,
                    phone: invitation.phone,
                    password,
                    roleId: invitation.roleId,
                    invitedById: invitation.invitedById,
                    invitedAt: invitation.createdAt,
                    vendorAccountId,
                    isActive: AccountStatus.ACTIVE,
                    profileStatus: false,
                    twoFactorEnabled: false,
                },
                select: USER_SELECT,
            });
            const accepted = await tx.userInvitation.update({
                where: { id: invitation.id },
                data: {
                    status: 'ACCEPTED',
                    acceptedAt: new Date(),
                    userId: user.id,
                },
                include: this.invitationInclude(),
            });
            await tx.auditLog.create({
                data: {
                    actorId: user.id,
                    action: 'users.invite_accept',
                    entity: 'UserInvitation',
                    entityId: invitation.id,
                    metadata: {
                        email: invitation.email,
                        role: invitation.role.name,
                    },
                },
            });
            return { user, invitation: accepted };
        });

        return {
            success: true,
            message: 'Invitation accepted successfully',
            data: result,
        };
    }

    async listUsers(query: ListUsersQueryDto, actor?: any) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const where: any = { isDeleted: false };

        if (actor?.role === UserRole.VENDOR) {
            where.role = { name: UserRole.VENDOR_STAFF };
            where.vendorAccountId = actor.id;
        } else if (query.role) where.role = { name: query.role };
        if (query.status) where.isActive = query.status;
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: USER_SELECT,
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            success: true,
            message: 'Users retrieved successfully',
            data: { items, total, page, limit },
        };
    }

    async getUser(id: string, actor?: any) {
        const where: any = { id, isDeleted: false };
        if (actor?.role === UserRole.VENDOR) {
            where.role = { name: UserRole.VENDOR_STAFF };
            where.vendorAccountId = actor.id;
        }
        const user = await this.prisma.user.findFirst({
            where,
            select: USER_SELECT,
        });
        if (!user)
            throw new HttpException('User not found', HttpStatus.NOT_FOUND);
        return {
            success: true,
            message: 'User retrieved successfully',
            data: user,
        };
    }

    async updateUser(id: string, dto: UpdateUserDto, actor: any) {
        const current = await this.prisma.user.findFirst({
            where: {
                id,
                isDeleted: false,
                ...(actor?.role === UserRole.VENDOR && {
                    role: { name: UserRole.VENDOR_STAFF },
                    vendorAccountId: actor.id,
                }),
            },
            include: { role: true },
        });
        if (!current)
            throw new HttpException('User not found', HttpStatus.NOT_FOUND);
        if (
            current.role?.name === UserRole.SUPER_ADMIN &&
            actor?.role !== UserRole.SUPER_ADMIN
        ) {
            throw new HttpException(
                'Only a super admin can update a super admin account',
                HttpStatus.FORBIDDEN,
            );
        }

        const data: any = {
            name: dto.name,
            phone: dto.phone,
            address: dto.address,
            isActive: dto.isActive,
            twoFactorEnabled: dto.twoFactorEnabled,
        };
        Object.keys(data).forEach(
            (key) => data[key] === undefined && delete data[key],
        );

        if (dto.role) {
            if (actor?.role === UserRole.VENDOR) {
                throw new HttpException(
                    'Vendors cannot reassign staff roles',
                    HttpStatus.FORBIDDEN,
                );
            }
            if (!this.canAssignRoles(actor)) {
                throw new HttpException(
                    'You do not have permission to assign roles',
                    HttpStatus.FORBIDDEN,
                );
            }
            if (
                dto.role === UserRole.SUPER_ADMIN &&
                actor?.role !== UserRole.SUPER_ADMIN
            ) {
                throw new HttpException(
                    'Only a super admin can assign the super admin role',
                    HttpStatus.FORBIDDEN,
                );
            }
            const role = await this.findRoleOrThrow(dto.role);
            data.roleId = role.id;
        }

        const user = await this.prisma.user.update({
            where: { id },
            data,
            select: USER_SELECT,
        });
        await this.log(actor, 'users.update', 'User', id, {
            beforeRole: current.role?.name,
            afterRole: dto.role,
        });

        return {
            success: true,
            message: 'User updated successfully',
            data: user,
        };
    }

    async deleteUser(id: string, actor: any) {
        if (id === actor?.id)
            throw new HttpException(
                'You cannot delete your own account',
                HttpStatus.BAD_REQUEST,
            );

        const user = await this.prisma.user.findFirst({
            where: {
                id,
                isDeleted: false,
                ...(actor?.role === UserRole.VENDOR && {
                    role: { name: UserRole.VENDOR_STAFF },
                    vendorAccountId: actor.id,
                }),
            },
            select: { id: true, role: { select: { name: true } } },
        });
        if (!user)
            throw new HttpException('User not found', HttpStatus.NOT_FOUND);
        if (
            user.role?.name === UserRole.SUPER_ADMIN &&
            actor?.role !== UserRole.SUPER_ADMIN
        ) {
            throw new HttpException(
                'Only a super admin can delete a super admin account',
                HttpStatus.FORBIDDEN,
            );
        }

        await this.prisma.user.update({
            where: { id },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                isActive: AccountStatus.INACTIVE,
            },
        });
        await this.log(actor, 'users.delete', 'User', id);

        return {
            success: true,
            message: 'User deleted successfully',
            data: { id },
        };
    }

    async listRoles() {
        const roles = await this.prisma.role.findMany({
            orderBy: { name: 'asc' },
            include: {
                permissions: { include: { permission: true } },
                _count: { select: { users: true } },
            },
        });
        return {
            success: true,
            message: 'Roles retrieved successfully',
            data: roles.map((role) => ({
                ...role,
                permissions: role.permissions.map((rp) => rp.permission),
            })),
        };
    }

    async listPermissions() {
        const permissions = await this.prisma.permission.findMany({
            orderBy: [{ module: 'asc' }, { action: 'asc' }],
        });
        return {
            success: true,
            message: 'Permissions retrieved successfully',
            data: permissions,
        };
    }

    async updateRolePermissions(
        roleName: UserRole,
        dto: UpdateRolePermissionsDto,
        actor: any,
    ) {
        const role = await this.findRoleOrThrow(roleName);
        const permissions = await this.prisma.permission.findMany({
            where: { name: { in: dto.permissions } },
            select: { id: true, name: true },
        });
        const found = new Set(permissions.map((p) => p.name));
        const missing = dto.permissions.filter((name) => !found.has(name));
        if (missing.length > 0) {
            throw new HttpException(
                `Unknown permissions: ${missing.join(', ')}`,
                HttpStatus.BAD_REQUEST,
            );
        }

        await this.prisma.$transaction([
            this.prisma.rolePermission.deleteMany({
                where: { roleId: role.id },
            }),
            ...permissions.map((permission) =>
                this.prisma.rolePermission.create({
                    data: { roleId: role.id, permissionId: permission.id },
                }),
            ),
        ]);
        await this.log(actor, 'roles.permissions_update', 'Role', role.id, {
            role: roleName,
            permissions: dto.permissions,
        });

        return this.listRoles();
    }

    async updateRoleTwoFactorPolicy(
        roleName: UserRole,
        dto: UpdateRoleTwoFactorPolicyDto,
        actor: any,
    ) {
        const role = await this.findRoleOrThrow(roleName);
        const updated = await this.prisma.role.update({
            where: { id: role.id },
            data: { twoFactorRequired: dto.required },
            select: {
                id: true,
                name: true,
                description: true,
                twoFactorRequired: true,
            },
        });
        await this.log(actor, 'roles.2fa_policy_update', 'Role', role.id, {
            role: roleName,
            required: dto.required,
        });

        return {
            success: true,
            message: 'Role 2FA policy updated successfully',
            data: updated,
        };
    }

    async listAuditLogs(query: ListAuditLogsQueryDto) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const where: any = {};
        if (query.actorId) where.actorId = query.actorId;
        if (query.action) where.action = query.action;
        if (query.entity) where.entity = query.entity;
        if (query.entityId) where.entityId = query.entityId;

        const [items, total] = await this.prisma.$transaction([
            this.prisma.auditLog.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    actor: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return {
            success: true,
            message: 'Audit logs retrieved successfully',
            data: { items, total, page, limit },
        };
    }

    private async findRoleOrThrow(name: UserRole) {
        const role = await this.prisma.role.findUnique({ where: { name } });
        if (!role)
            throw new HttpException(
                `Role ${name} does not exist`,
                HttpStatus.BAD_REQUEST,
            );
        return role;
    }

    private canAssignRoles(actor: any) {
        return (
            actor?.role === UserRole.SUPER_ADMIN ||
            actor?.permissions?.includes('users:assign_role') ||
            actor?.role === UserRole.VENDOR
        );
    }

    private assertInvitationAccess(invitation: any, actor: any) {
        if (
            actor?.role === UserRole.SUPER_ADMIN ||
            actor?.role === UserRole.ADMIN
        ) {
            return;
        }
        if (actor?.role === UserRole.VENDOR && invitation.invitedById === actor.id) {
            return;
        }
        throw new HttpException(
            'You do not have access to this invitation',
            HttpStatus.FORBIDDEN,
        );
    }

    private async log(
        actor: any,
        action: string,
        entity: string,
        entityId?: string,
        metadata?: Record<string, unknown>,
    ) {
        await this.prisma.auditLog.create({
            data: {
                actorId: actor?.id,
                action,
                entity,
                entityId,
                metadata: metadata as any,
            },
        });
    }

    private invitationInclude() {
        return {
            role: { select: { id: true, name: true, description: true } },
            invitedBy: { select: { id: true, name: true, email: true } },
            user: { select: { id: true, name: true, email: true } },
        };
    }

    private withInvitationLink(invitation: any) {
        return {
            ...invitation,
            inviteLink: this.invitationLink(invitation.token),
        };
    }

    private invitationLink(token: string) {
        const baseUrl =
            this.config.get<string>('ADMIN_APP_URL') ??
            this.config.get<string>('APP_URL') ??
            'http://localhost:8003';
        return `${baseUrl.replace(/\/$/, '')}/invitations/accept/${token}`;
    }

    private async safeSendInvitation(invitation: any) {
        try {
            await this.emailService.sendMail({
                template: 'emails/auth/invite-user',
                message: {
                    to: invitation.email,
                    subject: 'You have been invited to Glee',
                },
                locals: {
                    name: invitation.name,
                    role: invitation.role?.name,
                    link: this.invitationLink(invitation.token),
                    date: new Date().getFullYear(),
                },
            });
        } catch {
            // Invitation creation should not fail because the email provider is unavailable.
        }
    }
}
