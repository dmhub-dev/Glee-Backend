import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { ListUsersQueryDto, UpdateUserDto } from './dto/access-management.dto';
import { AccessManagementService } from './access-management.service';

@Controller('users')
@ApiTags('User Management')
export class UserManagementController {
  constructor(private readonly accessManagementService: AccessManagementService) {}

  @Get()
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.USERS_READ)
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.accessManagementService.listUsers(query);
  }

  @Get(':id')
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.USERS_READ)
  getUser(@Param('id') id: string) {
    return this.accessManagementService.getUser(id);
  }

  @Patch(':id')
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.USERS_UPDATE)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    return this.accessManagementService.updateUser(id, dto, user);
  }

  @Delete(':id')
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.USERS_DELETE)
  deleteUser(@Param('id') id: string, @CurrentUser() user: any) {
    return this.accessManagementService.deleteUser(id, user);
  }
}
