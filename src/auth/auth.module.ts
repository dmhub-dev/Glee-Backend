import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../schemas/user.shema';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './jwt.strategy';
import { OnesignalModule } from 'src/onesignal/onesignal.module';
import {
  Notification,
  NotificationSchema,
} from 'src/schemas/notification.schema';
import { ConfigService } from '@nestjs/config';
import { Countries, CountriesSchema } from '@src/schemas/countries.schema';
import { Cities, CitiesSchema } from '@src/schemas/cities.schema';
import { States, StatesSchema } from '@src/schemas/states.schema';
import { VendorService } from '@src/vendor/vendor.service';
import { VendorModule } from '@src/vendor/vendor.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Countries.name, schema: CountriesSchema },
      { name: Cities.name, schema: CitiesSchema },
      { name: States.name, schema: StatesSchema },
    ]),
    UsersModule,
    OnesignalModule,
    VendorModule,
    PassportModule.register({
      defaultStrategy: 'jwt',
      property: 'user',
      session: false,
    }),
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
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [PassportModule, JwtModule, AuthService],
})
export class AuthModule {}
