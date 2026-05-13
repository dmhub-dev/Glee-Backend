import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { AdminNotificationController } from '@src/notification/notification.admin.controller';

@Global()
@Module({
  imports: [],
  providers: [NotificationService],
  controllers: [NotificationController, AdminNotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
