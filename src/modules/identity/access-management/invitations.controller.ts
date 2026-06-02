import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@src/auth/jwt/current-user.decorator';
import { Permissions } from '@src/auth/rbac/permissions.decorator';
import { Permission } from '@src/auth/rbac/permissions.enum';
import { ApiResponses } from '@src/common/responses/response';
import { AcceptInvitationDto, InviteUserDto } from './dto/access-management.dto';
import { AccessManagementService } from './access-management.service';

@Controller('invitations')
@ApiTags('Invitations')
export class InvitationsController {
  constructor(private readonly accessManagementService: AccessManagementService) {}

  @Post()
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.USERS_INVITE)
  inviteUser(@Body() dto: InviteUserDto, @CurrentUser() user: any, @Req() req: any) {
    return this.accessManagementService.inviteUser(dto, user, {
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  @Get()
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.USERS_INVITE)
  listInvitations(@CurrentUser() user: any) {
    return this.accessManagementService.listInvitations(user);
  }

  @Post('accept/:token')
  @ApiResponses(false)
  acceptInvitation(@Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.accessManagementService.acceptInvitation(token, dto);
  }

  @Post(':id/resend')
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.USERS_INVITE)
  resendInvitation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.accessManagementService.resendInvitation(id, user);
  }

  @Post(':id/revoke')
  @ApiResponses(true, [UserRole.SUPER_ADMIN])
  @Permissions(Permission.USERS_INVITE)
  revokeInvitation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.accessManagementService.revokeInvitation(id, user);
  }
}
