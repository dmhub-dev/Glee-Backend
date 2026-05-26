import { Module } from '@nestjs/common';
import {
  PermissionsController,
  RolesController,
} from './access-control.controller';
import { AccessManagementService } from './access-management.service';
import { AuditLogsController } from './audit-logs.controller';
import { InvitationsController } from './invitations.controller';
import { UserManagementController } from './user-management.controller';

@Module({
  controllers: [
    InvitationsController,
    UserManagementController,
    RolesController,
    PermissionsController,
    AuditLogsController,
  ],
  providers: [AccessManagementService],
})
export class AccessManagementModule {}
