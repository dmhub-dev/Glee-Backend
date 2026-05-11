import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../schemas/user.shema';
import { SocketModule } from 'src/socket/socket.module';
import {
  NotificationSchema,
  Notification,
} from 'src/schemas/notification.schema';
import { OnesignalModule } from 'src/onesignal/onesignal.module';
import { SocketGateway } from 'src/socket/socket.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('SECRETKEY'),
        signOptions: {
          expiresIn: config.get('EXPIRESIN'),
        },
      }),
      inject: [ConfigService],
    }),
    // OnesignalModule,
    // SocketModule,
  ],
  controllers: [],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
