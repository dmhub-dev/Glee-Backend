import { Module, CacheModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from './config/database.module';
import configuration from './config/configuration';
import { HttpModule } from '@nestjs/axios';
import { JwtAuthGuard } from './config/auth-guard';
import { APP_GUARD, APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { RolesGuard } from './guards/roles.guard';
import { ServicesModule } from './services/services.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { EventModule } from './event/event.module';
import { PaymentModule } from './payment/payment.module';
import { VendorModule } from './vendor/vendor.module';
import { UserManagementModule } from './user-management/user-management.module';
import { BookingsModule } from './bookings/bookings.module';
import { HttpLogInterceptor } from '@src/interceptors/logger.interceptors';

import { MongooseModule } from '@nestjs/mongoose';

import { Countries, CountriesSchema } from '@src/schemas/countries.schema';
import { Cities, CitiesSchema } from '@src/schemas/cities.schema';
import { States, StatesSchema } from '@src/schemas/states.schema';
import { AppService } from '@src/app.service';
import { CommonApiModule } from '@src/common.api/common-api.module';
import { SocketGateway } from '@src/socket/socket.gateway';
import { SocketEventHandler } from '@src/socket/socket_event.handler';
import { SocketModule } from '@src/socket/socket.module';
import { OnesignalModule } from './onesignal/onesignal.module';
import { EmailModule } from '@src/email-server/email.module';
import { EmailService } from '@src/email-server/email.service';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from '@src/notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Countries.name, schema: CountriesSchema },
      { name: Cities.name, schema: CitiesSchema },
      { name: States.name, schema: StatesSchema },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: false,
      load: [configuration],
      envFilePath: `${process.cwd()}/${process.env.NODE_ENV}.env`,
    }),
    DatabaseModule,
    CacheModule.register({ isGlobal: true }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),

    UsersModule,
    AuthModule,
    EventModule,
    CategoriesModule,
    ServicesModule,
    PaymentModule,
    VendorModule,
    UserManagementModule,
    BookingsModule,
    CommonApiModule,
    SocketModule,
    NotificationModule,
    OnesignalModule,
    EmailModule,
    ChatModule,
  ],
  providers: [
    AppService,
    SocketGateway,
    SocketEventHandler,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLogInterceptor,
    },
    {
      provide: APP_GUARD,
      useFactory: (ref) => new JwtAuthGuard(ref),
      inject: [Reflector],
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
