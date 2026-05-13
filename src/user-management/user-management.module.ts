import { Module } from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { UserManagementController } from './user-management.controller';
import { AdminUserManagementController } from './admin-user-management.controller';
import { AdminSettingsController } from './admin.settings.controller';

@Module({
  imports: [],
  controllers: [
    UserManagementController,
    AdminUserManagementController,
    AdminSettingsController,
  ],
  providers: [UserManagementService],
})
export class UserManagementModule {}
