import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Notification,
  NotificationSchema,
} from 'src/schemas/notification.schema';
import { User, UserSchema } from 'src/schemas/user.shema';
import { AdminNotificationController } from '@src/notification/notification.admin.controller';
// import { Post, PostSchema } from 'src/schemas/post.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      // { name: Post.name, schema: PostSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [NotificationService],
  controllers: [NotificationController, AdminNotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
