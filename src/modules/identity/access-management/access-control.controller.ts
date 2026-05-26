import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { UpdateRolePermissionsDto } from './dto/access-management.dto';
import { AccessManagementService } from './access-management.service';

@Controller('roles')
@ApiTags('Roles')
export class RolesController {
  constructor(private readonly accessManagementService: AccessManagementService) {}

  @Get()
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.ROLES_READ)
  listRoles() {
    return this.accessManagementService.listRoles();
  }

  @Patch(':role/permissions')
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.PERMISSIONS_MANAGE)
  updateRolePermissions(
    @Param('role') role: UserRole,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: any,
  ) {
    return this.accessManagementService.updateRolePermissions(role, dto, user);
  }
}

@Controller('permissions')
@ApiTags('Permissions')
export class PermissionsController {
  constructor(private readonly accessManagementService: AccessManagementService) {}

  @Get()
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.PERMISSIONS_READ)
  listPermissions() {
    return this.accessManagementService.listPermissions();
  }
}
